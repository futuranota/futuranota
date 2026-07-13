import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  IMAGE_SPLIT_DESC_MAX,
  IMAGE_SPLIT_TITLE_MAX,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { SlashAwareTextarea } from "./SlashAwareTextarea.jsx";

/**
 * Find the longest prefix of `text` that fits in a box matching `source` styles
 * at the given max height. Prefer breaks at newline/space near the cut.
 * @param {HTMLTextAreaElement} source
 * @param {string} text
 * @param {number} maxHeight
 * @returns {{ keep: string, spill: string }}
 */
function splitTextToFitHeight(source, text, maxHeight) {
  if (!source || !(maxHeight > 0) || !text) {
    return { keep: text || "", spill: "" };
  }

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
    `width:${source.clientWidth}px`,
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
  probe.value = text;
  document.body.appendChild(probe);

  const fits = (value) => {
    probe.value = value;
    return probe.scrollHeight <= maxHeight + 1;
  };

  if (fits(text)) {
    document.body.removeChild(probe);
    return { keep: text, spill: "" };
  }

  let lo = 0;
  let hi = text.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fits(text.slice(0, mid))) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  document.body.removeChild(probe);

  if (best <= 0) {
    return { keep: "", spill: text };
  }

  let cut = best;
  const windowStart = Math.max(0, best - 48);
  const region = text.slice(windowStart, best);
  const nl = region.lastIndexOf("\n");
  const sp = region.lastIndexOf(" ");
  const soft = Math.max(nl, sp);
  if (soft > 0) {
    cut = windowStart + soft + 1;
  }

  return {
    keep: text.slice(0, cut),
    spill: text.slice(cut),
  };
}

export function ImageSplitBlockView({
  block,
  onChange,
  onDelete,
  onBodyKeyDown,
  onBodySpill,
  autoFocusBody = false,
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const rowRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const spillLockRef = useRef(false);
  const onBodySpillRef = useRef(onBodySpill);
  onBodySpillRef.current = onBodySpill;
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [bodyMaxHeight, setBodyMaxHeight] = useState(null);
  const imageSaved = Boolean(block?.imageSaved && block?.src);

  useEffect(() => {
    if (!block?.openFilePicker || imageSaved || uploading) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.click();
      onChange?.({ openFilePicker: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [block?.openFilePicker, block?.id, imageSaved, uploading, onChange]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const row = rowRef.current;
    if (!card || !row || typeof ResizeObserver === "undefined") return undefined;

    const sync = () => {
      const height = Math.round(card.getBoundingClientRect().height);
      if (height > 0) {
        row.style.setProperty("--image-split-body-max", `${height}px`);
        setBodyMaxHeight(height);
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(card);
    return () => ro.disconnect();
  }, [imageSaved, block?.overlayTitle, block?.overlayDescription]);

  useLayoutEffect(() => {
    if (spillLockRef.current) return;
    if (!(bodyMaxHeight > 0)) return;
    const el = bodyTextareaRef.current;
    const text = block?.body || "";
    if (!el || !text) return;

    const raf = requestAnimationFrame(() => {
      if (spillLockRef.current) return;
      if (el.scrollHeight <= el.clientHeight + 1) return;
      const { keep, spill } = splitTextToFitHeight(el, text, bodyMaxHeight);
      if (!spill) return;
      spillLockRef.current = true;
      onBodySpillRef.current?.({ keepBody: keep, spillText: spill });
      requestAnimationFrame(() => {
        spillLockRef.current = false;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [block?.body, bodyMaxHeight]);

  const handleFiles = async (files) => {
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
      });
    } catch {
      setError(t("doc.imageBlock.convertFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClearImage = () => {
    onChange?.({
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

  const handleBodyChange = (body) => {
    onChange?.({ body });
  };

  return (
    <div className="doc-image-split">
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
            type="text"
            className="doc-image-split__title"
            value={block?.overlayTitle || ""}
            maxLength={IMAGE_SPLIT_TITLE_MAX}
            placeholder={t("doc.imageSplit.titlePlaceholder")}
            aria-label={t("doc.imageSplit.titleLabel")}
            onChange={(event) => onChange?.({ overlayTitle: event.target.value })}
          />
          <textarea
            className="doc-image-split__desc"
            value={block?.overlayDescription || ""}
            maxLength={IMAGE_SPLIT_DESC_MAX}
            rows={2}
            placeholder={t("doc.imageSplit.descPlaceholder")}
            aria-label={t("doc.imageSplit.descLabel")}
            onChange={(event) => onChange?.({ overlayDescription: event.target.value })}
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
            </div>
          ) : (
            <button
              type="button"
              className={
                "doc-image-split__dropzone"
                + (dragOver ? " doc-image-split__dropzone--active" : "")
                + (uploading ? " doc-image-split__dropzone--busy" : "")
              }
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragOver(false);
              }}
              onDrop={(event) => {
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

        <div className="doc-image-split__body">
          <SlashAwareTextarea
            value={block?.body || ""}
            onChange={handleBodyChange}
            onKeyDown={onBodyKeyDown}
            autoFocus={autoFocusBody}
            placeholder={t("doc.imageSplit.bodyPlaceholder")}
            className="doc-image-split__body-field"
            wrapClassName="doc-image-split__body-wrap"
            minHeightPx={bodyMaxHeight || 120}
            maxHeightPx={bodyMaxHeight || 120}
            inputRef={bodyTextareaRef}
          />
        </div>
      </div>

      {error ? <p className="doc-image-split__error" role="alert">{error}</p> : null}

      {onDelete ? (
        <div className="doc-image-split__actions">
          <button
            type="button"
            className="doc-image-split__delete"
            onClick={onDelete}
          >
            {t("common.delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
