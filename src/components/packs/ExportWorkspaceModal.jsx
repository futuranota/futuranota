import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";

/**
 * Preview art for the export-all card. Swap this path when the final image is ready.
 * Empty string → placeholder panel.
 */
export const EXPORT_WORKSPACE_PREVIEW_SRC = "";

/**
 * Intro card before running a full workspace export.
 * CTA is wired later to folder-tree ZIP; for now optional onExportAll.
 *
 * @param {{
 *   onClose?: () => void,
 *   onExportAll?: () => void | Promise<void>,
 *   previewSrc?: string,
 * }} props
 */
export function ExportWorkspaceModal({
  onClose,
  onExportAll,
  previewSrc = EXPORT_WORKSPACE_PREVIEW_SRC,
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasPreview = Boolean(String(previewSrc || "").trim());

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!busy) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, busy]);

  const handleExportAll = async () => {
    if (busy) return;
    setError("");
    if (typeof onExportAll !== "function") {
      setError(t("pack.exportAllSoon"));
      return;
    }
    setBusy(true);
    try {
      await onExportAll();
    } catch (err) {
      console.error("[exportWorkspaceModal]", err);
      setError(err?.message || t("pack.exportAllFailed"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="export-workspace-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-workspace-modal-title"
    >
      <button
        type="button"
        className="export-workspace-modal__backdrop"
        aria-label={t("common.cancel")}
        onClick={() => {
          if (!busy) onClose?.();
        }}
      />
      <div className="export-workspace-modal__card">
        <button
          type="button"
          className="export-workspace-modal__close"
          onClick={() => {
            if (!busy) onClose?.();
          }}
          aria-label={t("common.cancel")}
          disabled={busy}
        >
          ×
        </button>

        <header className="export-workspace-modal__header">
          <h2 id="export-workspace-modal-title" className="export-workspace-modal__title">
            {t("pack.exportAllTitle")}
          </h2>
          <p className="export-workspace-modal__subtitle">
            {t("pack.exportAllSubtitle")}
          </p>
        </header>

        <div className="export-workspace-modal__preview">
          {hasPreview ? (
            <img
              className="export-workspace-modal__preview-img"
              src={previewSrc}
              alt=""
              draggable={false}
            />
          ) : (
            <div className="export-workspace-modal__preview-placeholder" aria-hidden>
              <span>{t("pack.exportAllPreviewPlaceholder")}</span>
            </div>
          )}
        </div>

        {error ? (
          <p className="export-workspace-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className={
            "export-workspace-modal__cta"
            + (busy ? " is-loading" : "")
          }
          onClick={handleExportAll}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? t("pack.exportAllLoading") : t("pack.exportAllCta")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
