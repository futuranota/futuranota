import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import { MOODBOARD_TAG_MAX } from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";

const INFO_SRC = "/uploads/Info.svg";

/**
 * Attachments table for one moodboard image slot:
 * Field 01 — image upload, Field 02 — tag label + how-to tip.
 */
export function MoodboardAttachmentModal({
  open,
  image = null,
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

  const handleFiles = async (fileList) => {
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

  const canAccept = Boolean(draft.imageSaved && draft.src) && !uploading;

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
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {draft.imageSaved && draft.src ? (
            <div className="doc-moodboard-attach__preview">
              <img src={draft.src} alt={draft.alt || ""} draggable={false} />
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
            </div>
          ) : (
            <button
              type="button"
              className="doc-moodboard-attach__dropzone"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
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
            {t("doc.moodboard.attachCancel")}
          </button>
          <button
            type="button"
            className="doc-moodboard-attach__accept"
            disabled={!canAccept}
            onClick={() => {
              if (!canAccept) return;
              onAccept?.({
                ...draft,
                tagLabel: String(draft.tagLabel || "").trim().slice(0, MOODBOARD_TAG_MAX),
              });
            }}
          >
            {t("doc.moodboard.attachAccept")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
