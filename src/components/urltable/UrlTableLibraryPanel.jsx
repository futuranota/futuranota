import { useMemo, useState } from "react";
import { useUrlTableStore } from "../../stores/urlTableStore.js";
import { useUrlTablesStore } from "../../stores/urlTablesStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
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
 * @param {(kind?: 'links'|'affiliates') => void} props.onNew
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
  const isPro = usePlanStore((s) => s.isPro());
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);
  const [query, setQuery] = useState("");
  const [choosingKind, setChoosingKind] = useState(false);

  const tables = useMemo(
    () => collectSavedUrlTables(null, { objectId }),
    [storeEntries, storeTables, objectId],
  );

  const filtered = useMemo(
    () => filterUrlTables(tables, query),
    [tables, query],
  );

  const handlePickKind = (kind) => {
    if (kind === "affiliates" && !isPro) {
      showUpgradeModal("url_table_affiliate");
      return;
    }
    setChoosingKind(false);
    onNew?.(kind);
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
                  />
                </div>
                <button
                  type="button"
                  className="lp-library-new-btn"
                  onClick={() => setChoosingKind(true)}
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
                          {table.kind === "affiliates" ? (
                            <span className="url-table-library-kind-badge">
                              {t("urlTableLibrary.kindAffiliates")}
                            </span>
                          ) : null}
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
