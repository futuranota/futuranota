import { useEffect } from "react";
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

  return createPortal(
    <div
      className="step-playbook-dashboard-overlay step-playbook-dashboard-overlay--url-table"
      role="dialog"
      aria-modal="true"
      aria-label={t("pack.urlTableTitle")}
    >
      <div
        className="step-playbook-dashboard-overlay__backdrop"
        aria-hidden
      />
      <div className="step-playbook-dashboard-overlay__card">
        <button
          type="button"
          className="step-playbook-dashboard-overlay__close"
          onClick={onCloseTab}
          aria-label={t("urlTableLibrary.closeTab")}
          title={t("urlTableLibrary.closeTab")}
        >
          ×
        </button>
        <div className="step-playbook-dashboard-overlay__body scroll-match-bg url-table-dashboard">
          <div className="url-table-dashboard__title-wrap">
            <label className="doc-step-sequence__title-label" htmlFor="url-table-title">
              {t("pack.urlTableTitle")}
            </label>
            <input
              id="url-table-title"
              className="doc-step-sequence__title-input"
              type="text"
              value={session.title}
              placeholder={t("urlTableLibrary.titlePlaceholder")}
              onChange={(e) => onChange({ title: e.target.value, saved: false })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <LinkVaultBlockView
            entries={session.entries}
            onEntriesChange={(entries) => onChange({ entries, saved: false })}
            multilineDescription
            labels={{ name: "Name", description: "Description", url: "URL", save: "Save" }}
          />

          <div className="url-table-dashboard__footer">
            <button
              type="button"
              className="doc-new-action doc-new-action--save url-table-dashboard__save"
              onClick={handleSave}
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
