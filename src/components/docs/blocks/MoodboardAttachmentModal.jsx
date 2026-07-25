import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  MOODBOARD_FILE_ICON_SRC,
  MOODBOARD_TAG_MAX,
  normalizeMoodboardExternalUrl,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";

const INFO_SRC = "/uploads/Info.svg";

/**
 * Attachments table for one moodboard slot:
 * 01 — image upload, 02 — external link (Drive/Dropbox/…), 03 — tag.
 */
export function MoodboardAttachmentModal({
  open,
  image = null,
  readOnly = false,
  onClose,
  onAccept,
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(() => ({
    src: image?.src || "",
    name: image?.name || "",
    alt: image?.alt || "",
    width: image?.width || 0,
    height: image?.height || 0,
    imageSaved: Boolean(image?.imageSaved && image?.src),
    externalUrl: String(image?.externalUrl || ""),
    tagLabel: String(image?.tagLabel || ""),
    slotId: image?.slotId || "",
  }));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft({
      src: image?.src || "",
      name: image?.name || "",
      alt: image?.alt || "",
      width: image?.width || 0,
      height: image?.height || 0,
      imageSaved: Boolean(image?.imageSaved && image?.src),
      externalUrl: String(image?.externalUrl || ""),
      tagLabel: String(image?.tagLabel || ""),
      slotId: image?.slotId || "",
    });
    setError("");
    setUploading(false);
  }, [open, image]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const normalizedLink = normalizeMoodboardExternalUrl(draft.externalUrl);
  const hasImage = Boolean(draft.imageSaved && draft.src);
  const hasLink = Boolean(normalizedLink);
  const canAccept = (hasImage || hasLink) && !uploading && !readOnly;

  const handleFiles = async (fileList) => {
    if (readOnly) return;
    const file = fileList?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const converted = await convertFileToWebpData(file);
      if (!converted?.src) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }
      setDraft((prev) => ({
        ...prev,
        src: converted.src,
        name: converted.name || file.name || "",
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width || 0,
        height: converted.height || 0,
        imageSaved: true,
      }));
    } catch (err) {
      setError(err?.message || t("doc.imageBlock.convertFailed"));
    } finally {
      setUploading(false);
    }
  };

  const openExternal = () => {
    if (!normalizedLink) return;
    window.open(normalizedLink, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <div
      className="doc-moodboard-attach-overlay"
      role="presentation"
      onClick={() => onClose?.()}
    >
      <div
        className="doc-moodboard-attach"
        role="dialog"
        aria-modal="true"
        aria-label={t("doc.moodboard.attachTitle")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="doc-moodboard-attach__head">
          <h3 className="doc-moodboard-attach__title">{t("doc.moodboard.attachTitle")}</h3>
          <button
            type="button"
            className="doc-moodboard-attach__close"
            aria-label={t("doc.moodboard.attachClose")}
            onClick={() => onClose?.()}
          >
            ✕
          </button>
        </div>

        <div className="doc-moodboard-attach__field">
          <label className="doc-moodboard-attach__label">
            {t("doc.moodboard.attachImageLabel")}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="doc-moodboard__input"
            disabled={readOnly}
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {hasImage ? (
            <div className="doc-moodboard-attach__preview">
              <img src={draft.src} alt={draft.alt || ""} draggable={false} />
              {!readOnly ? (
                <div className="doc-moodboard-attach__preview-actions">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t("doc.imageBlock.replace")}
                  </button>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        src: "",
                        name: "",
                        alt: "",
                        width: 0,
                        height: 0,
                        imageSaved: false,
                      }));
                    }}
                  >
                    {t("doc.imageBlock.remove")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : hasLink ? (
            <div className="doc-moodboard-attach__preview doc-moodboard-attach__preview--file">
              <img
                src={MOODBOARD_FILE_ICON_SRC}
                alt={t("doc.moodboard.attachFilePreviewAlt")}
                draggable={false}
              />
            </div>
          ) : (
            <button
              type="button"
              className="doc-moodboard-attach__dropzone"
              disabled={uploading || readOnly}
              onClick={() => !readOnly && fileInputRef.current?.click()}
              onDragOver={(event) => {
                if (readOnly) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                if (readOnly) return;
                event.preventDefault();
                event.stopPropagation();
                handleFiles(event.dataTransfer?.files);
              }}
            >
              <span className="doc-moodboard-attach__dropzone-title">
                {uploading
                  ? t("doc.imageBlock.uploading")
                  : t("doc.moodboard.attachImageHint")}
              </span>
              <span className="doc-moodboard-attach__dropzone-formats">
                {t("doc.imageBlock.formats")}
              </span>
            </button>
          )}
        </div>

        <div className="doc-moodboard-attach__field">
          <label className="doc-moodboard-attach__label" htmlFor="mb-attach-link">
            {t("doc.moodboard.attachLinkLabel")}
          </label>
          <div className="doc-moodboard-attach__link-row">
            <input
              id="mb-attach-link"
              type="url"
              className="doc-moodboard-attach__tag-input"
              value={draft.externalUrl}
              placeholder={t("doc.moodboard.attachLinkPlaceholder")}
              spellCheck={false}
              readOnly={readOnly}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  externalUrl: String(event.target.value ?? ""),
                }));
              }}
            />
            <button
              type="button"
              className="doc-moodboard-attach__open-link"
              disabled={!hasLink}
              onClick={openExternal}
            >
              {t("doc.moodboard.attachOpenLink")}
            </button>
          </div>
          <p className="doc-moodboard-attach__link-hint">
            {t("doc.moodboard.attachLinkHint")}
          </p>
        </div>

        <div className="doc-moodboard-attach__field">
          <label className="doc-moodboard-attach__label" htmlFor="mb-attach-tag">
            {t("doc.moodboard.attachTagLabel")}
          </label>
          <input
            id="mb-attach-tag"
            type="text"
            className="doc-moodboard-attach__tag-input"
            maxLength={MOODBOARD_TAG_MAX}
            value={draft.tagLabel}
            placeholder={t("doc.moodboard.attachTagPlaceholder")}
            spellCheck={false}
            readOnly={readOnly}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                tagLabel: String(event.target.value ?? "").slice(0, MOODBOARD_TAG_MAX),
              }));
            }}
          />
          {draft.tagLabel.trim() ? (
            <p className="doc-moodboard-attach__tag-preview" aria-hidden>
              {draft.tagLabel.trim()}
            </p>
          ) : null}
        </div>

        <div className="doc-moodboard-attach__help">
          <img src={INFO_SRC} alt="" className="doc-moodboard-attach__help-icon" />
          <p className="doc-moodboard-attach__help-text">
            {t("doc.moodboard.attachHelp")}
          </p>
        </div>

        {error ? (
          <p className="doc-moodboard-attach__error" role="alert">{error}</p>
        ) : null}

        <div className="doc-moodboard-attach__footer">
          <button
            type="button"
            className="doc-moodboard-attach__cancel"
            onClick={() => onClose?.()}
          >
            {readOnly ? t("doc.moodboard.attachClose") : t("doc.moodboard.attachCancel")}
          </button>
          {!readOnly ? (
            <button
              type="button"
              className="doc-moodboard-attach__accept"
              disabled={!canAccept}
              onClick={() => {
                if (!canAccept) return;
                const link = normalizeMoodboardExternalUrl(draft.externalUrl);
                onAccept?.({
                  ...draft,
                  externalUrl: link,
                  imageSaved: Boolean((draft.imageSaved && draft.src) || link),
                  tagLabel: String(draft.tagLabel || "").trim().slice(0, MOODBOARD_TAG_MAX),
                });
              }}
            >
              {t("doc.moodboard.attachAccept")}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
