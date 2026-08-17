import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Shown when `#i` or `#o` runs before the document exists in the store.
 */
export function LibraryNeedSaveNotice({ onClose }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="folder-library-element-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("doc.library.captureNoOwner")}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.close")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal folder-library-element-modal--capture">
        <header className="folder-library-element-modal__head">
          <h2 className="folder-library-element-modal__title">
            {t("doc.library.title")}
          </h2>
          <button
            type="button"
            className="folder-library-element-modal__close"
            onClick={onClose}
            aria-label={t("doc.library.close")}
          >
            ×
          </button>
        </header>
        <div className="folder-library-element-modal__body folder-library-element-modal__body--capture">
          <p className="library-sets-overlay__need-save">{t("doc.library.captureNoOwner")}</p>
        </div>
        <footer className="folder-library-element-modal__footer">
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
            onClick={onClose}
          >
            {t("doc.library.close")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
