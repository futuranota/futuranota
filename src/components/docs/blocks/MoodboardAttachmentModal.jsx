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

/** @param {{ src?: string, externalUrl?: string }|null} image */
function resolveAttachMode(image) {
  const hasSrc = Boolean(image?.src);
  const hasLink = Boolean(normalizeMoodboardExternalUrl(image?.externalUrl));
  if (hasLink && !hasSrc) return "url";
  return "image";
}

/**
 * Attachments table for one moodboard slot:
 * Mode A — Image upload + Tag. Mode B — Document URL + file icon + Tag.
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
  const [mode, setMode] = useState(() => resolveAttachMode(image));
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
    setMode(resolveAttachMode(image));
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
  const canAccept = !uploading && !readOnly && (
    mode === "image" ? hasImage : hasLink
  );

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

  const handleAccept = () => {
    if (!canAccept) return;
    const tagLabel = String(draft.tagLabel || "").trim().slice(0, MOODBOARD_TAG_MAX);
    if (mode === "image") {
      onAccept?.({
        ...draft,
        externalUrl: "",
        imageSaved: true,
        tagLabel,
      });
      return;
    }
    const link = normalizeMoodboardExternalUrl(draft.externalUrl);
    onAccept?.({
      ...draft,
      src: "",
      name: "",
      alt: "",
      width: 0,
      height: 0,
      imageSaved: Boolean(link),
      externalUrl: link,
      tagLabel,
    });
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
          <div className="doc-moodboard-attach__head-copy">
            <h3 className="doc-moodboard-attach__title">{t("doc.moodboard.attachTitle")}</h3>
            <p className="doc-moodboard-attach__desc">
              {t("doc.moodboard.attachDescription")}
            </p>
          </div>
          <button
            type="button"
            className="doc-moodboard-attach__close"
            aria-label={t("doc.moodboard.attachClose")}
            onClick={() => onClose?.()}
          >
            ✕
          </button>
        </div>

        {!readOnly ? (
          <div className="doc-moodboard-attach__modes" role="tablist" aria-label={t("doc.moodboard.attachTitle")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "image"}
              className={
                "doc-moodboard-attach__mode-btn"
                + (mode === "image" ? " doc-moodboard-attach__mode-btn--active" : "")
              }
              onClick={() => setMode("image")}
            >
              {t("doc.moodboard.attachModeImage")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "url"}
              className={
                "doc-moodboard-attach__mode-btn"
                + (mode === "url" ? " doc-moodboard-attach__mode-btn--active" : "")
              }
              onClick={() => setMode("url")}
            >
              {t("doc.moodboard.attachModeUrl")}
            </button>
          </div>
        ) : null}

        {mode === "image" ? (
          <div className="doc-moodboard-attach__field">
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
        ) : (
          <div className="doc-moodboard-attach__field">
            <div className="doc-moodboard-attach__preview doc-moodboard-attach__preview--file">
              <img
                src={MOODBOARD_FILE_ICON_SRC}
                alt={t("doc.moodboard.attachFilePreviewAlt")}
                draggable={false}
              />
            </div>
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
          </div>
        )}

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
              onClick={handleAccept}
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
