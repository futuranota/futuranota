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
import {
  findMaxFittingPrefixLength,
  resolveLineFitHeight,
  snapSplitToWordBoundary,
} from "../../../lib/imageSplitBodyFit.js";

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
 * @param {HTMLElement} source
 */
function createBodyHeightProbe(source) {
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
    `white-space:pre-wrap`,
    `word-break:${style.wordBreak}`,
    `overflow-wrap:${style.overflowWrap}`,
  ].join(";");
  document.body.appendChild(probe);
  return {
    /**
     * @param {string} text
     * @param {number} maxHeight
     */
    fits(text, maxHeight) {
      if (!(maxHeight > 0)) return false;
      probe.value = text ?? "";
      return probe.scrollHeight <= maxHeight;
    },
    dispose() {
      probe.remove();
    },
  };
}

/**
 * Whether `text` fits in a fixed-height body box matching `source` styles.
 * @param {HTMLElement} source
 * @param {string} text
 * @param {number} maxHeight
 */
function bodyTextFitsHeight(source, text, maxHeight) {
  if (!(maxHeight > 0) || !source) return false;
  const probe = createBodyHeightProbe(source);
  try {
    return probe.fits(text, maxHeight);
  } finally {
    probe.dispose();
  }
}

/**
 * Largest prefix of `text` that fits in the side box; remainder continues below.
 * Snaps to a word boundary when the binary-search cut lands mid-token.
 * @param {HTMLElement} source
 * @param {string} text
 * @param {number} maxHeight
 * @returns {{ side: string, below: string, split: number }}
 */
export function splitBodyToFitHeight(source, text, maxHeight) {
  const full = String(text ?? "");
  if (!full) {
    return { side: "", below: "", split: 0 };
  }
  if (!source || !(maxHeight > 0)) {
    return { side: full, below: "", split: full.length };
  }

  const probe = createBodyHeightProbe(source);
  try {
    // Word-snap only walks backward, so the snapped prefix still fits.
    const raw = findMaxFittingPrefixLength(full, (prefix) => probe.fits(prefix, maxHeight));
    const split = snapSplitToWordBoundary(full, raw);
    return {
      side: full.slice(0, split),
      below: full.slice(split),
      split,
    };
  } finally {
    probe.dispose();
  }
}

/**
 * Shrink side prefix until the live textarea no longer overflows vertically.
 * @param {HTMLTextAreaElement|null} el
 * @param {string} full
 * @param {number} split
 * @returns {{ side: string, below: string, split: number }}
 */
function shrinkSplitUntilNoOverflow(el, full, split) {
  const text = String(full ?? "");
  let i = Math.max(0, Math.min(split, text.length));
  if (!el || i <= 0) {
    return { side: text.slice(0, i), below: text.slice(i), split: i };
  }

  const previous = el.value;
  el.value = text.slice(0, i);
  let guard = 0;
  while (el.scrollHeight > el.clientHeight + 0.5 && i > 0 && guard < 500) {
    guard += 1;
    const next = snapSplitToWordBoundary(text, i - 1);
    i = next < i ? next : i - 1;
    el.value = text.slice(0, i);
  }
  // Restore controlled value; React will set the final side text next.
  el.value = previous;

  return {
    side: text.slice(0, i),
    below: text.slice(i),
    split: i,
  };
}

