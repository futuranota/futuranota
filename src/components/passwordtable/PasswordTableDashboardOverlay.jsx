import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PasswordVaultBlockView } from "../docs/blocks/PasswordVaultBlockView.jsx";
import { createPasswordEntry } from "../../lib/vaultBlocks.js";
import { queuePasswordTableEntry } from "../../lib/passwordTableSession.js";
import { usePasswordTableStore } from "../../stores/passwordTableStore.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Dedicated company Password table overlay (toolbar), not the document editor.
 * Every Save writes to the SQL-backed store (same path as slash `/`).
 *
 * @param {Object} props
 * @param {import("../../lib/passwordTableSession.js").PasswordTableSession | null} props.session
 * @param {(patch: Partial<import("../../lib/passwordTableSession.js").PasswordTableSession>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {(entries: import("../../lib/vaultBlocks.js").PasswordEntry[]) => void} props.onSaved
 */
export function PasswordTableDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [addFormRequest, setAddFormRequest] = useState(0);
  const [draft, setDraft] = useState({ description: "", password: "" });
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const sessionKey = session
    ? `${session.objectId ?? ""}:${session.docId ?? ""}:${session.blockId}`
    : "";

  useEffect(() => {
    setDraft({ description: "", password: "" });
    setQuery("");
  }, [sessionKey]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab]);

  if (!session) return null;

  const objectId = session.objectId;

  const commitDraftIfReady = (currentEntries) => {
    const currentDraft = draftRef.current;
    const canCommit = Boolean(
      currentDraft.description.trim() && currentDraft.password.trim(),
    );
    if (!canCommit) return currentEntries;

    const entry = createPasswordEntry(currentDraft);
    setDraft({ description: "", password: "" });
    return [...currentEntries, entry];
  };

  /** Row Save: insert one entry into SQL store immediately (same as slash). */
  const handleSaveEntry = (entry) => {
    if (!objectId) {
      console.warn("[password-table] Row Save skipped: missing company objectId");
      return;
    }
    const stored = queuePasswordTableEntry(objectId, entry);
    if (!stored) return;
    const fromStore = usePasswordTableStore.getState().getEntriesForObject(objectId);
    onChange?.({
      entries: fromStore.map((item) => ({
        id: item.id,
        description: item.description,
        password: item.password,
        tag: item.tag,
      })),
      saved: true,
    });
    setDraft({ description: "", password: "" });
  };

  /** Footer Save: persist full table + close. */
  const handleSave = async () => {
    if (saving) return;
    if (!objectId) {
      console.warn("[password-table] Footer Save skipped: missing company objectId");
      return;
    }
    setSaving(true);
    try {
      const nextEntries = commitDraftIfReady(session.entries || []);
      onChange?.({ entries: nextEntries, saved: false });
      await Promise.resolve(onSaved?.(nextEntries));
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => {
    setAddFormRequest((value) => value + 1);
  };

  return createPortal(
    <div
      className="url-table-page-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("pack.passwordTableTitle")}
    >
      <div className="url-table-page-overlay__backdrop" aria-hidden />
      <div className="url-table-page-overlay__shell">
        <header className="url-table-page-overlay__header">
          <h2 className="url-table-page-overlay__title">{t("pack.passwordTableTitle")}</h2>
          <div className="url-table-page-overlay__search-wrap">
            <span className="url-table-page-overlay__search-icon" aria-hidden />
            <input
              type="search"
              className="url-table-page-overlay__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("passwordTableLibrary.searchPlaceholder")}
              aria-label={t("passwordTableLibrary.searchPlaceholder")}
            />
          </div>
          <div className="url-table-page-overlay__header-actions">
            <button
              type="button"
              className="url-table-page-overlay__add-btn"
              onClick={handleAddRow}
              aria-label={t("passwordTableLibrary.addRow")}
              title={t("passwordTableLibrary.addRow")}
            >
              +
            </button>
            <button
              type="button"
              className="url-table-page-overlay__close"
              onClick={onCloseTab}
              aria-label={t("passwordTableLibrary.closeTab")}
              title={t("passwordTableLibrary.closeTab")}
            >
              ×
            </button>
          </div>
        </header>

        <div className="url-table-page-overlay__body scroll-match-bg password-table-dashboard">
          <PasswordVaultBlockView
            entries={session.entries}
            onEntriesChange={(entries) => onChange({ entries, saved: false })}
            onSaveEntry={objectId ? handleSaveEntry : null}
            hideAddButton
            addFormRequest={addFormRequest}
            filterQuery={query}
            draft={draft}
            onDraftChange={setDraft}
            labels={{
              description: "Description",
              password: "Password",
              save: "Save",
              copy: "Copy",
              copied: "Copied",
            }}
          />
        </div>

        <footer className="url-table-page-overlay__footer">
          <button
            type="button"
            className="doc-new-action doc-new-action--save password-table-dashboard__save"
            onClick={handleSave}
            disabled={saving}
          >
            {t("common.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
