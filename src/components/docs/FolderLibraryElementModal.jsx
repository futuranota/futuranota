import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { convertAndUploadDocImage } from "../../lib/docImageStorage.js";
import {
  FOLDER_LIBRARY_CATEGORIES,
  createFolderLibraryItem,
  normalizeFolderLibraryCategory,
  updateFolderLibraryItem,
} from "../../lib/folderLibrary.js";

const CATEGORY_LABEL_KEYS = {
  auto: "doc.library.categoryAuto",
  image: "doc.library.categoryImage",
  pdf: "doc.library.categoryPdf",
  skill: "doc.library.categorySkill",
};

/**
 * New / edit library ficha modal — metadata-first; media optional.
 */
export function FolderLibraryElementModal({
  folderId,
  item = null,
  /** When creating, seed category from the library type tab. */
  defaultCategory = "auto",
  onClose,
  onSaved,
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const editing = Boolean(item?.id);
  const initialCategory = item?.category
    || normalizeFolderLibraryCategory(defaultCategory);

  const [tag, setTag] = useState(item?.tag || "");
  const [description, setDescription] = useState(item?.description || "");
  const [category, setCategory] = useState(initialCategory);
  const [mediaUrl, setMediaUrl] = useState(item?.mediaUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("doc.library.invalidImage"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const converted = await convertAndUploadDocImage(file, {
        idPrefix: "LIBIMG",
        scopeId: folderId || "folder-lib",
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.88,
      });
      if (converted?.src) {
        setMediaUrl(converted.src);
        if (category === "auto") setCategory("image");
      }
    } catch (err) {
      setError(err?.message || t("doc.library.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    const trimmed = tag.trim();
    if (!trimmed) {
      setError(t("doc.library.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        tag: trimmed,
        description,
        category,
        mediaUrl,
      };
      const saved = editing
        ? updateFolderLibraryItem(folderId, item.id, payload)
        : createFolderLibraryItem(folderId, payload);
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
      aria-label={editing ? t("doc.library.editTitle") : t("doc.library.newTitle")}
    >
      <button
        type="button"
        className="folder-library-element-overlay__backdrop"
        aria-label={t("doc.library.cancel")}
        onClick={onClose}
      />
      <div className="folder-library-element-modal">
        <header className="folder-library-element-modal__head">
          <h2 className="folder-library-element-modal__title">
            {editing ? t("doc.library.editTitle") : t("doc.library.newTitle")}
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

        <div className="folder-library-element-modal__body">
          <div className="folder-library-element-modal__fields">
            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">{t("doc.library.nameLabel")}</span>
              <input
                className="folder-library-element-modal__input"
                type="text"
                value={tag}
                placeholder={t("doc.library.namePlaceholder")}
                onChange={(e) => setTag(e.target.value)}
                autoFocus
              />
            </label>

            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">{t("doc.library.descriptionLabel")}</span>
              <textarea
                className="folder-library-element-modal__textarea"
                value={description}
                placeholder={t("doc.library.descriptionPlaceholder")}
                rows={5}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="folder-library-element-modal__field">
              <span className="folder-library-element-modal__label">{t("doc.library.categoryLabel")}</span>
              <select
                className="folder-library-element-modal__select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {FOLDER_LIBRARY_CATEGORIES.map((id) => (
                  <option key={id} value={id}>
                    {t(CATEGORY_LABEL_KEYS[id])}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="folder-library-element-modal__media">
            <button
              type="button"
              className={
                "folder-library-element-modal__drop"
                + (dragOver ? " is-dragover" : "")
                + (mediaUrl ? " has-media" : "")
              }
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer?.files);
              }}
            >
              {mediaUrl ? (
                <img
                  className="folder-library-element-modal__preview"
                  src={mediaUrl}
                  alt=""
                />
              ) : (
                <>
                  <span className="folder-library-element-modal__plus" aria-hidden>+</span>
                  <span className="folder-library-element-modal__upload-title">
                    {uploading ? t("doc.library.uploading") : t("doc.library.uploadTitle")}
                  </span>
                  <span className="folder-library-element-modal__upload-hint">
                    {t("doc.library.uploadHint")}
                  </span>
                </>
              )}
            </button>
            {mediaUrl ? (
              <button
                type="button"
                className="folder-library-element-modal__remove-media"
                onClick={() => setMediaUrl(null)}
              >
                {t("doc.library.removeMedia")}
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
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
            disabled={saving || uploading}
          >
            {t("doc.library.cancel")}
          </button>
          <button
            type="button"
            className="folder-library-element-modal__btn folder-library-element-modal__btn--save"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {t("doc.library.save")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
