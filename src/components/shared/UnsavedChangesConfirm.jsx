import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Yes/no card shown before closing an editor with unsaved changes.
 * @param {{ open: boolean, promptKey?: string, titleId?: string, onYes: () => void, onNo: () => void }} props
 */
export function UnsavedChangesConfirm({
  open,
  promptKey = "docPrompt",
  titleId = "unsaved-confirm-title",
  onYes,
  onNo,
}) {
  const { t } = useI18n();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="doc-unsaved-confirm-overlay" role="presentation">
      <div
        className="doc-unsaved-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <p id={titleId} className="doc-unsaved-confirm__text">
          {t(`unsavedChanges.${promptKey}`)}
        </p>
        <div className="doc-unsaved-confirm__actions">
          <button
            type="button"
            className="doc-unsaved-confirm__btn doc-unsaved-confirm__btn--yes"
            onClick={onYes}
          >
            {t("unsavedChanges.yes")}
          </button>
          <button
            type="button"
            className="doc-unsaved-confirm__btn"
            onClick={onNo}
          >
            {t("unsavedChanges.no")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
