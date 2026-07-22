import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { convertFileToWebpData } from "../../../lib/convertImageToWebp.js";
import {
  createTodoItem,
  IMAGE_SPLIT_BODY_MAX_LINES,
  IMAGE_SPLIT_BODY_MODE,
} from "../../../lib/docBlocks.js";
import {
  IMAGE_CARD_BODY_SLASH_GHOST_HINTS,
  splitBodyForSlash,
} from "../../../lib/docBlockSlash.js";
import { useI18n } from "../../../i18n/useI18n.js";
import {
  resolveSlashGhostOverlayPosition,
} from "../../../lib/textareaSelectionRect.js";

/** Card padding (matches CSS `.doc-image-split__card { padding: 6px }`). */
const IMAGE_SPLIT_CARD_PAD_PX = 6;
/** Empty-dropzone / loading placeholder aspect (height / width). */
const IMAGE_SPLIT_EMPTY_ASPECT = 0.72;

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
 * Whether `text` fits in a fixed-height body box matching `source` styles.
 * Used only as a soft "at limit" cue — content is never truncated.
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
 * Unified image-split: image card + body (text or embedded todo).
 * Body height is capped visually at IMAGE_SPLIT_BODY_MAX_LINES; overflow scrolls
 * so paste/typing never truncates stored content.
 */
