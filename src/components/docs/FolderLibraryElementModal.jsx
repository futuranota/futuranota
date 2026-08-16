import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import {
  convertAndUploadDocImage,
  uploadDocAttachmentFile,
} from "../../lib/docImageStorage.js";
import { generateId } from "../../lib/ids.js";
import {
  FOLDER_LIBRARY_CATEGORIES,
  FOLDER_LIBRARY_DEFAULT_WALL,
  createFolderLibraryItem,
  normalizeFolderLibraryCategory,
  normalizeWallColor,
  resolveWallColor,
  updateFolderLibraryItem,
} from "../../lib/folderLibrary.js";

const CATEGORY_LABEL_KEYS = {
  auto: "doc.library.categoryAuto",
  image: "doc.library.categoryImage",
  pdf: "doc.library.categoryPdf",
  skill: "doc.library.categorySkill",
  video: "doc.library.categoryVideo",
};

/**
 * New / edit library ficha modal — image (WebP) or skill (attachment).
 */
export function FolderLibraryElementModal({
  folderId,
  item = null,
  defaultCategory = "auto",
  /** When true, category select is hidden (chosen via [+] menu). */
  lockCategory = false,
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
  const [attachmentUrl, setAttachmentUrl] = useState(item?.attachmentUrl || null);
  const [attachmentName, setAttachmentName] = useState(item?.attachmentName || null);
  const [attachmentKind, setAttachmentKind] = useState(item?.attachmentKind || null);
  const [wallHexDraft, setWallHexDraft] = useState(item?.wallColor || "");
  const [wallColor, setWallColor] = useState(item?.wallColor || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isSkillLike = category === "skill" || category === "pdf";
  const isVideoLike = category === "video";
  const showWallColor = category === "image" || category === "video" || category === "auto";
  const wallPreview = resolveWallColor(wallColor);

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

    if (isSkillLike) {
      setUploading(true);
      setError("");
      try {
        const uploaded = await uploadDocAttachmentFile(file, {
          fileId: generateId("LIBATT"),
          scopeId: folderId || "folder-lib",
          fileName: file.name,
        });
        setAttachmentUrl(uploaded.url);
        setAttachmentName(uploaded.name);
        setAttachmentKind(uploaded.kind);
      } catch (err) {
        setError(err?.message || t("doc.library.uploadFailed"));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }

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

  const handleApplyWall = () => {
    const next = normalizeWallColor(wallHexDraft);
    if (!next && String(wallHexDraft || "").trim()) {
      setError(t("doc.library.invalidWallColor"));
      return;
    }
    setError("");
    setWallColor(next);
    setWallHexDraft(next || "");
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
        mediaUrl: isSkillLike ? null : mediaUrl,
        attachmentUrl: isSkillLike ? attachmentUrl : (item?.attachmentUrl || null),
        attachmentName: isSkillLike ? attachmentName : (item?.attachmentName || null),
        attachmentKind: isSkillLike ? attachmentKind : (item?.attachmentKind || null),
        wallColor: showWallColor ? wallColor : null,
      };
      if (isSkillLike) {
        payload.mediaUrl = null;
        payload.wallColor = null;
      }
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

  const descPlaceholder = isSkillLike
    ? t("doc.library.skillDescriptionPlaceholder")
    : t("doc.library.descriptionPlaceholder");

  const uploadTitle = isSkillLike
    ? (uploading ? t("doc.library.uploading") : t("doc.library.uploadAttachmentTitle"))
    : (uploading ? t("doc.library.uploading") : t("doc.library.uploadTitle"));

  const uploadHint = isSkillLike
    ? t("doc.library.uploadAttachmentHint")
    : t("doc.library.uploadHint");

  const hasUploadPreview = isSkillLike ? Boolean(attachmentUrl) : Boolean(mediaUrl);
  const isImageLike = category === "image" || (!isSkillLike && !isVideoLike);

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
            {editing
              ? t("doc.library.editTitle")
              : (isSkillLike
                ? t("doc.library.newSkillTitle")
                : category === "video"
                  ? t("doc.library.newVideoTitle")
                  : t("doc.library.newImageTitle"))}
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
              <span className="folder-library-element-modal__label">
                {isSkillLike
                  ? t("doc.library.skillDescriptionLabel")
                  : t("doc.library.descriptionLabel")}
              </span>
              <textarea
                className="folder-library-element-modal__textarea"
                value={description}
                placeholder={descPlaceholder}
                rows={5}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {showWallColor ? (
              <div className="folder-library-element-modal__field">
                <span className="folder-library-element-modal__label">
                  {t("doc.library.wallColorLabel")}
                </span>
                <div className="folder-library-element-modal__wall-row">
                  <input
                    type="color"
                    className="folder-library-element-modal__wall-swatch"
                    value={wallPreview}
                    aria-label={t("doc.library.wallColorLabel")}
                    onChange={(e) => {
                      const next = normalizeWallColor(e.target.value);
                      setWallHexDraft(next || FOLDER_LIBRARY_DEFAULT_WALL);
                      setWallColor(next);
                      setError("");
                    }}
                  />
                  <input
                    className="folder-library-element-modal__input folder-library-element-modal__wall-hex"
                    type="text"
                    value={wallHexDraft}
                    placeholder={t("doc.library.wallColorPlaceholder")}
                    spellCheck={false}
                    onChange={(e) => setWallHexDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyWall();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="folder-library-element-modal__wall-apply"
                    onClick={handleApplyWall}
                  >
                    {t("doc.library.wallColorApply")}
                  </button>
                </div>
                <span className="folder-library-element-modal__wall-hint">
                  {t("doc.library.wallColorHint")}
                </span>
              </div>
            ) : null}

            {!lockCategory ? (
              <label className="folder-library-element-modal__field">
                <span className="folder-library-element-modal__label">{t("doc.library.categoryLabel")}</span>
                <select
                  className="folder-library-element-modal__select"
                  value={category}
                  onChange={(e) => setCategory(normalizeFolderLibraryCategory(e.target.value))}
                >
                  {FOLDER_LIBRARY_CATEGORIES.map((id) => (
                    <option key={id} value={id}>
                      {t(CATEGORY_LABEL_KEYS[id] || CATEGORY_LABEL_KEYS.auto)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="folder-library-element-modal__media">
            <button
              type="button"
              className={
                "folder-library-element-modal__drop"
                + (dragOver ? " is-dragover" : "")
                + (hasUploadPreview ? " has-media" : "")
              }
              style={
                showWallColor && mediaUrl
                  ? { backgroundColor: wallPreview }
                  : undefined
              }
              disabled={uploading || category === "video"}
              onClick={() => {
                if (category === "video") return;
                fileInputRef.current?.click();
              }}
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
                if (category === "video") return;
                handleFiles(e.dataTransfer?.files);
              }}
            >
              {isSkillLike && attachmentUrl ? (
                <span className="folder-library-element-modal__attachment">
                  <span className="folder-library-element-modal__attachment-kind">
                    {(attachmentKind || "FILE").toUpperCase()}
                  </span>
                  <span className="folder-library-element-modal__attachment-name">
                    {attachmentName || t("doc.library.attachmentReady")}
                  </span>
                </span>
              ) : mediaUrl && isImageLike ? (
                <img
                  className="folder-library-element-modal__preview folder-library-element-modal__preview--contain"
                  src={mediaUrl}
                  alt=""
                />
              ) : (
                <>
                  <span className="folder-library-element-modal__plus" aria-hidden>+</span>
                  <span className="folder-library-element-modal__upload-title">
                    {category === "video" ? t("doc.library.videoUploadLater") : uploadTitle}
                  </span>
                  <span className="folder-library-element-modal__upload-hint">
                    {category === "video" ? t("doc.library.videoUploadLaterHint") : uploadHint}
                  </span>
                </>
              )}
            </button>
            {isSkillLike && attachmentUrl ? (
              <button
                type="button"
                className="folder-library-element-modal__remove-media"
                onClick={() => {
                  setAttachmentUrl(null);
                  setAttachmentName(null);
                  setAttachmentKind(null);
                }}
              >
                {t("doc.library.removeAttachment")}
              </button>
            ) : null}
            {!isSkillLike && mediaUrl ? (
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
              accept={isSkillLike ? undefined : "image/*"}
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
