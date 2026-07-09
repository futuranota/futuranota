import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LinkVaultBlockView } from "../docs/blocks/LinkVaultBlockView.jsx";
import { useI18n } from "../../i18n/useI18n.js";

/**
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

  const handleSave = () => {
    onSaved?.(session.entries);
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
            multilineDescription
            hideAddButton
            addFormRequest={addFormRequest}
            filterQuery={query}
            labels={{ name: "Name", description: "Description", url: "URL", save: "Save" }}
          />
        </div>

        <footer className="url-table-page-overlay__footer">
          <button
            type="button"
            className="doc-new-action doc-new-action--save url-table-dashboard__save"
            onClick={handleSave}
          >
            {t("common.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
