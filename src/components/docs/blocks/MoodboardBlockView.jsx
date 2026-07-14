import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  IMAGE_SPLIT_BODY_MAX_LINES,
  MOODBOARD_CAPTION_MAX,
  MOODBOARD_CAPTION_MAX_LINES,
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
 * @param {HTMLElement|null} el
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
 * Max pixel height for N caption lines.
 * @param {HTMLTextAreaElement|null} el
 * @param {number} lines
 */
function captionMaxHeightPx(el, lines = MOODBOARD_CAPTION_MAX_LINES) {
  const { lineHeight, padY } = measureBodyLineMetrics(el);
  return Math.round(lines * lineHeight + padY);
}

/**
 * Moodboard: two WebP image slots + Pangolin caption (≤2 lines) + 17-line body.
 */
export function MoodboardBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onDelete,
  onConvertLayout,
  onBodyKeyDown,
  autoFocusBody = false,
}) {
  const { t } = useI18n();
  const inputARef = useRef(null);
  const inputBRef = useRef(null);
  const cardRef = useRef(null);
  const rowRef = useRef(null);
  const captionRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const captionLimitTimerRef = useRef(null);
  const bodyLimitTimerRef = useRef(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [error, setError] = useState(null);
  const [bodyMaxHeight, setBodyMaxHeight] = useState(null);
  const bodyMaxHeightRef = useRef(null);
  const [captionAtLimit, setCaptionAtLimit] = useState(false);
  const [bodyAtLimit, setBodyAtLimit] = useState(false);

  const slotA = block?.a || {};
  const slotB = block?.b || {};
  const aSaved = Boolean(slotA.imageSaved && slotA.src);
  const bSaved = Boolean(slotB.imageSaved && slotB.src);
  const bothSaved = aSaved && bSaved;
  const moodboardSaved = Boolean(block?.moodboardSaved && bothSaved);
  const isEdit = !moodboardSaved;

  const pulseCaptionLimit = useCallback(() => {
    setCaptionAtLimit(true);
    if (captionLimitTimerRef.current) window.clearTimeout(captionLimitTimerRef.current);
    captionLimitTimerRef.current = window.setTimeout(() => setCaptionAtLimit(false), 700);
  }, []);

  const pulseBodyLimit = useCallback(() => {
    setBodyAtLimit(true);
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
    bodyLimitTimerRef.current = window.setTimeout(() => setBodyAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (captionLimitTimerRef.current) window.clearTimeout(captionLimitTimerRef.current);
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const row = rowRef.current;
    if (!card || !row || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      const bodyEl = bodyTextareaRef.current
        || row.querySelector(".doc-moodboard__body-field, .doc-moodboard__body-static");
      const { lineHeight, padY } = measureBodyLineMetrics(bodyEl);
      const writeHeight = Math.max(
        Math.round(lineHeight + padY),
        Math.round(IMAGE_SPLIT_BODY_MAX_LINES * lineHeight + padY),
      );

      row.style.setProperty("--moodboard-body-max", `${writeHeight}px`);
      card.style.height = `${writeHeight}px`;
      card.style.minHeight = `${writeHeight}px`;
      card.style.maxHeight = `${writeHeight}px`;

      bodyMaxHeightRef.current = writeHeight;
      setBodyMaxHeight((prev) => (prev === writeHeight ? prev : writeHeight));
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(card);
    ro.observe(row);
    return () => {
      ro.disconnect();
      card.style.height = "";
      card.style.minHeight = "";
      card.style.maxHeight = "";
    };
  }, [aSaved, bSaved, block?.caption, moodboardSaved]);

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, moodboardSaved: false });
  };

  const handleFilesForSlot = async (slotKey, files) => {
    if (!isEdit) return;
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("doc.imageBlock.invalidType"));
      return;
    }

    setUploadingSlot(slotKey);
    setError(null);

    try {
      // Always convert to WebP; keep source resolution — slot size is CSS (object-fit).
      const converted = await convertFileToWebpData(file, {
        idPrefix: slotKey === "a" ? "MBDA" : "MBDB",
      });
      if (!converted) {
        setError(t("doc.imageBlock.convertFailed"));
        return;
      }

      const nextSlot = {
        src: converted.src,
        name: converted.name,
        alt: (file.name || "image").replace(/\.[^/.]+$/, ""),
        width: converted.width,
        height: converted.height,
        imageSaved: true,
      };
      handleFieldChange({
        [slotKey]: nextSlot,
        openFilePicker: false,
      });
    } catch {
      setError(t("doc.imageBlock.convertFailed"));
    } finally {
      setUploadingSlot(null);
      const input = slotKey === "a" ? inputARef.current : inputBRef.current;
      if (input) input.value = "";
    }
  };

  const clearSlot = (slotKey) => {
    if (!isEdit) return;
    handleFieldChange({
      [slotKey]: {
        src: "",
        name: "",
        alt: "",
        width: 0,
        height: 0,
        imageSaved: false,
      },
    });
    setError(null);
  };

  const handleRemoveBlock = () => {
    if (onDelete) {
      onDelete();
      return;
    }
    clearSlot("a");
    clearSlot("b");
  };

  const handleCaptionChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "").slice(0, MOODBOARD_CAPTION_MAX);
    const prev = block?.caption || "";
    if (next === prev) return;

    const el = captionRef.current;
    const maxH = captionMaxHeightPx(el);
    if (next.length >= prev.length && el && !textFitsFixedHeight(el, next, maxH)) {
      pulseCaptionLimit();
      event.target.value = prev;
      return;
    }

    if (next.length >= MOODBOARD_CAPTION_MAX && next.length >= prev.length) {
      pulseCaptionLimit();
    }
    handleFieldChange({ caption: next });
  };

  const handleCaptionKeyDown = (event) => {
    if (!isEdit) return;
    const el = captionRef.current;
    const maxH = captionMaxHeightPx(el);
    const cur = block?.caption || "";

    if (event.key === "Enter") {
      const start = el?.selectionStart ?? cur.length;
      const end = el?.selectionEnd ?? start;
      const next = `${cur.slice(0, start)}\n${cur.slice(end)}`.slice(0, MOODBOARD_CAPTION_MAX);
      if (!el || !textFitsFixedHeight(el, next, maxH)) {
        event.preventDefault();
        pulseCaptionLimit();
      }
      return;
    }

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable || !el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`;
    if (next.length > MOODBOARD_CAPTION_MAX || !textFitsFixedHeight(el, next, maxH)) {
      event.preventDefault();
      pulseCaptionLimit();
    }
  };

  const handleCaptionPaste = (event) => {
    if (!isEdit) return;
    const el = captionRef.current;
    if (!el) return;
    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.caption || "";
    const maxH = captionMaxHeightPx(el);

    let next = `${cur.slice(0, start)}${paste}${cur.slice(end)}`.slice(0, MOODBOARD_CAPTION_MAX);
    if (!textFitsFixedHeight(el, next, maxH)) {
      let lo = 0;
      let hi = Math.min(paste.length, MOODBOARD_CAPTION_MAX);
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = `${cur.slice(0, start)}${paste.slice(0, mid)}${cur.slice(end)}`
          .slice(0, MOODBOARD_CAPTION_MAX);
        if (textFitsFixedHeight(el, candidate, maxH)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      next = `${cur.slice(0, start)}${paste.slice(0, best)}${cur.slice(end)}`
        .slice(0, MOODBOARD_CAPTION_MAX);
      pulseCaptionLimit();
    }

    if (next !== cur) handleFieldChange({ caption: next });
  };

  const resolveBodyMaxHeight = () => bodyMaxHeightRef.current || bodyMaxHeight;

  const handleBodyChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "");
    const prev = block?.body || "";
    if (next === prev) return;

    const el = bodyTextareaRef.current;
    const maxH = resolveBodyMaxHeight();

    if (next.length >= prev.length) {
      if (!maxH || !el || !textFitsFixedHeight(el, next, maxH)) {
        pulseBodyLimit();
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
      if (!maxH || !el || !textFitsFixedHeight(el, next, maxH)) {
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
    if (next.length > cur.length && (!maxH || !textFitsFixedHeight(el, next, maxH))) {
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

    if (!textFitsFixedHeight(el, next, maxH)) {
      let lo = 0;
      let hi = paste.length;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = `${cur.slice(0, start)}${paste.slice(0, mid)}${cur.slice(end)}`;
        if (textFitsFixedHeight(el, candidate, maxH)) {
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

  const canSave = bothSaved && !uploadingSlot;

  const renderSlot = (slotKey) => {
    const slot = slotKey === "a" ? slotA : slotB;
    const saved = slotKey === "a" ? aSaved : bSaved;
    const inputRef = slotKey === "a" ? inputARef : inputBRef;
    const uploading = uploadingSlot === slotKey;
    const dragOver = dragOverSlot === slotKey;

    return (
      <div
        className={
          "doc-moodboard__slot"
          + ` doc-moodboard__slot--${slotKey}`
          + (saved ? "" : " doc-moodboard__slot--empty")
        }
      >
        {saved ? (
          <>
            <img
              className="doc-moodboard__img"
              src={slot.src}
              alt={slot.alt || slot.name || t("doc.imageBlock.previewAlt")}
              width={slot.width || undefined}
              height={slot.height || undefined}
              draggable={false}
            />
            {isEdit ? (
              <div className="doc-moodboard__media-actions">
                <button
                  type="button"
                  className="doc-moodboard__media-btn"
                  onClick={() => inputRef.current?.click()}
                  disabled={Boolean(uploadingSlot)}
                >
                  {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.replace")}
                </button>
                {onDelete ? (
                  <button
                    type="button"
                    className="doc-moodboard__media-btn"
                    onClick={handleRemoveBlock}
                    disabled={Boolean(uploadingSlot)}
                  >
                    {t("doc.imageBlock.remove")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="doc-moodboard__media-btn"
                    onClick={() => clearSlot(slotKey)}
                    disabled={Boolean(uploadingSlot)}
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
                "doc-moodboard__dropzone"
                + (dragOver ? " doc-moodboard__dropzone--active" : "")
                + (uploading ? " doc-moodboard__dropzone--busy" : "")
              }
              disabled={Boolean(uploadingSlot) || !isEdit}
              onClick={() => isEdit && inputRef.current?.click()}
              onDragEnter={(event) => {
                if (!isEdit) return;
                event.preventDefault();
                setDragOverSlot(slotKey);
              }}
              onDragOver={(event) => {
                if (!isEdit) return;
                event.preventDefault();
                setDragOverSlot(slotKey);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragOverSlot((prev) => (prev === slotKey ? null : prev));
              }}
              onDrop={(event) => {
                if (!isEdit) return;
                event.preventDefault();
                setDragOverSlot(null);
                handleFilesForSlot(slotKey, event.dataTransfer?.files);
              }}
            >
              <span className="doc-moodboard__dropzone-title">
                {uploading ? t("doc.imageBlock.uploading") : t("doc.imageBlock.uploadLabel")}
              </span>
            </button>
            {isEdit && onDelete ? (
              <div className="doc-moodboard__media-actions">
                <button
                  type="button"
                  className="doc-moodboard__media-btn"
                  onClick={handleRemoveBlock}
                  disabled={Boolean(uploadingSlot)}
                >
                  {t("doc.imageBlock.remove")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={"doc-moodboard" + (moodboardSaved ? " doc-moodboard--saved" : "")}>
      <input
        ref={inputARef}
        type="file"
        className="doc-moodboard__input"
        accept="image/*"
        onChange={(event) => handleFilesForSlot("a", event.target.files)}
      />
      <input
        ref={inputBRef}
        type="file"
        className="doc-moodboard__input"
        accept="image/*"
        onChange={(event) => handleFilesForSlot("b", event.target.files)}
      />

      <div className="doc-moodboard__row" ref={rowRef}>
        <div className="doc-moodboard__card" ref={cardRef}>
          <div className="doc-moodboard__board">
            {renderSlot("a")}
            {renderSlot("b")}
            <textarea
              ref={captionRef}
              className={
                "doc-moodboard__caption"
                + (captionAtLimit ? " doc-moodboard__caption--at-limit" : "")
              }
              value={block?.caption || ""}
              maxLength={MOODBOARD_CAPTION_MAX}
              rows={MOODBOARD_CAPTION_MAX_LINES}
              placeholder={t("doc.moodboard.captionPlaceholder")}
              aria-label={t("doc.moodboard.captionLabel")}
              readOnly={!isEdit}
              spellCheck={false}
              onChange={handleCaptionChange}
              onKeyDown={handleCaptionKeyDown}
              onPaste={handleCaptionPaste}
            />
          </div>

          <div className="doc-moodboard__float-actions">
            {isEdit ? (
              <button
                type="button"
                className="doc-moodboard__save"
                disabled={!canSave}
                onClick={() => {
                  if (!canSave) return;
                  onSave?.();
                }}
              >
                {t("doc.moodboard.save")}
              </button>
            ) : (
              <button
                type="button"
                className="doc-moodboard__edit"
                onClick={() => onEdit?.()}
              >
                {t("doc.moodboard.edit")}
              </button>
            )}
            {onConvertLayout ? (
              <>
                <button
                  type="button"
                  className="doc-moodboard__switch"
                  onClick={() => onConvertLayout("image_split")}
                >
                  {t("doc.layoutSwitch.imageSplit")}
                </button>
                <button
                  type="button"
                  className="doc-moodboard__switch"
                  onClick={() => onConvertLayout("banner")}
                >
                  {t("doc.layoutSwitch.banner")}
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="doc-moodboard__side">
          <div className="doc-moodboard__body">
            {isEdit ? (
              <textarea
                ref={bodyTextareaRef}
                className={
                  "doc-moodboard__body-field"
                  + (bodyAtLimit ? " doc-moodboard__body-field--at-limit" : "")
                }
                value={block?.body || ""}
                placeholder={t("doc.moodboard.bodyPlaceholder")}
                aria-label={t("doc.moodboard.bodyPlaceholder")}
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
                className="doc-moodboard__body-static"
                style={bodyMaxHeight ? { height: bodyMaxHeight, maxHeight: bodyMaxHeight } : undefined}
              >
                {block?.body || ""}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="doc-moodboard__error" role="alert">{error}</p> : null}
    </div>
  );
}
