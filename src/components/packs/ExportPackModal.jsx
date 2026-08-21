import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { exportObjectPackV2 } from "../../lib/pack/packV2Export.js";

/**
 * Choose one workspace object (corpus) and download a re-importable FN pack (v2).
 *
 * @param {{ onClose?: () => void }} props
 */
export function ExportPackModal({ onClose }) {
  const { t } = useI18n();
  const objects = useObjectsStore((s) => s.objects);
  const selectedObjectId = useUIStateStore((s) => s.selectedObjectId);
  const filterObjectId = useUIStateStore((s) => s.filterObjectId);

  const options = useMemo(() => {
    return Object.values(objects || {})
      .map((obj) => ({
        id: obj.id,
        name: String(obj.name || obj.id || "").trim() || obj.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [objects]);

  const preferredId = selectedObjectId || filterObjectId || options[0]?.id || "";
  const [pickedId, setPickedId] = useState(preferredId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pickedId && preferredId) setPickedId(preferredId);
    if (pickedId && !options.some((o) => o.id === pickedId) && preferredId) {
      setPickedId(preferredId);
    }
  }, [preferredId, pickedId, options]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!busy) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, busy]);

  const handleExport = async () => {
    if (busy) return;
    const id = String(pickedId || "").trim();
    if (!id) {
      setError(t("pack.exportPackEmpty"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await exportObjectPackV2(id);
      onClose?.();
    } catch (err) {
      console.error("[exportPackModal]", err);
      setError(err?.message || t("pack.exportPackFailed"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="export-pack-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-pack-modal-title"
    >
      <button
        type="button"
        className="export-pack-modal__backdrop"
        aria-label={t("common.cancel")}
        onClick={() => {
          if (!busy) onClose?.();
        }}
      />
      <div className="export-pack-modal__card">
        <button
          type="button"
          className="export-pack-modal__close"
          onClick={() => {
            if (!busy) onClose?.();
          }}
          aria-label={t("common.cancel")}
          disabled={busy}
        >
          ×
        </button>

        <header className="export-pack-modal__header">
          <h2 id="export-pack-modal-title" className="export-pack-modal__title">
            {t("pack.exportPackTitle")}
          </h2>
          <p className="export-pack-modal__subtitle">
            {t("pack.exportPackSubtitle")}
          </p>
        </header>

        {options.length === 0 ? (
          <p className="export-pack-modal__empty" role="status">
            {t("pack.exportPackEmpty")}
          </p>
        ) : (
          <fieldset className="export-pack-modal__list" disabled={busy}>
            <legend className="export-pack-modal__legend">{t("pack.exportPackChoose")}</legend>
            {options.map((opt) => (
              <label key={opt.id} className="export-pack-modal__option">
                <input
                  type="radio"
                  name="export-pack-object"
                  value={opt.id}
                  checked={pickedId === opt.id}
                  onChange={() => setPickedId(opt.id)}
                />
                <span>{opt.name}</span>
              </label>
            ))}
          </fieldset>
        )}

        {error ? (
          <p className="export-pack-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className={
            "export-pack-modal__cta"
            + (busy ? " is-loading" : "")
          }
          onClick={handleExport}
          disabled={busy || options.length === 0}
          aria-busy={busy}
        >
          {busy ? t("pack.exportPackLoading") : t("pack.exportPackCta")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
