import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { createLinkEntry, normalizeUrlInput } from "../../lib/vaultBlocks.js";
import { queueUrlTableEntry } from "../../lib/urlTableSession.js";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Dedicated company URL table overlay (toolbar), not the document editor.
 * Every Save writes to the SQL-backed store (same path as slash `/`).
 *
 * @param {Object} props
 * @param {import("../../lib/urlTableSession.js").UrlTableSession | null} props.session
 * @param {(patch: Partial<import("../../lib/urlTableSession.js").UrlTableSession>) => void} props.onChange
 * @param {() => void} props.onCloseTab
 * @param {(entries: import("../../lib/vaultBlocks.js").LinkEntry[]) => void} props.onSaved
 */
export function UrlTableDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [addFormRequest, setAddFormRequest] = useState(0);
  const [draft, setDraft] = useState({ name: "", tag: "", category: "", description: "", url: "" });
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const sessionKey = session
    ? `${session.objectId ?? ""}:${session.docId ?? ""}:${session.blockId}`
    : "";

  useEffect(() => {
    setDraft({ name: "", tag: "", category: "", description: "", url: "" });
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
      currentDraft.name.trim() && currentDraft.url.trim(),
    );
    if (!canCommit) return currentEntries;

    const entry = createLinkEntry({
      ...currentDraft,
      url: normalizeUrlInput(currentDraft.url),
    });
    setDraft({ name: "", tag: "", category: "", description: "", url: "" });
    return [...currentEntries, entry];
  };

  /** Row Save: insert one entry into SQL store immediately (same as slash). */
  const handleSaveEntry = (entry) => {
    if (!objectId) {
      console.warn("[url-table] Row Save skipped: missing company objectId");
      return;
    }
    const stored = queueUrlTableEntry(objectId, entry);
    if (!stored) return;
    const fromStore = useUrlTableStore.getState().getEntriesForObject(objectId);
    onChange?.({
      entries: fromStore.map((item) => ({
        id: item.id,
        name: item.name,
        tag: item.tag,
        category: item.category,
        description: item.description,
        url: item.url,
      })),
      saved: true,
    });
    setDraft({ name: "", tag: "", category: "", description: "", url: "" });
  };

  /** Footer Save: persist full table + close. */
  const handleSave = async () => {
    if (saving) return;
    if (!objectId) {
      console.warn("[url-table] Footer Save skipped: missing company objectId");
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
      aria-label={t("pack.urlTableTitle")}
    >
      <div className="url-table-page-overlay__backdrop" aria-hidden />
      <div className="url-table-page-overlay__shell">
        <header className="url-table-page-overlay__header">
          <h2 className="url-table-page-overlay__title">{t("pack.urlTableTitle")}</h2>
          <div className="url-table-page-overlay__search-wrap">
            <span className="url-table-page-overlay__search-icon" aria-hidden />
            <input
              type="search"
              className="url-table-page-overlay__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("urlTableLibrary.searchPlaceholder")}
              aria-label={t("urlTableLibrary.searchPlaceholder")}
            />
          </div>
          <div className="url-table-page-overlay__header-actions">
            <button
              type="button"
              className="url-table-page-overlay__add-btn"
              onClick={handleAddRow}
              aria-label={t("urlTableLibrary.addRow")}
              title={t("urlTableLibrary.addRow")}
            >
              +
            </button>
            <button
              type="button"
              className="url-table-page-overlay__close"
              onClick={onCloseTab}
              aria-label={t("urlTableLibrary.closeTab")}
              title={t("urlTableLibrary.closeTab")}
            >
              ×
            </button>
          </div>
        </header>

        <div className="url-table-page-overlay__body scroll-match-bg url-table-dashboard">
          <LinkVaultBlockView
            entries={session.entries}
            onEntriesChange={(entries) => onChange({ entries, saved: false })}
            onSaveEntry={objectId ? handleSaveEntry : null}
            multilineDescription
            hideAddButton
            addFormRequest={addFormRequest}
            filterQuery={query}
            draft={draft}
            onDraftChange={setDraft}
            labels={{
              name: "Name",
              tag: "Tag",
              category: "Category",
              description: "Description",
              url: "URL",
              save: "Save",
            }}
          />
        </div>

        <footer className="url-table-page-overlay__footer">
          <button
            type="button"
            className="doc-new-action doc-new-action--save url-table-dashboard__save"
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
