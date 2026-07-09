import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PasswordVaultBlockView } from "../docs/blocks/PasswordVaultBlockView.jsx";
import { useI18n } from "../../i18n/useI18n.js";

/**
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
            hideAddButton
            addFormRequest={addFormRequest}
            filterQuery={query}
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
          >
            {t("common.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
