import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { AffiliateEntryList } from "./AffiliateEntryList.jsx";
import { AFFILIATE_EMPTY_DRAFT } from "./AffiliateEntryCard.jsx";
import { UrlTableEntryDetailView } from "./UrlTableEntryDetailView.jsx";
import { MarkLoadingOverlay } from "../shared/MarkLoading.jsx";
import { SearchSpinner } from "../shared/SearchSpinner.jsx";
import { createLinkEntry } from "../../lib/vaultBlocks.js";
import {
  affiliateDraftToLinkEntry,
  linkEntryToAffiliateDraft,
  mergeAffiliateDraftAndStaging,
} from "../../lib/affiliateEntryDraft.js";
import { queueUrlTableEntry } from "../../lib/urlTableSession.js";
import {
  filterUrlTableEntries,
  filterUrlTableEntriesByCategory,
  removeUrlTableFromDoc,
  uniqueUrlTableCategories,
} from "../../lib/urlTableLibrary.js";
import { flushUrlTableSync, markUrlTableEntryDeleted } from "../../lib/urlTableSync.js";
import { flushUrlTablesSync } from "../../lib/urlTablesSync.js";
import { withResolvedAffiliateLifecycle } from "../../lib/urlTableAffiliate.js";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";

const TITLE_MIN_CH = 12;
const TITLE_MAX_CH = 42;

/**
 * @param {import("../../lib/vaultBlocks.js").LinkEntry[]} sessionEntries
 * @param {import("../../lib/vaultBlocks.js").LinkEntry} link
 */
function upsertSessionEntry(sessionEntries, link) {
  const exists = sessionEntries.some((item) => item.id === link.id);
  return exists
    ? sessionEntries.map((item) => (item.id === link.id ? link : item))
    : [...sessionEntries, link];
}

