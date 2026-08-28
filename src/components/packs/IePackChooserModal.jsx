import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Admin hub: Import pack, Export pack, or Export all.
 *
 * @param {{
 *   onClose?: () => void,
 *   onImport?: () => void,
 *   onExport?: () => void,
 *   onExportAll?: () => void,
 * }} props
 */
export function IePackChooserModal({ onClose, onImport, onExport, onExportAll }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      className="ie-pack-chooser"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ie-pack-chooser-title"
    >
      <button
        type="button"
        className="ie-pack-chooser__backdrop"
        aria-label={t("common.cancel")}
        onClick={() => onClose?.()}
      />
      <div className="ie-pack-chooser__card">
        <button
          type="button"
          className="ie-pack-chooser__close"
          onClick={() => onClose?.()}
          aria-label={t("common.cancel")}
        >
          ×
        </button>
        <h2 id="ie-pack-chooser-title" className="ie-pack-chooser__title">
          {t("pack.iePackTitle")}
        </h2>
        <p className="ie-pack-chooser__subtitle">{t("pack.iePackSubtitle")}</p>
        <div className="ie-pack-chooser__actions">
          <button
            type="button"
            className="ie-pack-chooser__btn"
            onClick={() => {
              onClose?.();
              onImport?.();
            }}
          >
            {t("pack.importPack")}
          </button>
          <button
            type="button"
            className="ie-pack-chooser__btn"
            onClick={() => {
              onClose?.();
              onExport?.();
            }}
          >
            {t("pack.exportPack")}
          </button>
          <button
            type="button"
            className="ie-pack-chooser__btn ie-pack-chooser__btn--primary"
            onClick={() => {
              onClose?.();
              onExportAll?.();
            }}
          >
            {t("pack.exportAll")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
