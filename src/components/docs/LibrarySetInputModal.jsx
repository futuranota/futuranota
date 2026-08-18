import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { createLibrarySet, updateLibrarySet } from "../../lib/folderLibrary.js";
import { LibraryAssetEmptyImgGrid } from "./LibraryAssetImgMark.jsx";

/**
 * `#i` — name + prompt. Right pane is a static IMG preview (no upload).
 */
export function LibrarySetInputModal({
  ownerId,
  editingSet = null,
  onClose,
  onSaved,
}) {
  const { t } = useI18n();
  const id = String(ownerId || "").trim();
  const [tag, setTag] = useState(() => String(editingSet?.tag || ""));
  const [description, setDescription] = useState(() => String(editingSet?.description || ""));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(editingSet?.id);
  const title = isEdit
    ? t("doc.library.assetEditTitle")
    : t("doc.library.assetInputTitle");

  useEffect(() => {
    setTag(String(editingSet?.tag || ""));
    setDescription(String(editingSet?.description || ""));
  }, [editingSet?.id, editingSet?.tag, editingSet?.description]);

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
      const saved = isEdit
        ? updateLibrarySet("document", id, editingSet.id, {
          tag: name,
          description: description.trim(),
        })
        : createLibrarySet("document", id, {
          tag: name,
          description: description.trim(),
        });
      if (!saved) {
        setError(t("doc.library.nameRequired"));
        return;
      }
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.message || t("doc.library.nameRequired"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="folder-library-element-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.cancel")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal">
        <header className="folder-library-element-modal__head">
          <div className="library-asset-modal__title-row">
            <img
              className="library-asset-modal__title-icon"
              src="/uploads/FolderDashed.svg"
              alt=""
              aria-hidden
              draggable={false}
            />
            <h2 className="folder-library-element-modal__title">{title}</h2>
          </div>
          <button
            type="button"
            className="folder-library-element-modal__close"
            onClick={onClose}
            aria-label={t("doc.library.close")}
          >
            ×
          </button>
        </header>

        <div className="folder-library-element-modal__body">
          <div className="folder-library-element-modal__fields">
            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">
                {t("doc.library.assetNameLabel")}
              </span>
              <input
                className="folder-library-element-modal__input"
                type="text"
                value={tag}
                placeholder={t("doc.library.assetNamePlaceholder")}
                onChange={(e) => setTag(e.target.value)}
                autoFocus
              />
            </label>
            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">
                {t("doc.library.assetDescriptionLabel")}
              </span>
              <textarea
                className="folder-library-element-modal__textarea"
                value={description}
                placeholder={t("doc.library.assetDescriptionPlaceholder")}
                rows={5}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>

          <div className="folder-library-element-modal__media" aria-hidden>
            <div className="library-asset-queue library-asset-queue--preview">
              <LibraryAssetEmptyImgGrid />
            </div>
          </div>
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