export function ImageSplitBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onDelete,
  onConvertLayout,
  onBodyKeyDown,
  autoFocusBody = false,
  focusTodoItemId = null,
  bodySlashGhostHints = IMAGE_CARD_BODY_SLASH_GHOST_HINTS,
}) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const rowRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const bodyWrapRef = useRef(null);
  const todoInputRefs = useRef({});
  const bodyLimitTimerRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [bodyAtLimit, setBodyAtLimit] = useState(false);
  const [bodyMaxHeight, setBodyMaxHeight] = useState(null);
  const bodyMaxHeightRef = useRef(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [ghostPos, setGhostPos] = useState(null);

  const imageSaved = Boolean(block?.imageSaved && block?.src);
  const splitSaved = Boolean(block?.splitSaved && imageSaved);
  const isEdit = !splitSaved;
  const bodyMode = block?.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
    ? IMAGE_SPLIT_BODY_MODE.TODO
    : IMAGE_SPLIT_BODY_MODE.TEXT;
  const isTodoBody = bodyMode === IMAGE_SPLIT_BODY_MODE.TODO;
  const todoItems = Array.isArray(block?.todoItems) && block.todoItems.length > 0
    ? block.todoItems
    : [createTodoItem()];

  const bodyValue = block?.body || "";
  const { slash: bodySlash } = splitBodyForSlash(bodyValue);
  const showSlashGhost = Boolean(
    isEdit && !isTodoBody && bodySlash && /^\/\s*$/.test(bodySlash),
  );
  const ghostHints = Array.isArray(bodySlashGhostHints) && bodySlashGhostHints.length > 0
    ? bodySlashGhostHints
    : IMAGE_CARD_BODY_SLASH_GHOST_HINTS;

  const pulseBodyLimit = useCallback(() => {
    setBodyAtLimit(true);
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
    bodyLimitTimerRef.current = window.setTimeout(() => setBodyAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
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
      const bodyEl = bodyTextareaRef.current
        || row.querySelector(
          ".doc-image-split__body-field, .doc-image-split__body-static, .doc-image-split__embedded-todo",
        );
      const { lineHeight, padY } = measureBodyLineMetrics(bodyEl);
      // Text column: fixed visible cap (scrolls when longer). Independent of card.
      const writeHeight = Math.max(
        Math.round(lineHeight + padY),
        Math.round(IMAGE_SPLIT_BODY_MAX_LINES * lineHeight + padY),
      );

      // Card: height follows image aspect so media fills with only 6px padding.
      const padTotal = IMAGE_SPLIT_CARD_PAD_PX * 2;
      const innerW = Math.max(1, card.clientWidth - padTotal);
      const imgEl = card.querySelector("img.doc-image-split__img");
      const iw = Number(block?.width) || imgEl?.naturalWidth || 0;
      const ih = Number(block?.height) || imgEl?.naturalHeight || 0;
      const ratio = (imageSaved && iw > 0 && ih > 0)
        ? (ih / iw)
        : IMAGE_SPLIT_EMPTY_ASPECT;
      const naturalCardH = Math.round(innerW * ratio + padTotal);
      // Cap extreme portrait so the row stays readable next to the text column.
      const cardHeight = Math.max(
        Math.round(lineHeight + padY + padTotal),
        Math.min(naturalCardH, writeHeight),
      );

      row.style.setProperty("--image-split-body-max", `${writeHeight}px`);
      card.style.height = `${cardHeight}px`;
      card.style.minHeight = `${cardHeight}px`;
      card.style.maxHeight = `${cardHeight}px`;

      bodyMaxHeightRef.current = writeHeight;
      setBodyMaxHeight((prev) => (prev === writeHeight ? prev : writeHeight));
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(card);
    ro.observe(row);

    const imgEl = card.querySelector("img.doc-image-split__img");
    const onImgLoad = () => sync();
    if (imgEl) {
      imgEl.addEventListener("load", onImgLoad);
    }

    return () => {
      ro.disconnect();
      imgEl?.removeEventListener("load", onImgLoad);
      card.style.height = "";
      card.style.minHeight = "";
      card.style.maxHeight = "";
    };
  }, [imageSaved, splitSaved, isTodoBody, block?.src, block?.width, block?.height]);

  useEffect(() => {
    if (!showSlashGhost) {
      setHintIndex(0);
      return undefined;
    }
    const interval = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % ghostHints.length);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [showSlashGhost, ghostHints]);

  const syncGhostPosition = useCallback(() => {
    if (!showSlashGhost) {
      setGhostPos(null);
      return;
    }
    const el = bodyTextareaRef.current;
    const wrap = bodyWrapRef.current;
    if (!el || !wrap) return;
    setGhostPos(resolveSlashGhostOverlayPosition(el, wrap));
  }, [showSlashGhost]);

  useLayoutEffect(() => {
    syncGhostPosition();
  }, [bodyValue, showSlashGhost, hintIndex, syncGhostPosition]);

  useEffect(() => {
    if (!focusTodoItemId || !isTodoBody) return;
    todoInputRefs.current[focusTodoItemId]?.focus();
  }, [focusTodoItemId, isTodoBody, todoItems.length]);

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

  const handleRemoveBlock = () => {
    if (onDelete) {
      onDelete();
      return;
    }
    handleClearImage();
  };

  const handleFieldChange = (patch) => {
    if (!isEdit) return;
    onChange?.({ ...patch, splitSaved: false });
  };

  const handleTodoPatch = (patch, { keepSaved = false } = {}) => {
    if (keepSaved) {
      onChange?.(patch);
      return;
    }
    if (!isEdit) return;
    onChange?.({ ...patch, splitSaved: false });
  };

  const updateTodoItem = (index, itemPatch, opts) => {
    const next = todoItems.map((item, i) => (i === index ? { ...item, ...itemPatch } : item));
    handleTodoPatch({ todoItems: next }, opts);
  };

  const addTodoItem = (afterIndex = todoItems.length - 1) => {
    if (!isEdit) return null;
    const newItem = createTodoItem();
    const next = [
      ...todoItems.slice(0, afterIndex + 1),
      newItem,
      ...todoItems.slice(afterIndex + 1),
    ];
    handleTodoPatch({ todoItems: next });
    return newItem.id;
  };

  const clearTodoBodyToText = () => {
    handleTodoPatch({
      bodyMode: IMAGE_SPLIT_BODY_MODE.TEXT,
      body: "",
      todoItems: [],
      todoListTitle: block?.todoListTitle,
    });
  };

  const handleTodoItemKeyDown = (index, event) => {
    if (!isEdit) return;
    const item = todoItems[index];
    if (!item) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const newId = addTodoItem(index);
      requestAnimationFrame(() => {
        if (newId) todoInputRefs.current[newId]?.focus();
      });
      return;
    }

    const atStart = event.target?.selectionStart === 0 && event.target?.selectionEnd === 0;
    if ((event.key === "Backspace" || event.key === "Delete") && !item.text && atStart) {
      event.preventDefault();
      if (todoItems.length > 1) {
        const next = todoItems.filter((_, i) => i !== index);
        handleTodoPatch({ todoItems: next });
        const focusTarget = next[Math.min(index, next.length - 1)];
        requestAnimationFrame(() => {
          if (focusTarget) todoInputRefs.current[focusTarget.id]?.focus();
        });
      } else {
        clearTodoBodyToText();
      }
    }
  };

  const resolveBodyMaxHeight = () => bodyMaxHeightRef.current || bodyMaxHeight;

  const maybePulseOverflow = (text) => {
    const el = bodyTextareaRef.current;
    const maxH = resolveBodyMaxHeight();
    if (el && maxH && !bodyTextFitsHeight(el, text, maxH)) {
      pulseBodyLimit();
    }
  };

  const handleBodyChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "");
    const prev = block?.body || "";
    if (next === prev) return;
    if (next.length >= prev.length) maybePulseOverflow(next);
    handleFieldChange({ body: next });
  };

  const handleBodyKeyDown = (event) => {
    if (!isEdit) return;

    const el = bodyTextareaRef.current;
    const cur = block?.body || "";

    if (event.key === "Enter" && !event.shiftKey) {
      onBodyKeyDown?.(event);
      if (event.defaultPrevented) return;
      const start = el?.selectionStart ?? cur.length;
      const end = el?.selectionEnd ?? start;
      const next = `${cur.slice(0, start)}\n${cur.slice(end)}`;
      maybePulseOverflow(next);
      return;
    }

    onBodyKeyDown?.(event);
    if (event.defaultPrevented) return;

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable || !el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = `${cur.slice(0, start)}${event.key}${cur.slice(end)}`;
    if (next.length > cur.length) maybePulseOverflow(next);
  };

  const handleBodyPaste = (event) => {
    if (!isEdit) return;
    const el = bodyTextareaRef.current;
    if (!el) return;

    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const cur = block?.body || "";
    const next = `${cur.slice(0, start)}${paste}${cur.slice(end)}`;
    maybePulseOverflow(next);
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
                  {onDelete ? (
                    <button
                      type="button"
                      className="doc-image-split__media-btn"
                      onClick={handleRemoveBlock}
                      disabled={uploading}
                    >
                      {t("doc.imageBlock.remove")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="doc-image-split__media doc-image-split__media--empty">
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
              {isEdit && onDelete ? (
                <div className="doc-image-split__media-actions">
                  <button
                    type="button"
                    className="doc-image-split__media-btn"
                    onClick={handleRemoveBlock}
                    disabled={uploading}
                  >
                    {t("doc.imageBlock.remove")}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div className="doc-image-split__float-actions">
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
            {onConvertLayout ? (
              <button
                type="button"
                className="doc-image-split__switch"
                onClick={() => onConvertLayout("moodboard")}
              >
                {t("doc.layoutSwitch.moodboard")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="doc-image-split__side">
          <div
            className="doc-image-split__body"
            ref={bodyWrapRef}
            style={bodyMaxHeight ? {
              height: `${bodyMaxHeight}px`,
              maxHeight: `${bodyMaxHeight}px`,
            } : undefined}
          >
            {isTodoBody ? (
              <div
                className={
                  "doc-image-split__embedded-todo"
                  + (isEdit ? "" : " doc-image-split__embedded-todo--saved")
                }
              >
                <div className="doc-image-split__embedded-todo-header">
                  <input
                    type="text"
                    className="doc-image-split__embedded-todo-title"
                    value={block?.todoListTitle || ""}
                    placeholder={t("doc.imageSplit.todoTitlePlaceholder")}
                    aria-label={t("doc.imageSplit.todoTitlePlaceholder")}
                    readOnly={!isEdit}
                    onChange={(e) => handleTodoPatch({ todoListTitle: e.target.value })}
                  />
                  {isEdit ? (
                    <button
                      type="button"
                      className="doc-image-split__embedded-todo-new"
                      onClick={() => {
                        const newId = addTodoItem(todoItems.length - 1);
                        requestAnimationFrame(() => {
                          if (newId) todoInputRefs.current[newId]?.focus();
                        });
                      }}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                <div className="doc-image-split__embedded-todo-rows">
                  {todoItems.map((item, index) => (
                    <div className="doc-image-split__embedded-todo-row" key={item.id}>
                      <button
                        type="button"
                        className={
                          "doc-image-split__embedded-todo-check"
                          + (item.checked ? " is-checked" : "")
                        }
                        aria-label={item.checked ? "Mark incomplete" : "Mark complete"}
                        onClick={() => updateTodoItem(index, { checked: !item.checked }, {
                          keepSaved: !isEdit,
                        })}
                      >
                        <span aria-hidden />
                      </button>
                      <input
                        ref={(el) => {
                          if (el) todoInputRefs.current[item.id] = el;
                          else delete todoInputRefs.current[item.id];
                        }}
                        type="text"
                        className="doc-image-split__embedded-todo-input"
                        data-image-split-todo-id={item.id}
                        value={item.text}
                        readOnly={!isEdit}
                        placeholder={t("doc.imageSplit.todoItemPlaceholder")}
                        onChange={(e) => updateTodoItem(index, { text: e.target.value })}
                        onKeyDown={(e) => handleTodoItemKeyDown(index, e)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : isEdit ? (
              <>
                <textarea
                  ref={bodyTextareaRef}
                  className={
                    "doc-image-split__body-field"
                    + (bodyAtLimit ? " doc-image-split__body-field--at-limit" : "")
                  }
                  value={bodyValue}
                  placeholder={t("doc.imageSplit.bodyPlaceholder")}
                  aria-label={t("doc.imageSplit.bodyPlaceholder")}
                  spellCheck={false}
                  autoFocus={autoFocusBody}
                  onChange={handleBodyChange}
                  onKeyDown={handleBodyKeyDown}
                  onPaste={handleBodyPaste}
                  onSelect={syncGhostPosition}
                  onClick={syncGhostPosition}
                  onKeyUp={syncGhostPosition}
                  style={bodyMaxHeight ? {
                    height: `${bodyMaxHeight}px`,
                    maxHeight: `${bodyMaxHeight}px`,
                  } : undefined}
                />
                {showSlashGhost && ghostPos ? (
                  <span
                    className="doc-image-split__slash-ghost"
                    aria-hidden
                    style={{
                      left: `${ghostPos.left}px`,
                      top: `${ghostPos.top}px`,
                      lineHeight: `${ghostPos.lineHeight}px`,
                    }}
                  >
                    {ghostHints[hintIndex] ?? ghostHints[0]}
                  </span>
                ) : null}
              </>
            ) : (
              <div
                className="doc-image-split__body-static"
                style={bodyMaxHeight ? { height: bodyMaxHeight, maxHeight: bodyMaxHeight } : undefined}
              >
                {bodyValue}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="doc-image-split__error" role="alert">{error}</p> : null}
    </div>
  );
}
