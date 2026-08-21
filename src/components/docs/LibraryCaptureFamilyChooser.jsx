import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * After `--prompt--` closes: pick Assets (existing capture modal) or Step by step.
 */
export function LibraryCaptureFamilyChooser({
  promptPreview = "",
  canSteps = true,
  error = "",
  onPickAssets,
  onPickSteps,
  onClose,
}) {
  const { t } = useI18n();
  const preview = String(promptPreview || "").trim();

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
      aria-label={t("doc.library.captureFamilyTitle")}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.cancel")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal folder-library-element-modal--capture-family">
        <header className="folder-library-element-modal__head">
          <h2 className="folder-library-element-modal__title">
            {t("doc.library.captureFamilyTitle")}
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

        <div className="folder-library-element-modal__body folder-library-element-modal__body--capture-family">
          {preview ? (
            <p className="library-capture-family__preview">{preview}</p>
          ) : null}
          {error ? (
            <p className="library-capture-family__error" role="alert">{error}</p>
          ) : null}
          <div className="library-capture-family__choices" role="group">
            <button
              type="button"
              className="library-capture-family__choice"
              onClick={onPickAssets}
            >
              <img
                className="library-capture-family__choice-icon"
                src="/uploads/assets.svg"
                alt=""
                aria-hidden
                draggable={false}
              />
              <span className="library-capture-family__choice-label">
                {t("doc.library.captureFamilyAssets")}
              </span>
              <span className="library-capture-family__choice-hint">
                {t("doc.library.captureFamilyAssetsHint")}
              </span>
            </button>
            <button
              type="button"
              className="library-capture-family__choice"
              onClick={onPickSteps}
              disabled={!canSteps}
              title={
                canSteps
                  ? t("doc.library.captureFamilyStepsHint")
                  : t("doc.library.captureFamilyStepsUnavailable")
              }
            >
              <img
                className="library-capture-family__choice-icon"
                src="/uploads/TreeStructure.svg"
                alt=""
                aria-hidden
                draggable={false}
              />
              <span className="library-capture-family__choice-label">
                {t("doc.library.captureFamilySteps")}
              </span>
              <span className="library-capture-family__choice-hint">
                {canSteps
                  ? t("doc.library.captureFamilyStepsHint")
                  : t("doc.library.captureFamilyStepsUnavailable")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