/**
 * Unified image-split: image card + body (text or embedded todo).
 * Text fills the side up to card height (no scroll); overflow continues
 * full-width below the row. Single `body` string in the model.
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
  const bodyBelowRef = useRef(null);
  const bodyWrapRef = useRef(null);
  const bodyBelowWrapRef = useRef(null);
  const todoInputRefs = useRef({});
  const bodyLimitTimerRef = useRef(null);
  const sideHeightRef = useRef(null);
  const sideFitHeightRef = useRef(null);
  const splitIndexRef = useRef(0);
  const pendingCaretRef = useRef(null);
  const bodyFocusZoneRef = useRef("side");

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [bodyAtLimit, setBodyAtLimit] = useState(false);
  const [sideHeight, setSideHeight] = useState(null);
  const [sideText, setSideText] = useState(() => String(block?.body || ""));
  const [belowText, setBelowText] = useState("");
  const [belowFocused, setBelowFocused] = useState(false);
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
  const showBelow = !isTodoBody && (belowText.length > 0 || belowFocused);

  const { slash: bodySlash } = splitBodyForSlash(bodyValue);
  const slashGhostZone = bodySlash && belowText.endsWith(bodySlash) ? "below" : "side";
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

  const applySplitResult = useCallback((result) => {
    splitIndexRef.current = result.split;
    setSideText(result.side);
    setBelowText(result.below);
    return result;
  }, []);

  const reflowFromBody = useCallback((fullText) => {
    const boxH = sideHeightRef.current;
    const el = bodyTextareaRef.current
      || bodyWrapRef.current?.querySelector(
        ".doc-image-split__body-field--side, .doc-image-split__body-static--side",
      );
    if (!el || !(boxH > 0) || isTodoBody) {
      const full = String(fullText ?? "");
      return applySplitResult({ side: full, below: "", split: full.length });
    }

    const { lineHeight, padY } = measureBodyLineMetrics(el);
    const maxFitH = resolveLineFitHeight(boxH, lineHeight, padY);
    sideFitHeightRef.current = maxFitH;

    let result = splitBodyToFitHeight(el, fullText, maxFitH);

    // Live textarea can disagree with the probe after image resize — shrink until clean.
    if (bodyTextareaRef.current && result.split > 0) {
      const live = bodyTextareaRef.current;
      // Apply candidate so scrollHeight reflects the real box.
      const prev = live.value;
      live.value = result.side;
      if (live.scrollHeight > live.clientHeight + 0.5) {
        result = shrinkSplitUntilNoOverflow(live, String(fullText ?? ""), result.split);
      } else {
        live.value = prev;
      }
    }

    return applySplitResult(result);
  }, [applySplitResult, isTodoBody]);

  const restorePendingCaret = useCallback((result) => {
    let pending = pendingCaretRef.current;
    if (!pending || !isEdit || isTodoBody) {
      pendingCaretRef.current = null;
      return;
    }

    if (pending.zone === "below" && typeof pending.prevSplit === "number") {
      const moved = result.split - pending.prevSplit;
      pending = {
        zone: "below",
        offset: Math.max(0, pending.offset - moved),
      };
    }

    pendingCaretRef.current = null;

    const sideEl = bodyTextareaRef.current;
    const belowEl = bodyBelowRef.current;

    if (pending.zone === "side") {
      if (pending.offset <= result.split) {
        sideEl?.focus();
        sideEl?.setSelectionRange(pending.offset, pending.offset);
        bodyFocusZoneRef.current = "side";
      } else {
        const belowOffset = pending.offset - result.split;
        if (belowEl) {
          belowEl.focus();
          belowEl.setSelectionRange(belowOffset, belowOffset);
          bodyFocusZoneRef.current = "below";
          setBelowFocused(true);
        } else {
          pendingCaretRef.current = { zone: "below", offset: belowOffset };
          setBelowFocused(true);
        }
        pulseBodyLimit();
      }
      return;
    }

    if (pending.zone === "below") {
      if (result.below.length === 0) {
        sideEl?.focus();
        sideEl?.setSelectionRange(result.split, result.split);
        bodyFocusZoneRef.current = "side";
        setBelowFocused(false);
        return;
      }
      const belowOffset = Math.max(0, Math.min(pending.offset, result.below.length));
      if (belowEl) {
        belowEl.focus();
        belowEl.setSelectionRange(belowOffset, belowOffset);
        bodyFocusZoneRef.current = "below";
      } else {
        pendingCaretRef.current = { zone: "below", offset: belowOffset };
        setBelowFocused(true);
      }
    }
  }, [isEdit, isTodoBody, pulseBodyLimit]);

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
      // Soft max so extreme portrait cards do not dominate the doc.
      const portraitCap = Math.max(
        Math.round(lineHeight + padY),
        Math.round(IMAGE_SPLIT_BODY_MAX_LINES * lineHeight + padY),
      );

      const padTotal = IMAGE_SPLIT_CARD_PAD_PX * 2;
      const innerW = Math.max(1, card.clientWidth - padTotal);
      const imgEl = card.querySelector("img.doc-image-split__img");
      const iw = Number(block?.width) || imgEl?.naturalWidth || 0;
      const ih = Number(block?.height) || imgEl?.naturalHeight || 0;
      const ratio = (imageSaved && iw > 0 && ih > 0)
        ? (ih / iw)
        : IMAGE_SPLIT_EMPTY_ASPECT;
      const naturalCardH = Math.round(innerW * ratio + padTotal);
      const cardHeight = Math.max(
        Math.round(lineHeight + padY + padTotal),
        Math.min(naturalCardH, portraitCap),
      );

      // Side text column matches card height (no independent 17-line scroll box).
      row.style.setProperty("--image-split-body-max", `${cardHeight}px`);
      card.style.height = `${cardHeight}px`;
      card.style.minHeight = `${cardHeight}px`;
      card.style.maxHeight = `${cardHeight}px`;

      sideHeightRef.current = cardHeight;
      setSideHeight((prev) => (prev === cardHeight ? prev : cardHeight));
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

  // Reflow side/below whenever body or side height changes.
  useLayoutEffect(() => {
    if (isTodoBody) {
      applySplitResult({ side: bodyValue, below: "", split: bodyValue.length });
      return;
    }
    const result = reflowFromBody(bodyValue);
    restorePendingCaret(result);
  }, [
    bodyValue,
    sideHeight,
    isTodoBody,
    reflowFromBody,
    applySplitResult,
    restorePendingCaret,
  ]);

  // Second pass when below mounts after overflow caret move.
  useLayoutEffect(() => {
    if (!pendingCaretRef.current || pendingCaretRef.current.zone !== "below") return;
    if (!bodyBelowRef.current) return;
    restorePendingCaret({
      side: sideText,
      below: belowText,
      split: splitIndexRef.current,
    });
  }, [belowText, showBelow, restorePendingCaret, sideText]);

  // Auto-grow continuation textarea.
  useLayoutEffect(() => {
    const el = bodyBelowRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  }, [belowText, showBelow, isEdit]);

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
    const el = slashGhostZone === "below" ? bodyBelowRef.current : bodyTextareaRef.current;
    const wrap = slashGhostZone === "below" ? bodyBelowWrapRef.current : bodyWrapRef.current;
    if (!el || !wrap) return;
    setGhostPos(resolveSlashGhostOverlayPosition(el, wrap));
  }, [showSlashGhost, slashGhostZone]);

  useLayoutEffect(() => {
    syncGhostPosition();
  }, [sideText, belowText, showSlashGhost, hintIndex, slashGhostZone, syncGhostPosition]);

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

  const emitBodyKeyDown = (event) => {
    onBodyKeyDown?.(event);
  };

  const handleSideChange = (event) => {
    if (!isEdit) return;
    const nextSide = String(event.target.value ?? "");
    const split = splitIndexRef.current;
    const nextBody = nextSide + bodyValue.slice(split);
    if (nextBody === bodyValue) return;
    const caret = event.target.selectionStart ?? nextSide.length;
    pendingCaretRef.current = { zone: "side", offset: caret };
    handleFieldChange({ body: nextBody });
  };

  const handleBelowChange = (event) => {
    if (!isEdit) return;
    const nextBelow = String(event.target.value ?? "");
    const split = splitIndexRef.current;
    const nextBody = bodyValue.slice(0, split) + nextBelow;
    if (nextBody === bodyValue) return;
    const caret = event.target.selectionStart ?? nextBelow.length;
    // After reflow, chars may move into side — adjust below caret by how much split grew.
    pendingCaretRef.current = {
      zone: "below",
      offset: caret,
      prevSplit: split,
    };
    handleFieldChange({ body: nextBody });
  };

  const handleSideKeyDown = (event) => {
    if (!isEdit) return;

    emitBodyKeyDown(event);
    if (event.defaultPrevented) return;

    const el = bodyTextareaRef.current;
    if (!el) return;

    const atEnd = el.selectionStart === sideText.length && el.selectionEnd === sideText.length;
    if (event.key === "ArrowRight" && atEnd && belowText.length > 0) {
      event.preventDefault();
      setBelowFocused(true);
      requestAnimationFrame(() => {
        const belowEl = bodyBelowRef.current;
        belowEl?.focus();
        belowEl?.setSelectionRange(0, 0);
        bodyFocusZoneRef.current = "below";
      });
      return;
    }

    const maxH = sideFitHeightRef.current || sideHeightRef.current;
    if (!(maxH > 0)) return;

    const isPrintable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
    if (!isPrintable && event.key !== "Enter") return;
    if (event.key === "Enter" && event.shiftKey) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const insert = event.key === "Enter" ? "\n" : event.key;
    const nextSide = `${sideText.slice(0, start)}${insert}${sideText.slice(end)}`;
    if (
      atEnd
      && !bodyTextFitsHeight(el, nextSide, maxH)
    ) {
      pulseBodyLimit();
    }
  };

  const handleBelowKeyDown = (event) => {
    if (!isEdit) return;

    const el = bodyBelowRef.current;
    const atStart = el
      && el.selectionStart === 0
      && el.selectionEnd === 0;

    if (event.key === "Backspace" && atStart) {
      event.preventDefault();
      const split = splitIndexRef.current;
      if (split <= 0) return;
      const nextBody = `${bodyValue.slice(0, split - 1)}${bodyValue.slice(split)}`;
      pendingCaretRef.current = {
        zone: belowText.length > 0 || split > 1 ? "below" : "side",
        offset: belowText.length > 0 || split > 1 ? 0 : Math.max(0, split - 1),
        prevSplit: split,
      };
      if (belowText.length === 0 && split <= 1) {
        pendingCaretRef.current = { zone: "side", offset: Math.max(0, split - 1) };
        setBelowFocused(false);
      }
      handleFieldChange({ body: nextBody });
      return;
    }

    if (event.key === "ArrowLeft" && atStart && sideText.length > 0) {
      event.preventDefault();
      const sideEl = bodyTextareaRef.current;
      sideEl?.focus();
      sideEl?.setSelectionRange(sideText.length, sideText.length);
      bodyFocusZoneRef.current = "side";
      return;
    }

    emitBodyKeyDown(event);
  };

  const handleSidePaste = (event) => {
    if (!isEdit) return;
    const el = bodyTextareaRef.current;
    if (!el) return;

    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const split = splitIndexRef.current;
    const nextSide = `${sideText.slice(0, start)}${paste}${sideText.slice(end)}`;
    const nextBody = nextSide + bodyValue.slice(split);
    pendingCaretRef.current = { zone: "side", offset: start + paste.length };
    if (nextBody !== bodyValue) handleFieldChange({ body: nextBody });
  };

  const handleBelowPaste = (event) => {
    if (!isEdit) return;
    const el = bodyBelowRef.current;
    if (!el) return;

    const paste = event.clipboardData?.getData("text") ?? "";
    if (!paste) return;

    event.preventDefault();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const split = splitIndexRef.current;
    const nextBelow = `${belowText.slice(0, start)}${paste}${belowText.slice(end)}`;
    const nextBody = bodyValue.slice(0, split) + nextBelow;
    pendingCaretRef.current = {
      zone: "below",
      offset: start + paste.length,
      prevSplit: split,
    };
    if (nextBody !== bodyValue) handleFieldChange({ body: nextBody });
  };

  const canSave = imageSaved && !uploading;
  const sideStyle = sideHeight ? {
    height: `${sideHeight}px`,
    maxHeight: `${sideHeight}px`,
  } : undefined;

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
            style={sideStyle}
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
                    "doc-image-split__body-field doc-image-split__body-field--side"
                    + (bodyAtLimit ? " doc-image-split__body-field--at-limit" : "")
                  }
                  value={sideText}
                  placeholder={t("doc.imageSplit.bodyPlaceholder")}
                  aria-label={t("doc.imageSplit.bodyPlaceholder")}
                  spellCheck={false}
                  autoFocus={autoFocusBody}
                  onChange={handleSideChange}
                  onKeyDown={handleSideKeyDown}
                  onPaste={handleSidePaste}
                  onFocus={() => {
                    bodyFocusZoneRef.current = "side";
                  }}
                  onSelect={syncGhostPosition}
                  onClick={syncGhostPosition}
                  onKeyUp={syncGhostPosition}
                  style={sideStyle}
                />
                {showSlashGhost && slashGhostZone === "side" && ghostPos ? (
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
                className="doc-image-split__body-static doc-image-split__body-static--side"
                style={sideStyle}
              >
                {sideText}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isTodoBody && showBelow ? (
        <div
          className="doc-image-split__body-below"
          ref={bodyBelowWrapRef}
        >
          {isEdit ? (
            <>
              <textarea
                ref={bodyBelowRef}
                className="doc-image-split__body-field doc-image-split__body-field--below"
                value={belowText}
                aria-label={t("doc.imageSplit.bodyPlaceholder")}
                spellCheck={false}
                onChange={handleBelowChange}
                onKeyDown={handleBelowKeyDown}
                onPaste={handleBelowPaste}
                onFocus={() => {
                  bodyFocusZoneRef.current = "below";
                  setBelowFocused(true);
                }}
                onBlur={() => {
                  setBelowFocused(false);
                }}
                onSelect={syncGhostPosition}
                onClick={syncGhostPosition}
                onKeyUp={syncGhostPosition}
              />
              {showSlashGhost && slashGhostZone === "below" && ghostPos ? (
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
            <div className="doc-image-split__body-static doc-image-split__body-static--below">
              {belowText}
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="doc-image-split__error" role="alert">{error}</p> : null}
    </div>
  );
}
