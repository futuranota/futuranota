import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { UrlTableEntryDetailView } from "./UrlTableEntryDetailView.jsx";
import { MarkLoadingOverlay } from "../shared/MarkLoading.jsx";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";
import { createLinkEntry, normalizeUrlInput } from "../../lib/vaultBlocks.js";
import { queueUrlTableEntry } from "../../lib/urlTableSession.js";
import { removeUrlTableFromDoc } from "../../lib/urlTableLibrary.js";
import { flushUrlTableSync, markUrlTableEntryDeleted } from "../../lib/urlTableSync.js";
import { flushUrlTablesSync } from "../../lib/urlTablesSync.js";
import { withResolvedAffiliateLifecycle } from "../../lib/urlTableAffiliate.js";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";

const TITLE_MIN_CH = 12;
const TITLE_MAX_CH = 42;

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
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");
  const [addFormRequest, setAddFormRequest] = useState(0);
  const [draft, setDraft] = useState({ name: "", tag: "", category: "", description: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewEntryId, setViewEntryId] = useState(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const draftRef = useRef(draft);
  const detailSaveRef = useRef(null);
  const confirmOpenRef = useRef(false);
  draftRef.current = draft;

  const sessionKey = session
    ? `${session.objectId ?? ""}:${session.tableId ?? ""}:${session.blockId}`
    : "";

  const initialSearch = String(session?.initialSearch ?? "");

  useEffect(() => {
    setDraft({ name: "", tag: "", category: "", description: "", url: "" });
    setQuery(initialSearch);
    setViewEntryId(null);
    setDetailSaving(false);
  }, [sessionKey, initialSearch]);

  // Auto-expire active cookies whose window has elapsed.
  useEffect(() => {
    if (!session?.entries?.length) return;
    let changed = false;
    const nextEntries = session.entries.map((entry) => {
      const resolved = withResolvedAffiliateLifecycle(entry);
      if (resolved !== entry && resolved.affiliateStatus !== entry.affiliateStatus) {
        changed = true;
      }
      return resolved;
    });
    if (!changed) return;
    onChange?.({ entries: nextEntries, saved: false });
    if (!session.objectId || !session.tableId) return;
    for (const entry of nextEntries) {
      const prev = session.entries.find((item) => item.id === entry.id);
      if (prev && prev.affiliateStatus !== entry.affiliateStatus) {
        queueUrlTableEntry(session.objectId, entry, session.tableId);
      }
    }
  }, [sessionKey]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (viewEntryId) {
        setViewEntryId(null);
        return;
      }
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab, viewEntryId]);

  if (!session) return null;

  const objectId = session.objectId;
  const tableId = session.tableId;
  const isAffiliateTable = session.kind === "affiliates";
  const titleLabel = String(session.title ?? "").trim() || t("pack.urlTableTitle");
  const titleValue = session.title ?? "";
  const titlePlaceholder = t("urlTableLibrary.titlePlaceholder");
  const titleWidthCh = Math.min(
    Math.max(titleValue.length || titlePlaceholder.length, TITLE_MIN_CH),
    TITLE_MAX_CH,
  );

  const viewingEntry = viewEntryId
    ? (session.entries || []).find((entry) => entry.id === viewEntryId) || null
    : null;

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
      return null;
    }
    const stored = queueUrlTableEntry(objectId, entry, tableId);
    if (!stored) return null;
    const sessionEntries = session?.entries || [];
    const link = createLinkEntry(stored);
    const nextEntries = sessionEntries.some((item) => item.id === stored.id)
      ? sessionEntries.map((item) => (item.id === stored.id ? link : item))
      : [...sessionEntries, link];
    onChange?.({
      tableId: stored.tableId || tableId,
      entries: nextEntries,
      saved: true,
    });
    setDraft({ name: "", tag: "", category: "", description: "", url: "" });
    return stored;
  };

  /** Row delete: remove from SQL store immediately so it cannot resurrect. */
  const handleDeleteEntry = (entryId) => {
    if (!entryId) return;
    if (viewEntryId === entryId) setViewEntryId(null);
    markUrlTableEntryDeleted(entryId);
    useUrlTableStore.getState().removeEntry(entryId);
    onChange?.({
      entries: (session.entries || []).filter((entry) => entry.id !== entryId),
      saved: false,
    });
    Promise.all([flushUrlTableSync(), flushUrlTablesSync()]).catch((err) => {
      console.warn("[url-table] flush after row delete failed", err);
    });
  };

  const handleDeleteEntryFromDetail = async (entryId) => {
    if (!entryId || deleting || detailSaving) return;
    const name = String(
      (session.entries || []).find((entry) => entry.id === entryId)?.name ?? "",
    ).trim() || t("urlTableAffiliate.untitled");
    const confirmed = await askConfirm({
      title: t("urlTableAffiliate.deleteRow"),
      message: t("urlTableLibrary.deleteConfirm", { title: name }),
      confirmLabel: t("urlTableAffiliate.deleteRow"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    handleDeleteEntry(entryId);
  };

  const handleViewEntry = (entry) => {
    if (!entry?.id) return;
    setViewEntryId(entry.id);
  };

  const handleSaveEntryDetail = async (nextEntry) => {
    if (!nextEntry?.id) return;
    const link = createLinkEntry(nextEntry);
    const nextEntries = (session.entries || []).map((item) => (
      item.id === link.id ? link : item
    ));
    onChange?.({ entries: nextEntries, saved: false });
    if (objectId) {
      const stored = queueUrlTableEntry(objectId, link, tableId);
      if (!stored) {
        throw new Error("Failed to persist affiliate row");
      }
      await Promise.all([flushUrlTableSync(), flushUrlTablesSync()]);
    }
    setViewEntryId(null);
  };

  /** Footer Save: persist full table + close overlay. */
  const handleSave = async () => {
    if (saving || deleting) return;
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

  const handleDelete = async () => {
    if (deleting || saving || confirmOpenRef.current) return;
    if (!tableId) return;

    confirmOpenRef.current = true;
    try {
      const confirmed = await askConfirm({
        title: t("urlTableLibrary.deleteTitle"),
        message: t("urlTableLibrary.deleteConfirm", { title: titleLabel }),
        confirmLabel: t("urlTableLibrary.delete"),
        cancelLabel: t("common.cancel"),
      });
      if (!confirmed) return;

      setDeleting(true);
      try {
        removeUrlTableFromDoc({ id: tableId, tableId, title: titleLabel });
        await Promise.all([flushUrlTableSync(), flushUrlTablesSync()]);
        onCloseTab?.();
      } finally {
        setDeleting(false);
      }
    } finally {
      confirmOpenRef.current = false;
    }
  };

  const handleAddRow = () => {
    setViewEntryId(null);
    setAddFormRequest((value) => value + 1);
  };

  return createPortal(
    <div
      className="url-table-page-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={titleLabel}
    >
      <div className="url-table-page-overlay__backdrop" aria-hidden />
      <div className="url-table-page-overlay__shell">
        <header className="url-table-page-overlay__header">
          <input
            type="text"
            className="url-table-page-overlay__title-input"
            value={titleValue}
            onChange={(e) => onChange?.({ title: e.target.value, saved: false })}
            placeholder={titlePlaceholder}
            aria-label={titlePlaceholder}
            style={{ width: `${titleWidthCh}ch` }}
            maxLength={TITLE_MAX_CH}
          />
          {!viewingEntry ? (
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
          ) : null}
          <div className="url-table-page-overlay__header-actions">
            {!viewingEntry ? (
              <button
                type="button"
                className="url-table-page-overlay__add-btn"
                onClick={handleAddRow}
                aria-label={t("urlTableLibrary.addRow")}
                title={t("urlTableLibrary.addRow")}
              >
                +
              </button>
            ) : null}
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
          {viewingEntry ? (
            <UrlTableEntryDetailView
              entry={viewingEntry}
              onSave={handleSaveEntryDetail}
              onBack={() => setViewEntryId(null)}
              flushSaveRef={detailSaveRef}
              onSavingChange={setDetailSaving}
            />
          ) : (
            <LinkVaultBlockView
              entries={session.entries}
              onEntriesChange={(entries) => onChange({ entries, saved: false })}
              onSaveEntry={objectId ? handleSaveEntry : null}
              onDeleteEntry={objectId ? handleDeleteEntry : null}
              objectId={objectId}
              tableId={tableId}
              multilineDescription
              hideAddButton
              addFormRequest={addFormRequest}
              filterQuery={query}
              draft={draft}
              onDraftChange={setDraft}
              showRowView={isAffiliateTable}
              onViewEntry={isAffiliateTable ? handleViewEntry : null}
              labels={{
                name: isAffiliateTable
                  ? t("urlTableAffiliate.businessName")
                  : "Title",
                namePlaceholder: isAffiliateTable
                  ? t("urlTableAffiliate.businessNamePlaceholder")
                  : "Title",
                tag: "Tag",
                category: "Category",
                description: "Description",
                url: "URL",
                save: "Save",
                status: t("urlTableAffiliate.statusLabel"),
                view: t("urlTableAffiliate.view"),
                edit: t("urlTableLibrary.edit"),
                delete: t("urlTableAffiliate.deleteRow"),
                daysLeft: t("urlTableAffiliate.daysLeftShort"),
                statusPending: t("urlTableAffiliate.status.pending"),
                statusActive: t("urlTableAffiliate.status.active"),
                statusExpired: t("urlTableAffiliate.status.expired"),
              }}
            />
          )}
        </div>

        <footer className="url-table-page-overlay__footer">
          {viewingEntry ? (
            <>
              <button
                type="button"
                className={
                  "doc-new-action doc-new-action--save url-table-dashboard__save"
                  + (detailSaving ? " doc-new-action--save-loading" : "")
                }
                onClick={() => detailSaveRef.current?.()}
                disabled={saving || deleting || detailSaving}
                aria-busy={detailSaving}
              >
                {detailSaving ? <SearchSpinner size={14} /> : null}
                {detailSaving ? t("urlTableAffiliate.saving") : t("common.save")}
              </button>
              <button
                type="button"
                className="btn xs url-table-page-overlay__delete-btn"
                onClick={() => handleDeleteEntryFromDetail(viewingEntry.id)}
                disabled={saving || deleting || detailSaving}
              >
                {t("urlTableAffiliate.deleteRow")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={
                  "doc-new-action doc-new-action--save url-table-dashboard__save"
                  + (saving ? " doc-new-action--save-loading" : "")
                }
                onClick={handleSave}
                disabled={saving || deleting}
                aria-busy={saving}
              >
                {saving ? <SearchSpinner size={14} /> : null}
                {saving ? t("urlTableAffiliate.saving") : t("common.save")}
              </button>
              {tableId ? (
                <button
                  type="button"
                  className="btn xs url-table-page-overlay__delete-btn"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                >
                  {t("urlTableLibrary.delete")}
                </button>
              ) : null}
            </>
          )}
        </footer>
      </div>
      <MarkLoadingOverlay
        open={saving || detailSaving}
        label={t("urlTableAffiliate.saving")}
      />
    </div>,
    document.body,
  );
}
