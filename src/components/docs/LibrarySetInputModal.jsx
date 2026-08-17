import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { createLibrarySet } from "../../lib/folderLibrary.js";

/**
 * `/i` — name + story for a new document library set.
 */
export function LibrarySetInputModal({
  ownerId,
  onClose,
  onSaved,
}) {
  const { t } = useI18n();
  const id = String(ownerId || "").trim();
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSave = () => {
    const name = tag.trim();
    if (!name) {
      setError(t("doc.library.nameRequired"));
      return;
    }
    if (!id) {
      setError(t("doc.library.captureNoOwner"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = createLibrarySet("document", id, {
        tag: name,
        description: description.trim(),
      });
      if (!saved) {
        setError(t("doc.library.nameRequired"));
        return;
      }
      onSaved?.(saved);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="folder-library-element-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("doc.library.setInputTitle")}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.cancel")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal folder-library-element-modal--capture">
        <header className="folder-library-element-modal__head">
          <h2 className="folder-library-element-modal__title">
            {t("doc.library.setInputTitle")}
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
          <label className="folder-library-element-modal__field">
            <span className="folder-library-element-modal__label">{t("doc.library.setNameLabel")}</span>
            <input
              className="folder-library-element-modal__input"
              type="text"
              value={tag}
              placeholder={t("doc.library.setNamePlaceholder")}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              autoFocus
            />
          </label>
          <label className="folder-library-element-modal__field">
            <span className="folder-library-element-modal__label">{t("doc.library.setStoryLabel")}</span>
            <textarea
              className="folder-library-element-modal__textarea"
              value={description}
              placeholder={t("doc.library.setStoryPlaceholder")}
              rows={5}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        {error ? (
          <p className="folder-library-element-modal__error" role="alert">{error}</p>
        ) : null}

        <footer className="folder-library-element-modal__footer">
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--cancel"
            onClick={onClose}
            disabled={saving}
          >
            {t("doc.library.cancel")}
          </button>
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
            onClick={handleSave}
            disabled={saving}
          >
            {t("doc.library.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
