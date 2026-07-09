import { useMemo, useState } from "react";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedUrlTables,
  filterUrlTables,
  removeUrlTableFromDoc,
} from "../../lib/urlTableLibrary.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(table: import("../../lib/urlTableLibrary.js").UrlTableRef) => void} props.onOpenTable
 * @param {() => void} props.onNew
 * @param {(payload: { docId: string, blockId: string, docRemoved: boolean }) => void} [props.onTableDeleted]
 */
export function UrlTableLibraryPanel({
  objectId = null,
  onClose,
  onOpenTable,
  onNew,
  onTableDeleted,
}) {
  const { t } = useI18n();
  const storeEntries = useUrlTableStore((s) => s.entries);
  const askConfirm = useConfirmStore((s) => s.ask);
  const [query, setQuery] = useState("");

  const tables = useMemo(
    () => collectSavedUrlTables(null, { objectId }),
    [storeEntries, objectId],
  );

  const filtered = useMemo(
    () => filterUrlTables(tables, query),
    [tables, query],
  );

  const handleDeleteTable = async (table) => {
    if (!table?.objectId) return;

    const confirmed = await askConfirm({
      title: t("urlTableLibrary.deleteTitle"),
      message: t("urlTableLibrary.deleteConfirm", { title: table.title }),
      confirmLabel: t("urlTableLibrary.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;

    const { docRemoved } = removeUrlTableFromDoc(table);
    onTableDeleted?.({
      docId: table.docId,
      blockId: table.blockId,
      docRemoved,
    });
  };

  return (
    <div className="lp-pack-import-detail steps-library-panel">
      <div className="pack-wizard pack-wizard--panel">
        <div className="lp-workspace-head steps-library-panel__head">
          <button
            type="button"
            className="lp-click-folder-back lp-click-folder-back--inline"
            onClick={onClose}
            aria-label={t("common.back")}
            title={t("common.back")}
          >
            <span className="lp-click-folder-back-icon" aria-hidden />
          </button>
          <h3 className="pack-wizard__title steps-library-panel__title">{t("pack.urlTableTitle")}</h3>
        </div>

        <div className="pack-wizard__body steps-library-panel__body">
          {!objectId ? (
            <p className="pack-wizard__lead">{t("urlTableLibrary.enterCompanyFirst")}</p>
          ) : (
            <>
              <div className="steps-library-panel__toolbar">
                <input
                  type="search"
                  className="steps-library-panel__search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("urlTableLibrary.searchPlaceholder")}
                  aria-label={t("urlTableLibrary.searchPlaceholder")}
                />
                <button
                  type="button"
                  className="btn xs workspace-action-btn steps-library-panel__new-btn"
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
