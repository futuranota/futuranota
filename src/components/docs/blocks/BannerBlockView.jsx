import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  BANNER_HEADLINE_MAX,
  BANNER_HEADLINE_MAX_LINES,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";

/**
 * @param {CSSStyleDeclaration} style
 * @param {number} [fallback=28.8]
 */
function resolveLineHeightPx(style, fallback = 28.8) {
  const raw = style?.lineHeight;
  if (!raw || raw === "normal") return fallback;
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

/**
 * @param {HTMLElement|null} el
 */
function measureHeadlineMetrics(el) {
  if (!el) {
    return { lineHeight: 28.8, padY: 4 };
  }
  const style = window.getComputedStyle(el);
  const lineHeight = resolveLineHeightPx(style, 28.8);
  const padY = (Number.parseFloat(style.paddingTop) || 0)
    + (Number.parseFloat(style.paddingBottom) || 0);
  return { lineHeight, padY: padY || 4 };
}

/**
 * @param {HTMLTextAreaElement} source
 * @param {string} text
 * @param {number} maxHeight
 */
function textFitsFixedHeight(source, text, maxHeight) {
  if (!(maxHeight > 0)) return false;
  if (!source) return false;
  const probe = document.createElement("textarea");
  const style = window.getComputedStyle(source);
  probe.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "pointer-events:none",
    "top:0",
    "left:0",
    "height:auto",
    "overflow:hidden",
    `width:${Math.max(1, source.clientWidth)}px`,
    `padding:${style.padding}`,
    `border:${style.border}`,
    `box-sizing:${style.boxSizing}`,
    `font:${style.font}`,
    `letter-spacing:${style.letterSpacing}`,
    `line-height:${style.lineHeight}`,
    `white-space:${style.whiteSpace}`,
    `word-break:${style.wordBreak}`,
    `overflow-wrap:${style.overflowWrap}`,
  ].join(";");
  probe.value = text ?? "";
  document.body.appendChild(probe);
  const fits = probe.scrollHeight <= maxHeight + 1;
  document.body.removeChild(probe);
  return fits;
}

/**
 * @param {HTMLTextAreaElement|null} el
 * @param {number} lines
 */
function headlineMaxHeightPx(el, lines = BANNER_HEADLINE_MAX_LINES) {
  const { lineHeight, padY } = measureHeadlineMetrics(el);
  return Math.round(lines * lineHeight + padY);
}

/**
 * Banner: full-width card — image left + bold headline right (WebP upload).
 */