export function UrlTableDashboardOverlay({
  session,
  onChange,
  onCloseTab,
  onSaved,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [addFormRequest, setAddFormRequest] = useState(0);
  const [draft, setDraft] = useState(AFFILIATE_EMPTY_DRAFT);
  const [panelMode, setPanelMode] = useState(/** @type {'queue'|'create'|'edit'} */ ("queue"));
  const [detailMode, setDetailMode] = useState(/** @type {null|'stats'|'calculator'} */ (null));
  const [stagingEntry, setStagingEntry] = useState(/** @type {import("../../lib/vaultBlocks.js").LinkEntry|null} */ (null));
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewEntryId, setViewEntryId] = useState(null);
  const draftRef = useRef(draft);
  const detailEntryRef = useRef(null);
  const confirmOpenRef = useRef(false);
  draftRef.current = draft;

  const sessionKey = session
    ? `${session.objectId ?? ""}:${session.tableId ?? ""}:${session.blockId}`
    : "";

  const initialSearch = String(session?.initialSearch ?? "");

  const resetAffiliateEditor = () => {
    setDraft(AFFILIATE_EMPTY_DRAFT);
    setPanelMode("queue");
    setDetailMode(null);
    setStagingEntry(null);
    setEditingEntryId(null);
    setViewEntryId(null);
  };

  useEffect(() => {
    resetAffiliateEditor();
    setQuery(initialSearch);
    setCategoryFilter("");
    setSaving(false);
  }, [sessionKey, initialSearch]);

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
    if (!session) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (viewEntryId) {
        if (detailMode === "stats") {
          setViewEntryId(null);
          setDetailMode(null);
          setPanelMode("queue");
        } else {
          const synced = detailEntryRef.current?.();
          if (synced) {
            setStagingEntry(synced);
            setDraft(linkEntryToAffiliateDraft(synced));
          }
          setViewEntryId(null);
          setDetailMode(null);
        }
        return;
      }
      if (session.kind === "affiliates" && (panelMode === "create" || panelMode === "edit")) {
        resetAffiliateEditor();
        return;
      }
      onCloseTab?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseTab, viewEntryId, detailMode, panelMode, session]);

  if (!session) return null;

  const objectId = session.objectId;
  const tableId = session.tableId;
  const isAffiliateTable = session.kind === "affiliates";
  const affiliatesTitle = t("urlTableLibrary.affiliatesTitle");
  const titleLabel = isAffiliateTable
    ? affiliatesTitle
    : (String(session.title ?? "").trim() || t("pack.urlTableTitle"));
  const titleValue = session.title ?? "";
  const titlePlaceholder = t("urlTableLibrary.titlePlaceholder");
  const titleWidthCh = Math.min(
    Math.max(titleValue.length || titlePlaceholder.length, TITLE_MIN_CH),
    TITLE_MAX_CH,
  );
  const categoryOptions = uniqueUrlTableCategories(session.entries || []);
  const visibleAffiliateEntries = (() => {
    if (!isAffiliateTable) return session.entries || [];
    const byCategory = filterUrlTableEntriesByCategory(session.entries || [], categoryFilter);
    return filterUrlTableEntries(byCategory, query);
  })();

  const viewingEntry = viewEntryId
    ? (stagingEntry?.id === viewEntryId ? stagingEntry : null)
      || (session.entries || []).find((entry) => entry.id === viewEntryId)
    : null;

  const commitDraftIfReady = (currentEntries) => currentEntries;

  const persistAffiliateEntry = async (entry) => {
    if (!objectId || !entry?.id) return null;
    const stored = queueUrlTableEntry(objectId, entry, tableId);
    if (!stored) return null;
    const link = createLinkEntry(stored);
    const sessionEntries = session?.entries || [];
    onChange?.({
      tableId: stored.tableId || tableId,
      entries: upsertSessionEntry(sessionEntries, link),
      saved: true,
    });
    try {
      await Promise.all([flushUrlTableSync(), flushUrlTablesSync()]);
    } catch (err) {
      console.warn("[url-table] affiliate flush failed", err);
    }
    return link;
  };

  const handleImmersiveClose = () => {
    resetAffiliateEditor();
  };

  const affiliateQueueView = isAffiliateTable && panelMode === "queue" && !viewEntryId;
  const affiliateImmersive = isAffiliateTable && !affiliateQueueView;

  const showAffiliateShellHeader = !isAffiliateTable || affiliateQueueView;

  const showAffiliateHeaderSearch = affiliateQueueView;

  const handleSaveEntry = (entry) => {
    if (!objectId) {
      console.warn("[url-table] Row Save skipped: missing company objectId");
      return null;
    }
    const stored = queueUrlTableEntry(objectId, entry, tableId);
    if (!stored) return null;
    const sessionEntries = session?.entries || [];
    const link = createLinkEntry(stored);
    const nextEntries = upsertSessionEntry(sessionEntries, link);
    onChange?.({
      tableId: stored.tableId || tableId,
      entries: nextEntries,
      saved: true,
    });
    return stored;
  };

  const handleDeleteEntry = (entryId) => {
    if (!entryId) return;
    if (viewEntryId === entryId) {
      setViewEntryId(null);
      setDetailMode(null);
    }
    if (stagingEntry?.id === entryId) setStagingEntry(null);
    if (editingEntryId === entryId) setEditingEntryId(null);
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

  const handleDeleteEntryWithConfirm = async (entryId) => {
    if (!entryId || deleting || saving) return;
    const name = String(
      (session.entries || []).find((entry) => entry.id === entryId)?.name
      ?? stagingEntry?.name
      ?? "",
    ).trim() || t("urlTableAffiliate.untitled");
    const confirmed = await askConfirm({
      title: t("urlTableAffiliate.deleteRow"),
      message: t("urlTableLibrary.deleteConfirm", { title: name }),
      confirmLabel: t("urlTableAffiliate.deleteRow"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    handleDeleteEntry(entryId);
    if (panelMode === "edit" && editingEntryId === entryId) {
      resetAffiliateEditor();
    }
  };

  const handleViewStats = (entry) => {
    if (!entry?.id) return;
    setViewEntryId(entry.id);
    setDetailMode("stats");
    setPanelMode("queue");
  };

  const handleStartEdit = (entry) => {
    if (!entry?.id) return;
    const link = createLinkEntry(entry);
    setViewEntryId(null);
    setDetailMode(null);
    setPanelMode("edit");
    setEditingEntryId(entry.id);
    setStagingEntry(link);
    setDraft(linkEntryToAffiliateDraft(link));
  };

  const handleStartCreate = () => {
    setViewEntryId(null);
    setDetailMode(null);
    setPanelMode("create");
    setEditingEntryId(null);
    setStagingEntry(null);
    setDraft(AFFILIATE_EMPTY_DRAFT);
  };

  const handleNextFromEditor = () => {
    const entry = mergeAffiliateDraftAndStaging(
      draftRef.current,
      stagingEntry,
      editingEntryId,
    );
    setStagingEntry(entry);
    setViewEntryId(entry.id);
    setDetailMode("calculator");
  };

  const handleBackFromDetail = () => {
    if (detailMode === "stats") {
      setViewEntryId(null);
      setDetailMode(null);
      setPanelMode("queue");
      return;
    }

    const synced = detailEntryRef.current?.() || stagingEntry;
    if (synced) {
      setStagingEntry(synced);
      setDraft(linkEntryToAffiliateDraft(synced));
    }
    setViewEntryId(null);
    setDetailMode(null);
  };

  const handleSaveEntryDetail = async (nextEntry) => {
    if (!nextEntry?.id) return;
    setSaving(true);
    try {
      const entry = mergeAffiliateDraftAndStaging(
        draftRef.current,
        nextEntry,
        nextEntry.id,
      );
      const link = await persistAffiliateEntry(entry);
      if (!link) throw new Error("Failed to persist affiliate row");
      resetAffiliateEditor();
    } finally {
      setSaving(false);
    }
  };

  const handlePersistEntryKeepOpen = async (nextEntry) => {
    if (!nextEntry?.id) return null;
    const entry = mergeAffiliateDraftAndStaging(
      draftRef.current,
      nextEntry,
      nextEntry.id,
    );
    const link = await persistAffiliateEntry(entry);
    if (!link) throw new Error("Failed to persist affiliate row");
    setStagingEntry(link);
    return link;
  };

  const handleSave = async () => {
    if (saving || deleting) return;
    if (!objectId) {
      console.warn("[url-table] Footer Save skipped: missing company objectId");
      return;
    }
    setSaving(true);
    try {
      const nextEntries = commitDraftIfReady(session.entries || []);
      onChange?.({
        entries: nextEntries,
        title: isAffiliateTable ? affiliatesTitle : session.title,
        saved: false,
      });
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
    if (isAffiliateTable) {
      handleStartCreate();
      return;
    }
    setViewEntryId(null);
    setAddFormRequest((value) => value + 1);
  };

  const affiliateLabels = {
    name: t("urlTableAffiliate.businessName"),
    namePlaceholder: t("urlTableAffiliate.businessNamePlaceholder"),
    tag: t("urlTableAffiliate.tag"),
    category: t("urlTableAffiliate.category"),
    description: t("urlTableAffiliate.description"),
    url: t("urlTableAffiliate.url"),
    urlOptional: t("urlTableAffiliate.urlOptional"),
    requirements: t("urlTableAffiliate.requirements"),
    requirementsPlaceholder: t("urlTableAffiliate.requirementsPlaceholder"),
    status: t("urlTableAffiliate.statusLabel"),
    next: t("urlTableAffiliate.next"),
    newTile: t("urlTableAffiliate.newTile"),
    stats: t("urlTableAffiliate.stats"),
    edit: t("urlTableAffiliate.edit"),
    delete: t("urlTableAffiliate.deleteRow"),
    statusPending: t("urlTableAffiliate.status.pending"),
    statusActive: t("urlTableAffiliate.status.active"),
    statusExpired: t("urlTableAffiliate.status.expired"),
  };

  return createPortal(
    <div
      className={
        "url-table-page-overlay"
        + (affiliateImmersive ? " url-table-page-overlay--affiliate-immersive" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-label={titleLabel}
    >
      <div className="url-table-page-overlay__backdrop" aria-hidden />
      <div
        className={
          "url-table-page-overlay__shell"
          + (affiliateImmersive ? " url-table-page-overlay__shell--affiliate-immersive" : "")
        }
      >
        {showAffiliateShellHeader ? (
        <header className="url-table-page-overlay__header">
          {isAffiliateTable ? (
            <h2 className="url-table-page-overlay__title">{affiliatesTitle}</h2>
          ) : (
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
          )}
          {showAffiliateHeaderSearch ? (
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
            {!viewEntryId && !isAffiliateTable ? (
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
        ) : null}

        <div
          className={
            "url-table-page-overlay__body scroll-match-bg url-table-dashboard"
            + (affiliateImmersive ? " url-table-page-overlay__body--affiliate-immersive" : "")
          }
        >
          {viewingEntry ? (
            <UrlTableEntryDetailView
              entry={viewingEntry}
              mode={detailMode === "stats" ? "stats" : "calculator"}
              onSave={handleSaveEntryDetail}
              onPersist={handlePersistEntryKeepOpen}
              onBack={handleBackFromDetail}
              onClose={affiliateImmersive ? handleImmersiveClose : null}
              immersive={affiliateImmersive}
              entrySnapshotRef={detailEntryRef}
            />
          ) : isAffiliateTable ? (
            <>
              {panelMode === "queue" && categoryOptions.length ? (
                <div className="affiliate-category-chips" role="tablist" aria-label={t("urlTableAffiliate.category")}>
                  <button
                    type="button"
                    className={
                      "affiliate-category-chips__chip"
                      + (!categoryFilter ? " is-active" : "")
                    }
                    onClick={() => setCategoryFilter("")}
                  >
                    {t("urlTableLibrary.categoryFilterAll")}
                  </button>
                  {categoryOptions.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={
                        "affiliate-category-chips__chip"
                        + (categoryFilter.toLowerCase() === category.toLowerCase() ? " is-active" : "")
                      }
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              ) : null}
              <AffiliateEntryList
                panelMode={panelMode}
                entries={visibleAffiliateEntries}
                draft={draft}
                onDraftChange={setDraft}
                onStartCreate={handleStartCreate}
                onStartEdit={handleStartEdit}
                onViewStats={handleViewStats}
                onDeleteEntry={objectId ? handleDeleteEntryWithConfirm : null}
                onNext={handleNextFromEditor}
                onClose={handleImmersiveClose}
                objectId={objectId}
                tableId={tableId}
                labels={affiliateLabels}
              />
            </>
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
              showRowView={false}
              labels={{
                name: "Title",
                namePlaceholder: "Title",
                tag: "Tag",
                category: "Category",
                description: "Description",
                url: "URL",
                save: "Save",
                status: t("urlTableAffiliate.statusLabel"),
                view: t("urlTableAffiliate.view"),
                edit: t("urlTableLibrary.edit"),
                delete: t("urlTableAffiliate.deleteRow"),
              }}
            />
          )}
        </div>

        {!isAffiliateTable ? (
        <footer className="url-table-page-overlay__footer">
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
        </footer>
        ) : null}
      </div>
      <MarkLoadingOverlay
        open={!isAffiliateTable && saving}
        label={t("urlTableAffiliate.saving")}
      />
    </div>,
    document.body,
  );
}
