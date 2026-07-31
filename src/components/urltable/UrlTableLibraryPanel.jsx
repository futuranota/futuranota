import { useCallback, useMemo, useState } from "react";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useUrlTablesStore } from "../../stores/urlTablesStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedUrlTables,
  filterUrlTables,
  removeUrlTableFromDoc,
} from "../../lib/urlTableLibrary.js";
import { flushUrlTableSync } from "../../lib/urlTableSync.js";
import { flushUrlTablesSync } from "../../lib/urlTablesSync.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(table: import("../../lib/urlTableLibrary.js").UrlTableRef) => void} props.onOpenTable
 * @param {(kind?: 'links'|'affiliates') => void} props.onNew
 * @param {(ids: string[]) => void} [props.onTablesDeleted]
 */
export function UrlTableLibraryPanel({
  objectId = null,
  onClose,
  onOpenTable,
  onNew,
  onTablesDeleted,
}) {
  const { t } = useI18n();
  const storeEntries = useUrlTableStore((s) => s.entries);
  const storeTables = useUrlTablesStore((s) => s.tables);
  const isPro = usePlanStore((s) => s.isPro());
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");
  const [choosingKind, setChoosingKind] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const tables = useMemo(
    () => collectSavedUrlTables(null, { objectId }),
    [storeEntries, storeTables, objectId],
  );

  const filtered = useMemo(
    () => filterUrlTables(tables, query),
    [tables, query],
  );

  const exitBulkSelectMode = useCallback(() => {
    setBulkSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectMode((active) => {
      if (active) {
        setSelectedIds([]);
        return false;
      }
      setSelectedIds([]);
      return true;
    });
  }, []);

  const toggleSelect = useCallback((id) => {
    if (!id) return;
    setSelectedIds((prev) => (
      prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
    ));
  }, []);

  const handlePickKind = (kind) => {
    if (kind === "affiliates" && !isPro) {
      showUpgradeModal("url_table_affiliate");
      return;
    }
    setChoosingKind(false);
    onNew?.(kind);
  };

  const handleDeleteSelected = async () => {
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) return;
    const confirmed = await askConfirm({
      title: t("urlTableLibrary.deleteSelectedTitle"),
      message: t("urlTableLibrary.deleteSelectedConfirm", { count: ids.length }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    const selected = filtered.filter((table) => ids.includes(table.id));
    for (const table of selected) {
      removeUrlTableFromDoc(table);
    }
    Promise.all([flushUrlTableSync(), flushUrlTablesSync()]).catch((err) => {
      console.warn("[url-table] flush after bulk library delete failed", err);
    });
    onTablesDeleted?.(selected.map((table) => table.tableId || table.id).filter(Boolean));
    exitBulkSelectMode();
  };

  const stopBubble = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="lp-pack-import-detail steps-library-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head steps-library-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={() => {
              if (choosingKind) {
                setChoosingKind(false);
                return;
              }
              if (bulkSelectMode) {
                exitBulkSelectMode();
                return;
              }
              onClose?.();
            }}
            aria-label={`Back — ${t("pack.urlTableTitle")}`}
            title={`Back — ${t("pack.urlTableTitle")}`}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
            <span className="lp-click-folder-back-label is-lowercase">
              {choosingKind
                ? t("urlTableLibrary.chooseTypeBack")
                : t("pack.urlTableTitle")}
            </span>
          </button>
          {objectId && !choosingKind ? (
            <button
              type="button"
              className={
                "lp-folder-density__btn lp-folder-select-btn"
                + (bulkSelectMode ? " is-active" : "")
              }
              onClick={toggleBulkSelectMode}
              title={
                bulkSelectMode
                  ? t("urlTableLibrary.selectActive")
                  : t("urlTableLibrary.selectTitle")
              }
              aria-label={t("urlTableLibrary.selectTitle")}
              aria-pressed={bulkSelectMode}
            >
              {t("urlTableLibrary.select")}
            </button>
          ) : null}
        </div>

        <div className="pack-wizard__body steps-library-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("urlTableLibrary.enterCompanyFirst")}</p>
          ) : choosingKind ? (
            <div className="url-table-kind-chooser">
              <p className="url-table-kind-chooser__lead">
                {t("urlTableLibrary.chooseTypeLead")}
              </p>
              <div className="url-table-kind-chooser__options">
                <button
                  type="button"
                  className="url-table-kind-chooser__card"
                  onClick={() => handlePickKind("links")}
                >
                  <span className="url-table-kind-chooser__card-title">
                    {t("urlTableLibrary.kindLinks")}
                  </span>
                  <span className="url-table-kind-chooser__card-body">
                    {t("urlTableLibrary.kindLinksHint")}
                  </span>
                </button>
                <button
                  type="button"
                  className="url-table-kind-chooser__card url-table-kind-chooser__card--affiliates"
                  onClick={() => handlePickKind("affiliates")}
                >
                  <span className="url-table-kind-chooser__card-title">
                    {t("urlTableLibrary.kindAffiliates")}
                    <span className="url-table-kind-chooser__pro">Pro</span>
                  </span>
                  <span className="url-table-kind-chooser__card-body">
                    {t("urlTableLibrary.kindAffiliatesHint")}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="lp-library-toolbar">
                <div className="lp-library-search-wrap">
                  <span className="lp-library-search-icon" aria-hidden />
                  <input
                    type="search"
                    className="lp-library-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("urlTableLibrary.searchTablesPlaceholder")}
                    aria-label={t("urlTableLibrary.searchTablesPlaceholder")}
                    onKeyDown={stopBubble}
                    onKeyUp={stopBubble}
                    onMouseDown={stopBubble}
                  />
                </div>
                <button
                  type="button"
                  className="lp-library-new-btn"
                  onClick={() => setChoosingKind(true)}
                  disabled={bulkSelectMode}
                >
                  {t("urlTableLibrary.new")}
                </button>
              </div>

              {bulkSelectMode ? (
                <div className="lp-folder-bulk-bar" role="status">
                  <span className="lp-folder-bulk-bar__count">
                    {t("urlTableLibrary.selectCount", { count: selectedIds.length })}
                  </span>
                  <div className="lp-folder-bulk-bar__actions">
                    <button
                      type="button"
                      className="btn xs ghost"
                      onClick={exitBulkSelectMode}
                    >
                      {t("urlTableLibrary.selectDone")}
                    </button>
                    <button
                      type="button"
                      className="btn xs lp-folder-bulk-bar__delete"
                      disabled={selectedIds.length === 0}
                      onClick={handleDeleteSelected}
                    >
                      {t("urlTableLibrary.deleteSelected")}
                    </button>
                  </div>
                </div>
              ) : null}

              {filtered.length ? (
                <ul
                  className={
                    "steps-library-panel__list"
                    + (bulkSelectMode ? " steps-library-panel__list--selecting" : "")
                  }
                >
                  {filtered.map((table) => {
                    const selected = selectedIds.includes(table.id);
                    return (
                      <li
                        key={table.id}
                        className={
                          "steps-library-panel__row"
                          + (bulkSelectMode ? " steps-library-panel__row--select-mode" : "")
                          + (selected ? " is-selected" : "")
                        }
                      >
                        {bulkSelectMode ? (
                          <button
                            type="button"
                            className={
                              "steps-library-panel__card steps-library-panel__card--select"
                              + (selected ? " is-selected" : "")
                            }
                            onClick={() => toggleSelect(table.id)}
                            aria-pressed={selected}
                          >
                            <span
                              className={
                                "lp-doc-nodes-block__check"
                                + (selected ? " is-checked" : "")
                              }
                              aria-hidden
                            />
                            <img
                              src="/uploads/url-table.svg"
                              alt=""
                              aria-hidden
                              className="steps-library-panel__card-icon"
                            />
                            <span className="steps-library-panel__card-body">
                              <span className="steps-library-panel__card-title">
                                {table.title}
                              </span>
                              {table.kind === "affiliates" ? (
                                <span className="url-table-library-kind-badge">
                                  {t("urlTableLibrary.libraryAffiliatesBadge")}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="steps-library-panel__card"
                            onClick={() => onOpenTable?.(table)}
                          >
                            <img
                              src="/uploads/url-table.svg"
                              alt=""
                              aria-hidden
                              className="steps-library-panel__card-icon"
                            />
                            <span className="steps-library-panel__card-body">
                              <span className="steps-library-panel__card-title">
                                {table.title}
                              </span>
                              {table.kind === "affiliates" ? (
                                <span className="url-table-library-kind-badge">
                                  {t("urlTableLibrary.libraryAffiliatesBadge")}
                                </span>
                              ) : null}
                            </span>
                            <span className="steps-library-panel__card-chevron" aria-hidden>
                              ›
                            </span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="lp-empty steps-library-panel__empty">
                  <p>{t("urlTableLibrary.emptyTitle")}</p>
                  <p className="dim">{t("urlTableLibrary.emptyHint")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
