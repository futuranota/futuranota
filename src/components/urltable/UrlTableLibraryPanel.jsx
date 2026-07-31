import { useMemo, useState } from "react";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useUrlTablesStore } from "../../stores/urlTablesStore.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  collectSavedUrlTables,
  filterUrlTables,
} from "../../lib/urlTableLibrary.js";

/**
 * @param {Object} props
 * @param {string|null} props.objectId
 * @param {() => void} props.onClose
 * @param {(table: import("../../lib/urlTableLibrary.js").UrlTableRef) => void} props.onOpenTable
 * @param {() => void} props.onNew
 */
export function UrlTableLibraryPanel({
  objectId = null,
  onClose,
  onOpenTable,
  onNew,
}) {
  const { t } = useI18n();
  const storeEntries = useUrlTableStore((s) => s.entries);
  const storeTables = useUrlTablesStore((s) => s.tables);
  const [query, setQuery] = useState("");

  const tables = useMemo(
    () => collectSavedUrlTables(null, { objectId }),
    [storeEntries, storeTables, objectId],
  );

  const filtered = useMemo(
    () => filterUrlTables(tables, query),
    [tables, query],
  );

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
                    <li key={table.id} className="steps-library-panel__row">
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
                        </span>
                        <span className="steps-library-panel__card-chevron" aria-hidden>
                          ›
                        </span>
                      </button>
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
