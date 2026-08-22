import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  MOODBOARD_FILE_ICON_SRC,
  MOODBOARD_TAG_MAX,
  normalizeMoodboardExternalUrl,
} from "../../../lib/docBlocks.js";
import {
  libraryFrameCssAspectRatio,
  normalizeLibraryFrameAspect,
} from "../../../lib/libraryFrameAspect.js";
import { resolveWallColor } from "../../../lib/folderLibrary.js";
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
 * Moodboard slot attachment panel — Library-first image mode + URL mode.
 * Image mode: ratio reference frame, pick from Library, download framed product.
 */
export function MoodboardAttachmentModal({
  open,
  image = null,
  readOnly = false,
  onClose,
  onAccept,
  /** Target frame for this slot (`9:16`, …). */
  frameAspect = "9:16",
  canPickLibrary = false,
  onRequestLibrary,
  baking = false,
}) {
  const { t } = useI18n();
  const resolvedFrame = normalizeLibraryFrameAspect(frameAspect) || "9:16";
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
    frameAspect: normalizeLibraryFrameAspect(image?.frameAspect) || resolvedFrame,
    sourceMediaUrl: String(image?.sourceMediaUrl || ""),
    wallColor: image?.wallColor || null,
    libraryItemId: String(image?.libraryItemId || ""),
    libraryOwnerKind: String(image?.libraryOwnerKind || ""),
    libraryOwnerId: String(image?.libraryOwnerId || ""),
  }));
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

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
      frameAspect: normalizeLibraryFrameAspect(image?.frameAspect) || resolvedFrame,
      sourceMediaUrl: String(image?.sourceMediaUrl || ""),
      wallColor: image?.wallColor || null,
      libraryItemId: String(image?.libraryItemId || ""),
      libraryOwnerKind: String(image?.libraryOwnerKind || ""),
      libraryOwnerId: String(image?.libraryOwnerId || ""),
    });
    setError("");
    setDownloading(false);
  }, [open, image, resolvedFrame]);

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
  const canAccept = !baking && !readOnly && (
    mode === "image" ? hasImage : hasLink
  );
  const wallPreview = resolveWallColor(draft.wallColor || "#FFFFFF");
  const frameCss = libraryFrameCssAspectRatio(draft.frameAspect || resolvedFrame) || "9 / 16";
  const frameLabel = normalizeLibraryFrameAspect(draft.frameAspect || resolvedFrame) || resolvedFrame;

  const openExternal = () => {
    if (!normalizedLink) return;
    window.open(normalizedLink, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    if (!draft.src || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(draft.src);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = String(draft.name || draft.tagLabel || "moodboard")
        .trim()
        .replace(/[^\w\-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "moodboard";
      a.download = `${base}_${frameLabel.replace(":", "x")}.webp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(draft.src, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
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
        frameAspect: draft.frameAspect || resolvedFrame,
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
      frameAspect: null,
      sourceMediaUrl: "",
      wallColor: null,
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
              {t("doc.moodboard.attachDescriptionLibrary")}
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
            <div
              className={
                "doc-moodboard-attach__ratio-frame"
                + (hasImage ? " has-image" : "")
              }
              style={{
                aspectRatio: frameCss,
                backgroundColor: hasImage ? wallPreview : "#ffffff",
              }}
            >
              {hasImage ? (
                <img
                  className="doc-moodboard-attach__ratio-img"
                  src={draft.src}
                  alt={draft.alt || ""}
                  draggable={false}
                />
              ) : (
                <span className="doc-moodboard-attach__ratio-label">{frameLabel}</span>
              )}
            </div>

            {!readOnly ? (
              <div className="doc-moodboard-attach__library-actions">
                <button
                  type="button"
                  className="doc-moodboard-attach__library-btn"
                  disabled={baking || !canPickLibrary}
                  onClick={() => onRequestLibrary?.()}
                >
                  {baking
                    ? t("doc.moodboard.frameBaking")
                    : t("doc.moodboard.pickLibrary")}
                </button>
                {!canPickLibrary ? (
                  <p className="doc-moodboard-attach__library-hint">
                    {t("doc.moodboard.libraryRequired")}
                  </p>
                ) : null}
                {hasImage ? (
                  <>
                    <button
                      type="button"
                      className="doc-moodboard-attach__download"
                      disabled={downloading || baking}
                      onClick={handleDownload}
                    >
                      {downloading
                        ? t("doc.library.downloading")
                        : t("doc.moodboard.downloadFramed")}
                    </button>
                    <button
                      type="button"
                      className="doc-moodboard-attach__clear"
                      disabled={baking}
                      onClick={() => {
                        setDraft((prev) => ({
                          ...prev,
                          src: "",
                          name: "",
                          alt: "",
                          width: 0,
                          height: 0,
                          imageSaved: false,
                          sourceMediaUrl: "",
                          libraryItemId: "",
                          libraryOwnerKind: "",
                          libraryOwnerId: "",
                        }));
                      }}
                    >
                      {t("doc.imageBlock.remove")}
                    </button>
                  </>
                ) : null}
              </div>
            ) : hasImage ? (
              <div className="doc-moodboard-attach__library-actions">
                <button
                  type="button"
                  className="doc-moodboard-attach__download"
                  disabled={downloading}
                  onClick={handleDownload}
                >
                  {downloading
                    ? t("doc.library.downloading")
                    : t("doc.moodboard.downloadFramed")}
                </button>
              </div>
            ) : null}
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