export function BannerBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onDelete,
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const headlineRef = useRef(null);
  const headlineLimitTimerRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [headlineAtLimit, setHeadlineAtLimit] = useState(false);

  const imageSaved = Boolean(block?.imageSaved && block?.src);
  const bannerSaved = Boolean(block?.bannerSaved && imageSaved);
  const isEdit = !bannerSaved;

  const pulseHeadlineLimit = useCallback(() => {
    setHeadlineAtLimit(true);
    if (headlineLimitTimerRef.current) window.clearTimeout(headlineLimitTimerRef.current);
    headlineLimitTimerRef.current = window.setTimeout(() => setHeadlineAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (headlineLimitTimerRef.current) window.clearTimeout(headlineLimitTimerRef.current);
  }, []);

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, bannerSaved: false });
  };

  const handleFiles = async (files) => {
    if (!isEdit) return;
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Always convert to WebP; keep source resolution — slot size is CSS.
      const converted = await convertFileToWebpData(file, { idPrefix: "BNIMG" });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }

      handleFieldChange({
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
        imageSaved: true,
        openFilePicker: false,
      });
    } catch {
      setError(t("doc.imageBlock.convertFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClearImage = () => {
    if (!isEdit) return;
    handleFieldChange({
      src: "",
      name: "",
      alt: "",
      width: 0,
      height: 0,
      imageSaved: false,
      openFilePicker: false,
    });
    setError(null);
  };

  const handleRemoveBlock = () => {
    if (onDelete) {
      onDelete();
      return;
    }
    handleClearImage();
  };

  const handleHeadlineChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "").slice(0, BANNER_HEADLINE_MAX);
    const prev = block?.headline || "";
    if (next === prev) return;

    const el = headlineRef.current;
    const maxH = headlineMaxHeightPx(el);
    if (next.length >= prev.length && el && !textFitsFixedHeight(el, next, maxH)) {
      pulseHeadlineLimit();
      event.target.value = prev;
      return;
    }

    if (next.length >= BANNER_HEADLINE_MAX && next.length >= prev.length) {
      pulseHeadlineLimit();
    }
    handleFieldChange({ headline: next });
  };

  const handleHeadlineKeyDown = (event) => {
    if (!isEdit) return;
    const el = headlineRef.current;
    const maxH = headlineMaxHeightPx(el);
    const cur = block?.headline || "";

    if (event.key === "Enter") {
      const start = el?.selectionStart ?? cur.length;
      const end = el?.selectionEnd ?? start;
      const next = `${cur.slice(0, start)}\n${cur.slice(end)}`.slice(0, BANNER_HEADLINE_MAX);
      if (!el || !textFitsFixedHeight(el, next, maxH)) {
        event.preventDefault();
        pulseHeadlineLimit();
      }
      return;
    }

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable || !el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`;
    if (next.length > BANNER_HEADLINE_MAX || !textFitsFixedHeight(el, next, maxH)) {
      event.preventDefault();
      pulseHeadlineLimit();
    }
  };

  const handleHeadlinePaste = (event) => {
    if (!isEdit) return;
    const el = headlineRef.current;
    if (!el) return;
    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.headline || "";
    const maxH = headlineMaxHeightPx(el);

    let next = `${cur.slice(0, start)}${paste}${cur.slice(end)}`.slice(0, BANNER_HEADLINE_MAX);
    if (!textFitsFixedHeight(el, next, maxH)) {
      let lo = 0;
      let hi = Math.min(paste.length, BANNER_HEADLINE_MAX);
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = `${cur.slice(0, start)}${paste.slice(0, mid)}${cur.slice(end)}`
          .slice(0, BANNER_HEADLINE_MAX);
        if (textFitsFixedHeight(el, candidate, maxH)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      next = `${cur.slice(0, start)}${paste.slice(0, best)}${cur.slice(end)}`
        .slice(0, BANNER_HEADLINE_MAX);
      pulseHeadlineLimit();
    }

    if (next !== cur) handleFieldChange({ headline: next });
  };

  const canSave = imageSaved && !uploading;

  return (
    <div className={"doc-banner" + (bannerSaved ? " doc-banner--saved" : "")}>
      <input
        ref={inputRef}
        type="file"
        className="doc-banner__input"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="doc-banner__card">
        <div className="doc-banner__inner">
          <div className={"doc-banner__media" + (imageSaved ? "" : " doc-banner__media--empty")}>
            {imageSaved ? (
              <>
                <img
                  className="doc-banner__img"
                  src={block.src}
                  alt={block.alt || block.name || t("doc.imageBlock.previewAlt")}
                  width={block.width || undefined}
                  height={block.height || undefined}
                  draggable={false}
                />
                {isEdit ? (
                  <div className="doc-banner__media-actions">
                    <button
                      type="button"
                      className="doc-banner__media-btn"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.replace")}
                    </button>
                    {onDelete ? (
                      <button
                        type="button"
                        className="doc-banner__media-btn"
                        onClick={handleRemoveBlock}
                        disabled={uploading}
                      >
                        {t("doc.imageBlock.remove")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="doc-banner__media-btn"
                        onClick={handleClearImage}
                        disabled={uploading}
                      >
                        {t("doc.imageBlock.remove")}
                      </button>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={
                    "doc-banner__dropzone"
                    + (dragOver ? " doc-banner__dropzone--active" : "")
                    + (uploading ? " doc-banner__dropzone--busy" : "")
                  }
                  disabled={uploading || !isEdit}
                  onClick={() => isEdit && inputRef.current?.click()}
                  onDragEnter={(event) => {
                    if (!isEdit) return;
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragOver={(event) => {
                    if (!isEdit) return;
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                  }}
                  onDrop={(event) => {
                    if (!isEdit) return;
                    event.preventDefault();
                    setDragOver(false);
                    handleFiles(event.dataTransfer?.files);
                  }}
                >
                  <span className="doc-banner__dropzone-title">
                    {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.uploadLabel")}
                  </span>
                  <span className="doc-banner__dropzone-hint">
                    {t("doc.imageBlock.uploadHint")}
                  </span>
                </button>
                {isEdit && onDelete ? (
                  <div className="doc-banner__media-actions">
                    <button
                      type="button"
                      className="doc-banner__media-btn"
                      onClick={handleRemoveBlock}
                      disabled={uploading}
                    >
                      {t("doc.imageBlock.remove")}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="doc-banner__copy">
            <textarea
              ref={headlineRef}
              className={
                "doc-banner__headline"
                + (headlineAtLimit ? " doc-banner__headline--at-limit" : "")
              }
              value={block?.headline || ""}
              maxLength={BANNER_HEADLINE_MAX}
              rows={BANNER_HEADLINE_MAX_LINES}
              placeholder={t("doc.banner.headlinePlaceholder")}
              aria-label={t("doc.banner.headlineLabel")}
              readOnly={!isEdit}
              spellCheck={false}
              onChange={handleHeadlineChange}
              onKeyDown={handleHeadlineKeyDown}
              onPaste={handleHeadlinePaste}
            />
          </div>
        </div>

        <div className="doc-banner__card-actions">
          {isEdit ? (
            <button
              type="button"
              className="doc-banner__save"
              disabled={!canSave}
              onClick={() => {
                if (!canSave) return;
                onSave?.();
              }}
            >
              {t("doc.banner.save")}
            </button>
          ) : (
            <button
              type="button"
              className="doc-banner__edit"
              onClick={() => onEdit?.()}
            >
              {t("doc.banner.edit")}
            </button>
          )}
        </div>
      </div>

      {error ? <p className="doc-banner__error" role="alert">{error}</p> : null}
    </div>
  );
}
