import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  IMAGE_SPLIT_DESC_MAX,
  IMAGE_SPLIT_TITLE_MAX,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";

/**
 * @param {CSSStyleDeclaration} style
 * @param {number} [fallback=20.3]
 */
function resolveLineHeightPx(style, fallback = 20.3) {
  const raw = style?.lineHeight;
  if (!raw || raw === "normal") return fallback;
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

/**
 * Snap UP so card and body share the same foot.
 * @param {number} rawHeight
 * @param {number} lineHeight
 * @param {number} padY
 */
function snapHeightToLinesUp(rawHeight, lineHeight, padY) {
  if (!(rawHeight > 0) || !(lineHeight > 0)) return rawHeight;
  const usable = Math.max(0, rawHeight - padY);
  const lines = Math.max(1, Math.ceil(usable / lineHeight - 1e-6));
  return Math.round(lines * lineHeight + padY);
}

/**
 * @param {HTMLTextAreaElement|null} el
 */
function measureBodyLineMetrics(el) {
  if (!el) {
    return { lineHeight: 20.3, padY: 4 };
  }
  const style = window.getComputedStyle(el);
  const lineHeight = resolveLineHeightPx(style, 20.3);
  const padY = (Number.parseFloat(style.paddingTop) || 0)
    + (Number.parseFloat(style.paddingBottom) || 0);
  return { lineHeight, padY: padY || 4 };
}

/**
 * Whether `text` fits in one line of a full-width title input.
 * @param {HTMLInputElement} input
 * @param {string} text
 */
function titleFitsOneLine(input, text) {
  if (!input) return true;
  const probe = document.createElement("span");
  const style = window.getComputedStyle(input);
  probe.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "white-space:pre",
    "top:0",
    "left:0",
    `font:${style.font}`,
    `letter-spacing:${style.letterSpacing}`,
    `padding:${style.padding}`,
  ].join(";");
  probe.textContent = text || "";
  document.body.appendChild(probe);
  const fits = probe.offsetWidth <= Math.max(1, input.clientWidth) + 1;
  document.body.removeChild(probe);
  return fits;
}

/**
 * Whether `text` fits in a fixed-height body box matching `source` styles.
 * @param {HTMLTextAreaElement} source
 * @param {string} text
 * @param {number} maxHeight
 */
