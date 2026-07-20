import { useMemo, useState } from "react";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useUrlTablesStore } from "../../stores/urlTablesStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedUrlTables,
  duplicateUrlTable,
  filterUrlTables,
  removeUrlTableFromDoc,
} from "../../lib/urlTableLibrary.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(table: import("../../lib/urlTableLibrary.js").UrlTableRef) => void} props.onOpenTable
 * @param {() => void} props.onNew
 * @param {(session: import("../../lib/urlTableSession.js").UrlTableSession) => void} [props.onCopied]
 * @param {(payload: { tableId: string, docRemoved: boolean }) => void} [props.onTableDeleted]
 */
export function UrlTableLibraryPanel({
  objectId = null,
  onClose,
  onOpenTable,
  onNew,
  onCopied,
  onTableDeleted,
}) {
  const { t } = useI18n();
  const storeEntries = useUrlTableStore((s) => s.entries);
  const storeTables = useUrlTablesStore((s) => s.tables);
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");

  const tables = useMemo(
    () => collectSavedUrlTables(null, { objectId }),
    [storeEntries, storeTables, objectId],
  );

  const filtered = useMemo(
    () => filterUrlTables(tables, query),
    [tables, query],
  );

  const handleDeleteTable = async (table) => {
    if (!table?.tableId && !table?.id) return;

    const confirmed = await askConfirm({
      title: t("urlTableLibrary.deleteTitle"),
      message: t("urlTableLibrary.deleteConfirm", { title: table.title }),
      confirmLabel: t("urlTableLibrary.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    const { docRemoved } = removeUrlTableFromDoc(table);
    onTableDeleted?.({
      tableId: table.tableId || table.id,
      docRemoved,
    });
  };

  const handleCopyTable = (table) => {
    const session = duplicateUrlTable(table);
    if (session) onCopied?.(session);
  };

  return (
    <div className="lp-pack-import-detail steps-library-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head steps-library-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={onClose}
            aria-label={`Back — ${t("pack.urlTableTitle")}`}
            title={`Back — ${t("pack.urlTableTitle")}`}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
            <span className="lp-click-folder-back-label is-lowercase">
              {t("pack.urlTableTitle")}
            </span>
          </button>
        </div>

        <div className="pack-wizard__body steps-library-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("urlTableLibrary.enterCompanyFirst")}</p>
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
                  />
                </div>
                <button
                  type="button"
                  className="lp-library-new-btn"
                  onClick={onNew}
                >
                  {t("urlTableLibrary.new")}
                </button>
              </div>

              {filtered.length ? (
                <ul className="steps-library-panel__list">
                  {filtered.map((table) => (
                    <li key={table.id} className="steps-library-panel__item">
                      <div className="steps-library-panel__item-main">
                        <div className="steps-library-panel__item-head">
                          <span className="steps-library-panel__item-title">{table.title}</span>
                          <span className="steps-library-panel__item-meta mono-sm">
                            {t("urlTableLibrary.entryCount", { count: table.entryCount })}
                          </span>
                        </div>
                        {table.preview ? (
                          <p className="steps-library-panel__item-preview">{table.preview}</p>
                        ) : null}
                      </div>
                      <div className="steps-library-panel__item-actions">
                        <button
                          type="button"
                          className="btn xs pack-actions__btn pack-actions__btn--toolbar panel-list-open-btn"
                          onClick={() => onOpenTable?.(table)}
                        >
                          {t("common.open")}
                        </button>
                        <button
                          type="button"
                          className="btn xs pack-actions__btn pack-actions__btn--toolbar"
                          onClick={() => handleCopyTable(table)}
                        >
                          {t("urlTableLibrary.copy")}
                        </button>
                        <button
                          type="button"
                          className="steps-library-panel__delete-btn"
                          onClick={() => handleDeleteTable(table)}
                        >
                          {t("urlTableLibrary.delete")}
                        </button>
                      </div>
                    </li>
                  ))}
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
