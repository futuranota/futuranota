import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import {
  convertAndUploadDocImage,
  uploadDocAttachmentFile,
  uploadDocVideoFile,
} from "../../lib/docImageStorage.js";
import { generateId } from "../../lib/ids.js";
import {
  FOLDER_LIBRARY_CATEGORIES,
  FOLDER_LIBRARY_DEFAULT_WALL,
  createLibraryItem,
  normalizeFolderLibraryCategory,
  normalizeLibraryOwnerKind,
  normalizeWallColor,
  resolveWallColor,
  updateLibraryItem,
} from "../../lib/folderLibrary.js";

const CATEGORY_LABEL_KEYS = {
  auto: "doc.library.categoryAuto",
  image: "doc.library.categoryImage",
  pdf: "doc.library.categoryPdf",
  skill: "doc.library.categorySkill",
  video: "doc.library.categoryVideo",
};

function initialPromptClass(item, defaultPromptClass) {
  if (item?.promptClass) return item.promptClass;
  return String(defaultPromptClass || "").trim();
}

/**
 * New / edit library ficha modal — image (WebP) or skill (attachment).
 */
export function FolderLibraryElementModal({
  folderId,
  ownerKind = "folder",
  ownerId,
  item = null,
  defaultCategory = "auto",
  /** When true, category select is hidden (chosen via [+] menu). */
  lockCategory = false,
  promptClasses = [],
  defaultPromptClass = "",
  /** Prefill photo when creating from the header + file picker. */
  initialMediaUrl = "",
  onClose,
  onSaved,
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const promptInfoId = useId();
  const wallInfoId = useId();
  const loopTipId = useId();
  const [promptInfoOpen, setPromptInfoOpen] = useState(false);
  const [wallInfoOpen, setWallInfoOpen] = useState(false);
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const resolvedOwnerId = String(ownerId || folderId || "").trim();
  const uploadScopeId = resolvedOwnerId || (kind === "document" ? "doc-lib" : "folder-lib");
  const editing = Boolean(item?.id);
  const initialCategory = item?.category
    || (String(initialMediaUrl || "").trim() ? "image" : normalizeFolderLibraryCategory(defaultCategory));

  const [tag, setTag] = useState(item?.tag || "");
  const [description, setDescription] = useState(item?.description || "");
  const [category, setCategory] = useState(initialCategory);
  const [mediaUrl, setMediaUrl] = useState(item?.mediaUrl || String(initialMediaUrl || "").trim() || null);
  const [attachmentUrl, setAttachmentUrl] = useState(item?.attachmentUrl || null);
  const [attachmentName, setAttachmentName] = useState(item?.attachmentName || null);
  const [attachmentKind, setAttachmentKind] = useState(item?.attachmentKind || null);
  const [wallHexDraft, setWallHexDraft] = useState(item?.wallColor || "");
  const [wallColor, setWallColor] = useState(item?.wallColor || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loop, setLoop] = useState(() => (
    item ? Boolean(item.loop) : kind === "folder"
  ));
  const [promptClass, setPromptClass] = useState(
    () => initialPromptClass(item, defaultPromptClass),
  );
  const [classesOpen, setClassesOpen] = useState(
    () => Boolean(initialPromptClass(item, defaultPromptClass)),
  );
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
          scopeId: uploadScopeId,
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

    if (isVideoLike) {
      const mime = String(file.type || "").toLowerCase();
      const okVideo = /^video\/(mp4|webm|quicktime)$/i.test(mime)
        || /\.(mp4|webm|mov)$/i.test(file.name || "");
      if (!okVideo) {
        setError(t("doc.library.invalidVideo"));
        return;
      }
      setUploading(true);
      setError("");
      try {
        const uploaded = await uploadDocVideoFile(file, {
          fileId: generateId("LIBVID"),
          scopeId: uploadScopeId,
          fileName: file.name,
        });
        setMediaUrl(uploaded.url);
      } catch (err) {
        if (err?.code === "VIDEO_TOO_LONG" || String(err?.message || "").startsWith("VIDEO_TOO_LONG")) {
          setError(
            t("doc.library.videoTooLong").replace(
              "{max}",
              String(Math.round((err.maxSeconds || 120) / 60) || 2),
            ),
          );
        } else if (err?.code === "VIDEO_TOO_LARGE" || String(err?.message || "") === "VIDEO_TOO_LARGE") {
          setError(t("doc.library.videoTooLarge"));
        } else if (/maximum allowed size|exceeded|too large|Payload too large/i.test(String(err?.message || ""))) {
          setError(t("doc.library.videoTooLarge"));
        } else {
          setError(err?.message || t("doc.library.uploadFailed"));
        }
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
        scopeId: uploadScopeId,
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
        loop: Boolean(loop),
        promptClass: isSkillLike ? null : (promptClass || null),
      };
      if (isSkillLike) {
        payload.mediaUrl = null;
        payload.wallColor = null;
      }
      const saved = editing
        ? updateLibraryItem(kind, resolvedOwnerId, item.id, payload)
        : createLibraryItem(kind, resolvedOwnerId, payload);
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
    : isVideoLike
      ? (uploading ? t("doc.library.uploading") : null)
      : (uploading ? t("doc.library.uploading") : t("doc.library.uploadTitle"));

  const uploadHint = isSkillLike
    ? t("doc.library.uploadAttachmentHint")
    : isVideoLike
      ? null
      : t("doc.library.uploadHint");

  const hasUploadPreview = isSkillLike ? Boolean(attachmentUrl) : Boolean(mediaUrl);
  const isImageLike = category === "image" || (!isSkillLike && !isVideoLike);
  const classOptions = [];
  const seenClasses = new Set();
  const pushClass = (name, label) => {
    const key = String(name || "").trim();
    if (!key) return;
    const id = key.toLowerCase();
    if (seenClasses.has(id)) return;
    seenClasses.add(id);
    classOptions.push({ name: key, label: label || key });
  };
  for (const name of promptClasses) pushClass(name);
  const fileAccept = isSkillLike
    ? undefined
    : isVideoLike
      ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
      : "image/*";
  const showMediaPanel = isSkillLike || isVideoLike || Boolean(mediaUrl);
  const openReferenceUpload = () => {
    fileInputRef.current?.click();
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
      <div
        className={
          "folder-library-element-modal"
          + (isVideoLike ? " folder-library-element-modal--video" : "")
          + (isImageLike && !isSkillLike ? " folder-library-element-modal--prompt" : "")
          + (isImageLike && !isSkillLike && mediaUrl ? " folder-library-element-modal--with-media" : "")
        }
      >
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

            <div className="folder-library-element-modal__field">
              {isSkillLike ? (
                <span className="folder-library-element-modal__label">
                  {t("doc.library.skillDescriptionLabel")}
                </span>
              ) : (
                <div className="library-asset-prompt-label">
                  <span className="folder-library-element-modal__label library-asset-prompt-label__text">
                    {t("doc.library.promptLabel")}
                  </span>
                  <span className="library-asset-prompt-label__info-wrap">
                    <button
                      type="button"
                      className="library-asset-prompt-label__info"
                      aria-label={t("doc.library.promptFieldInfoAria")}
                      aria-expanded={promptInfoOpen}
                      aria-describedby={promptInfoOpen ? promptInfoId : undefined}
                      onClick={() => setPromptInfoOpen((value) => !value)}
                      onBlur={(event) => {
                        if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                          setPromptInfoOpen(false);
                        }
                      }}
                    >
                      <img
                        src="/uploads/Info%201.svg"
                        alt=""
                        aria-hidden
                        draggable={false}
                      />
                    </button>
                    <span
                      id={promptInfoId}
                      role="tooltip"
                      className={"library-asset-prompt-label__tip" + (promptInfoOpen ? " is-open" : "")}
                    >
                      {t("doc.library.promptFieldInfo")}
                    </span>
                  </span>
                </div>
              )}
              <textarea
                className="folder-library-element-modal__textarea"
                value={description}
                placeholder={descPlaceholder}
                rows={5}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {isImageLike ? (
              <div className="folder-library-element-modal__flag-block">
                <div className="folder-library-element-modal__flags">
                  <span className="folder-library-element-modal__flag-tip-wrap">
                    <button
                      type="button"
                      className={
                        "folder-library-element-modal__flag folder-library-element-modal__flag--loop"
                        + (loop ? " is-active" : "")
                      }
                      aria-pressed={loop}
                      aria-label={t("doc.library.imageLoop")}
                      aria-describedby={loopTipId}
                      onClick={() => setLoop((value) => !value)}
                    >
                      <img src="/uploads/RepeatOnce.svg" alt="" aria-hidden draggable={false} />
                    </button>
                    <span
                      id={loopTipId}
                      role="tooltip"
                      className="library-asset-prompt-label__tip folder-library-element-modal__flag-tip"
                    >
                      {t("doc.library.imageLoopInfo")}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={
                      "folder-library-element-modal__flag"
                      + (promptClass ? " folder-library-element-modal__flag--class" : "")
                      + (classesOpen || promptClass ? " is-active" : "")
                    }
                    aria-pressed={classesOpen}
                    aria-label={
                      promptClass
                        ? `${t("doc.library.promptClassAria")}: ${promptClass}`
                        : t("doc.library.promptClassAria")
                    }
                    title={promptClass || t("doc.library.promptClassAria")}
                    onClick={() => setClassesOpen((value) => !value)}
                  >
                    <img src="/uploads/objects.svg" alt="" aria-hidden draggable={false} />
                    {promptClass ? (
                      <span className="folder-library-element-modal__flag-name">{promptClass}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className={
                      "folder-library-element-modal__flag folder-library-element-modal__flag--image"
                      + (mediaUrl ? " is-active" : "")
                    }
                    aria-pressed={Boolean(mediaUrl)}
                    aria-label={t("doc.library.addReferenceImage")}
                    title={t("doc.library.addReferenceImage")}
                    onClick={openReferenceUpload}
                    disabled={saving || uploading}
                  >
                    <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false">
                      <rect x="32" y="48" width="192" height="160" rx="16" fill="none" stroke="currentColor" strokeWidth="16" />
                      <circle cx="92" cy="108" r="20" fill="currentColor" />
                      <path d="M32 176l52-52 36 36 40-56 64 80" fill="none" stroke="currentColor" strokeWidth="16" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                {classesOpen ? (
                  <div
                    className="folder-library-element-modal__classes"
                    role="listbox"
                    aria-label={t("doc.library.promptClassAria")}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={!promptClass}
                      className={
                        "folder-library-element-modal__class"
                        + (!promptClass ? " is-active" : "")
                      }
                      onClick={() => setPromptClass("")}
                    >
                      {t("doc.library.promptClassNone")}
                    </button>
                    {classOptions.map((entry) => (
                      <button
                        key={entry.name}
                        type="button"
                        role="option"
                        aria-selected={
                          String(promptClass || "").toLowerCase() === entry.name.toLowerCase()
                        }
                        className={
                          "folder-library-element-modal__class"
                          + (String(promptClass || "").toLowerCase() === entry.name.toLowerCase()
                            ? " is-active"
                            : "")
                        }
                        onClick={() => setPromptClass(entry.name)}
                      >
                        <img src="/uploads/objects.svg" alt="" aria-hidden draggable={false} />
                        {entry.label}
                      </button>
                    ))}
                  </div>
                ) : null}
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
                  {FOLDER_LIBRARY_CATEGORIES.filter((id) => id !== "video").map((id) => (
                    <option key={id} value={id}>
                      {t(CATEGORY_LABEL_KEYS[id] || CATEGORY_LABEL_KEYS.auto)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {showMediaPanel ? (
          <div className={
            "folder-library-element-modal__media"
            + (isImageLike && !isSkillLike ? " folder-library-element-modal__media--ref" : "")
          }>
            <button
              type="button"
              className={
                "folder-library-element-modal__drop"
                + (isVideoLike ? " folder-library-element-modal__drop--video" : "")
                + (dragOver ? " is-dragover" : "")
                + (hasUploadPreview ? " has-media" : "")
              }
              style={
                showWallColor && mediaUrl
                  ? { backgroundColor: wallPreview }
                  : undefined
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
              {isSkillLike && attachmentUrl ? (
                <span className="folder-library-element-modal__attachment">
                  <span className="folder-library-element-modal__attachment-kind">
                    {(attachmentKind || "FILE").toUpperCase()}
                  </span>
                  <span className="folder-library-element-modal__attachment-name">
                    {attachmentName || t("doc.library.attachmentReady")}
                  </span>
                </span>
              ) : mediaUrl && isVideoLike ? (
                <video
                  className="folder-library-element-modal__preview folder-library-element-modal__preview--contain"
                  src={mediaUrl}
                  controls
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                />
              ) : mediaUrl && isImageLike ? (
                <img
                  className="folder-library-element-modal__preview folder-library-element-modal__preview--contain"
                  src={mediaUrl}
                  alt=""
                />
              ) : isVideoLike ? (
                <>
                  <span className="folder-library-element-modal__plus" aria-hidden>+</span>
                  {uploading ? (
                    <span className="folder-library-element-modal__upload-title">
                      {t("doc.library.uploading")}
                    </span>
                  ) : (
                    <span className="folder-library-element-modal__upload-info">
                      <span className="folder-library-element-modal__upload-info-lead">
                        {t("doc.library.uploadVideoInfoLead")}
                      </span>
                      <span className="folder-library-element-modal__upload-info-body">
                        {t("doc.library.uploadVideoInfoBody")}
                      </span>
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="folder-library-element-modal__plus" aria-hidden>+</span>
                  <span className="folder-library-element-modal__upload-title">
                    {uploadTitle}
                  </span>
                  <span className="folder-library-element-modal__upload-hint">
                    {uploadHint}
                  </span>
                </>
              )}
            </button>
            {showWallColor ? (
              <div className="folder-library-element-modal__field folder-library-element-modal__field--wall">
                <div className="library-asset-prompt-label">
                  <span className="folder-library-element-modal__label library-asset-prompt-label__text">
                    {t("doc.library.wallColorLabel")}
                  </span>
                  <span className="library-asset-prompt-label__info-wrap">
                    <button
                      type="button"
                      className="library-asset-prompt-label__info"
                      aria-label={t("doc.library.wallColorInfoAria")}
                      aria-expanded={wallInfoOpen}
                      aria-describedby={wallInfoOpen ? wallInfoId : undefined}
                      onClick={() => setWallInfoOpen((value) => !value)}
                      onBlur={(event) => {
                        if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                          setWallInfoOpen(false);
                        }
                      }}
                    >
                      <img
                        src="/uploads/Info%201.svg"
                        alt=""
                        aria-hidden
                        draggable={false}
                      />
                    </button>
                    <span
                      id={wallInfoId}
                      role="tooltip"
                      className={
                        "library-asset-prompt-label__tip library-asset-prompt-label__tip--sm"
                        + (wallInfoOpen ? " is-open" : "")
                      }
                    >
                      {t("doc.library.wallColorHint")}
                    </span>
                  </span>
                </div>
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
              </div>
            ) : null}
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
                {isVideoLike ? t("doc.library.removeVideo") : t("doc.library.removeMedia")}
              </button>
            ) : null}
          </div>
          ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={fileAccept}
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
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