function bodyTextFitsHeight(source, text, maxHeight) {
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
 * Unified image-split: hard text caps + red caret when at stop limit.
 */
export function ImageSplitBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onBodyKeyDown,
  autoFocusBody = false,
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const rowRef = useRef(null);
  const titleRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const titleLimitTimerRef = useRef(null);
  const bodyLimitTimerRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [bodyMaxHeight, setBodyMaxHeight] = useState(null);
  const bodyMaxHeightRef = useRef(null);
  const [titleAtLimit, setTitleAtLimit] = useState(false);
  const [bodyAtLimit, setBodyAtLimit] = useState(false);
  const imageSaved = Boolean(block?.imageSaved && block?.src);
  const splitSaved = Boolean(block?.splitSaved && imageSaved);
  const isEdit = !splitSaved;

  const pulseTitleLimit = useCallback(() => {
    setTitleAtLimit(true);
    if (titleLimitTimerRef.current) window.clearTimeout(titleLimitTimerRef.current);
    titleLimitTimerRef.current = window.setTimeout(() => setTitleAtLimit(false), 700);
  }, []);

  const pulseBodyLimit = useCallback(() => {
    setBodyAtLimit(true);
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
    bodyLimitTimerRef.current = window.setTimeout(() => setBodyAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (titleLimitTimerRef.current) window.clearTimeout(titleLimitTimerRef.current);
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isEdit || !block?.openFilePicker || imageSaved || uploading) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.click();
      onChange?.({ openFilePicker: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [block?.openFilePicker, block?.id, imageSaved, uploading, onChange, isEdit]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const row = rowRef.current;
    if (!card || !row || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      card.style.minHeight = "";

      const natural = Math.round(card.getBoundingClientRect().height);
      if (!(natural > 0)) return;

      const { lineHeight, padY } = measureBodyLineMetrics(bodyTextareaRef.current);
      const target = snapHeightToLinesUp(natural, lineHeight, padY);
      const grow = Math.max(0, target - natural);

      if (grow > 0 && grow <= lineHeight + 1) {
        card.style.minHeight = `${target}px`;
      }

      // Hard write box ends one line above Save (Save sits in .foot below).
      const writeHeight = Math.max(
        Math.round(lineHeight + padY),
        Math.round(target - lineHeight),
      );

      row.style.setProperty("--image-split-body-max", `${writeHeight}px`);
      bodyMaxHeightRef.current = writeHeight;
      setBodyMaxHeight((prev) => (prev === writeHeight ? prev : writeHeight));
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(card);
    return () => {
      ro.disconnect();
      card.style.minHeight = "";
    };
  }, [imageSaved, block?.overlayTitle, block?.overlayDescription, splitSaved]);

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
      const converted = await convertFileToWebpData(file, { idPrefix: "SPLIMG" });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }

      onChange?.({
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
        imageSaved: true,
        openFilePicker: false,
        splitSaved: false,
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
    onChange?.({
      src: "",
      name: "",
      alt: "",
      width: 0,
      height: 0,
      imageSaved: false,
      openFilePicker: false,
      splitSaved: false,
    });
    setError(null);
  };

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, splitSaved: false });
  };

  const handleTitleChange = (event) => {
    if (!isEdit) return;
    const next = event.target.value.slice(0, IMAGE_SPLIT_TITLE_MAX);
    const prev = block?.overlayTitle || "";
    if (next === prev) return;

    // Allow shortening always; block growth past one-line width.
    if (next.length >= prev.length && !titleFitsOneLine(titleRef.current, next)) {
      pulseTitleLimit();
      return;
    }

    handleFieldChange({ overlayTitle: next });
    if (next.length >= IMAGE_SPLIT_TITLE_MAX || !titleFitsOneLine(titleRef.current, next + "M")) {
      // At soft edge after accepting this char
      requestAnimationFrame(() => {
        if (titleRef.current && !titleFitsOneLine(titleRef.current, (next || "") + "i")) {
          pulseTitleLimit();
        }
      });
    }
  };

  const handleTitleKeyDown = (event) => {
    if (!isEdit) return;
    if (event.key === "Enter") {
      event.preventDefault();
      pulseTitleLimit();
      return;
    }
    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable) return;
    const el = titleRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.overlayTitle || "";
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`.slice(0, IMAGE_SPLIT_TITLE_MAX);
    if (next.length > cur.length && !titleFitsOneLine(el, next)) {
      event.preventDefault();
      pulseTitleLimit();
    }
  };

  const resolveBodyMaxHeight = () => bodyMaxHeightRef.current || bodyMaxHeight;

  const handleBodyChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "");
    const prev = block?.body || "";
    if (next === prev) return;

    const el = bodyTextareaRef.current;
    const maxH = resolveBodyMaxHeight();

    // Hard stop: same idea as title (one-line card) — no growth past the box
    // that ends before the Save button.
    if (next.length >= prev.length) {
      if (!maxH || !el || !bodyTextFitsHeight(el, next, maxH)) {
        pulseBodyLimit();
        // Revert controlled value by not updating; force DOM value back.
        event.target.value = prev;
        return;
      }
    }

    handleFieldChange({ body: next });
  };

  const handleBodyKeyDown = (event) => {
    if (!isEdit) return;

    const el = bodyTextareaRef.current;
    const maxH = resolveBodyMaxHeight();
    const cur = block?.body || "";

    if (event.key === "Enter" && !event.shiftKey) {
      onBodyKeyDown?.(event);
      if (event.defaultPrevented) return;

      const start = el?.selectionStart ?? cur.length;
      const end = el?.selectionEnd ?? start;
      const next = `${cur.slice(0, start)}\n${cur.slice(end)}`;
      if (!maxH || !el || !bodyTextFitsHeight(el, next, maxH)) {
        event.preventDefault();
        pulseBodyLimit();
      }
      return;
    }

    onBodyKeyDown?.(event);
    if (event.defaultPrevented) return;

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable || !el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`;
    if (next.length > cur.length && (!maxH || !bodyTextFitsHeight(el, next, maxH))) {
      event.preventDefault();
      pulseBodyLimit();
    }
  };

  const handleBodyPaste = (event) => {
    if (!isEdit) return;
    const el = bodyTextareaRef.current;
    const maxH = resolveBodyMaxHeight();
    if (!el) return;

    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.body || "";

    if (!maxH) {
      pulseBodyLimit();
      return;
    }

    let next = `${cur.slice(0, start)}${paste}${cur.slice(end)}`;

    if (!bodyTextFitsHeight(el, next, maxH)) {
      let lo = 0;
      let hi = paste.length;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = `${cur.slice(0, start)}${paste.slice(0, mid)}${cur.slice(end)}`;
        if (bodyTextFitsHeight(el, candidate, maxH)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      next = `${cur.slice(0, start)}${paste.slice(0, best)}${cur.slice(end)}`;
      pulseBodyLimit();
    }

    if (next !== cur) handleFieldChange({ body: next });
  };

  const canSave = imageSaved && !uploading;

  return (
    <div className={"doc-image-split" + (splitSaved ? " doc-image-split--saved" : "")}>
      <input
        ref={inputRef}
        type="file"
        className="doc-image-split__input"
        accept="image/*"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="doc-image-split__row" ref={rowRef}>
        <div className="doc-image-split__card" ref={cardRef}>
          <input
            ref={titleRef}
            type="text"
            className={
              "doc-image-split__title"
              + (titleAtLimit ? " doc-image-split__title--at-limit" : "")
            }
            value={block?.overlayTitle || ""}
            maxLength={IMAGE_SPLIT_TITLE_MAX}
            placeholder={t("doc.imageSplit.titlePlaceholder")}
            aria-label={t("doc.imageSplit.titleLabel")}
            readOnly={!isEdit}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
          />
          <textarea
            className="doc-image-split__desc"
            value={block?.overlayDescription || ""}
            maxLength={IMAGE_SPLIT_DESC_MAX}
            rows={3}
            placeholder={t("doc.imageSplit.descPlaceholder")}
            aria-label={t("doc.imageSplit.descLabel")}
            readOnly={!isEdit}
            onChange={(event) => handleFieldChange({ overlayDescription: event.target.value })}
          />

          {imageSaved ? (
            <div className="doc-image-split__media">
              <img
                className="doc-image-split__img"
                src={block.src}
                alt={block.alt || block.name || t("doc.imageBlock.previewAlt")}
                width={block.width || undefined}
                height={block.height || undefined}
                draggable={false}
              />
              {isEdit ? (
                <div className="doc-image-split__media-actions">
                  <button
                    type="button"
                    className="doc-image-split__media-btn"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.replace")}
                  </button>
                  <button
                    type="button"
                    className="doc-image-split__media-btn"
                    onClick={handleClearImage}
                    disabled={uploading}
                  >
                    {t("doc.imageBlock.remove")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              className={
                "doc-image-split__dropzone"
                + (dragOver ? " doc-image-split__dropzone--active" : "")
                + (uploading ? " doc-image-split__dropzone--busy" : "")
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
              <span className="doc-image-split__dropzone-title">
                {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.uploadLabel")}
              </span>
              <span className="doc-image-split__dropzone-hint">
                {t("doc.imageBlock.uploadHint")}
              </span>
            </button>
          )}
        </div>

        <div className="doc-image-split__side">
          <div className="doc-image-split__body">
            {isEdit ? (
              <textarea
                ref={bodyTextareaRef}
                className={
                  "doc-image-split__body-field"
                  + (bodyAtLimit ? " doc-image-split__body-field--at-limit" : "")
                }
                value={block?.body || ""}
                placeholder={t("doc.imageSplit.bodyPlaceholder")}
                aria-label={t("doc.imageSplit.bodyPlaceholder")}
                spellCheck={false}
                autoFocus={autoFocusBody}
                onChange={handleBodyChange}
                onKeyDown={handleBodyKeyDown}
                onPaste={handleBodyPaste}
                style={bodyMaxHeight ? {
                  height: `${bodyMaxHeight}px`,
                  maxHeight: `${bodyMaxHeight}px`,
                } : undefined}
              />
            ) : (
              <div
                className="doc-image-split__body-static"
                style={bodyMaxHeight ? { height: bodyMaxHeight, maxHeight: bodyMaxHeight } : undefined}
              >
                {block?.body || ""}
              </div>
            )}
          </div>

          <div className="doc-image-split__foot">
            {isEdit ? (
              <button
                type="button"
                className="doc-image-split__save"
                disabled={!canSave}
                onClick={() => {
                  if (!canSave) return;
                  onSave?.();
                }}
              >
                {t("doc.imageSplit.save")}
              </button>
            ) : (
              <button
                type="button"
                className="doc-image-split__edit"
                onClick={() => onEdit?.()}
              >
                {t("doc.imageSplit.edit")}
              </button>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="doc-image-split__error" role="alert">{error}</p> : null}
    </div>
  );
}
