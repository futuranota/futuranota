import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BANNER_HEADLINE_MAX,
  createTodoItem,
  IMAGE_SPLIT_BODY_MAX_LINES,
  IMAGE_SPLIT_BODY_MODE,
  IMAGE_SPLIT_TITLE_MAX,
} from "../../../lib/docBlocks.js";
import { useI18n } from "../../../i18n/useI18n.js";
import { LibraryImageCardPicker } from "../LibraryImageCardPicker.jsx";
import { imageSplitHasFill, libraryItemToImageSplitPatch } from "../../../lib/libraryImageCardPick.js";
import { writeImageSplitPromptToLibrary } from "../../../lib/libraryImageCardSync.js";
import {
  findMaxFittingPrefixLength,
  resolveLineFitHeight,
  snapSplitToWordBoundary,
  composeBodyAfterSideEdit,
  composeBodyAfterBelowEdit,
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
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  // Unitless multipliers (e.g. "1.45") must be scaled by font-size.
  if (!/[a-z%]/i.test(String(raw).trim())) {
    const fontSize = Number.parseFloat(style?.fontSize) || fallback;
    return parsed * fontSize;
  }
  return parsed;
}

/**
 * @param {HTMLElement|null} el
 */
function measureBodyLineMetrics(el) {
  if (!el) {
    return { lineHeight: 20.3, padY: 0 };
  }
  const style = window.getComputedStyle(el);
  const lineHeight = resolveLineHeightPx(style, 20.3);
  const padY = (Number.parseFloat(style.paddingTop) || 0)
    + (Number.parseFloat(style.paddingBottom) || 0);
  return { lineHeight, padY };
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

  el.value = text.slice(0, i);
  let guard = 0;
  while (el.scrollHeight > el.clientHeight + 0.5 && i > 0 && guard < 500) {
    guard += 1;
    const next = snapSplitToWordBoundary(text, i - 1);
    i = next < i ? next : i - 1;
    el.value = text.slice(0, i);
  }
  // Leave el.value at the fitted side prefix. Restoring the pre-measure value
  // races the next keystroke against belowText and duplicates characters (e.g. "N").

  return {
    side: text.slice(0, i),
    below: text.slice(i),
    split: i,
  };
}

/**
 * Unified image-split: image card + text half.
 * Text half always starts with a headline (overlayTitle); Enter moves to
 * normal body. Body fills remaining card height; overflow continues below.
 */
export function ImageSplitBlockView({
  block,
  onChange,
  onSave,
  onEdit,
  onDelete,
  onBodyKeyDown,
  onBodyFocus,
  autoFocusBody = false,
  focusTodoItemId = null,
  libraryOwnerKind = "document",
  libraryOwnerId = "",
  folderLibraryId = "",
}) {
  const { t } = useI18n();
  const cardRef = useRef(null);
  const rowRef = useRef(null);
  const headlineRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const bodyBelowRef = useRef(null);
  const bodyWrapRef = useRef(null);
  const bodyBelowWrapRef = useRef(null);
  const todoInputRefs = useRef({});
  const bodyLimitTimerRef = useRef(null);
  const libraryPromptSyncTimerRef = useRef(null);
  const libraryPromptRef = useRef("");
  const sideHeightRef = useRef(null);
  const sideFitHeightRef = useRef(null);
  const columnHeightRef = useRef(null);
  const splitIndexRef = useRef(0);
  const pendingCaretRef = useRef(null);
  const bodyFocusZoneRef = useRef("side");
  const sideTextRef = useRef(String(block?.body || ""));
  const belowTextRef = useRef("");

  const [error, setError] = useState("");
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [bodyAtLimit, setBodyAtLimit] = useState(false);
  const [columnHeight, setColumnHeight] = useState(null);
  const [sideHeight, setSideHeight] = useState(null);
  const [sideText, setSideText] = useState(() => String(block?.body || ""));
  const [belowText, setBelowText] = useState("");
  const [belowFocused, setBelowFocused] = useState(false);

  const imageSaved = Boolean(block?.imageSaved && block?.src);
  const libraryPrompt = String(block?.libraryPrompt || "");
  libraryPromptRef.current = libraryPrompt;
  const hasLibraryPrompt = Boolean(libraryPrompt.trim());
  const mediaFace = block?.mediaFace === "prompt" && (hasLibraryPrompt || imageSaved)
    ? "prompt"
    : (imageSaved ? "image" : (hasLibraryPrompt ? "prompt" : "image"));
  const showFaceSwitch = imageSaved;
  const showingImage = mediaFace === "image" && imageSaved;
  const showingPrompt = mediaFace === "prompt" && (hasLibraryPrompt || imageSaved);
  const cardFilled = imageSplitHasFill(block);
  const splitSaved = Boolean(block?.splitSaved && cardFilled);
  const isEdit = !splitSaved;
  const wallColor = String(block?.wallColor || "").trim();
  const wallStyle = wallColor ? { backgroundColor: wallColor } : undefined;
  const pickerFolderId = libraryOwnerKind === "folder"
    ? (libraryOwnerId || folderLibraryId)
    : folderLibraryId;
  const pickerDocumentId = libraryOwnerKind === "document" ? libraryOwnerId : "";
  const libraryHints = {
    ownerKind: block?.libraryOwnerKind || libraryOwnerKind,
    ownerId: block?.libraryOwnerId || (block?.libraryOwnerKind === "folder" ? pickerFolderId : pickerDocumentId),
    folderId: pickerFolderId,
    documentId: pickerDocumentId,
  };
  const bodyMode = block?.bodyMode === IMAGE_SPLIT_BODY_MODE.TODO
    ? IMAGE_SPLIT_BODY_MODE.TODO
    : IMAGE_SPLIT_BODY_MODE.TEXT;
  const isTodoBody = bodyMode === IMAGE_SPLIT_BODY_MODE.TODO;
  const todoItems = Array.isArray(block?.todoItems) && block.todoItems.length > 0
    ? block.todoItems
    : [createTodoItem()];

  const headlineValue = String(block?.overlayTitle ?? "");
  const bodyValue = block?.body || "";
  const showBelow = !isTodoBody && (belowText.length > 0 || belowFocused);

  const pulseBodyLimit = useCallback(() => {
    setBodyAtLimit(true);
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
    bodyLimitTimerRef.current = window.setTimeout(() => setBodyAtLimit(false), 700);
  }, []);

  useEffect(() => () => {
    if (bodyLimitTimerRef.current) window.clearTimeout(bodyLimitTimerRef.current);
    if (libraryPromptSyncTimerRef.current) window.clearTimeout(libraryPromptSyncTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isEdit || !block?.openFilePicker || cardFilled) return;
    setLibraryPickerOpen(true);
    onChange?.({ openFilePicker: false });
  }, [block?.openFilePicker, block?.id, cardFilled, onChange, isEdit]);

  const applySplitResult = useCallback((result) => {
    splitIndexRef.current = result.split;
    sideTextRef.current = result.side;
    belowTextRef.current = result.below;
    // Sync DOM immediately so the next keystroke does not read a stale longer value.
    const sideEl = bodyTextareaRef.current;
    if (sideEl && sideEl.value !== result.side) {
      sideEl.value = result.side;
    }
    const belowEl = bodyBelowRef.current;
    if (belowEl && belowEl.value !== result.below) {
      belowEl.value = result.below;
    }
    setSideText(result.side);
    setBelowText(result.below);
    return result;
  }, []);

  const notifyBodyFocus = useCallback(() => {
    onBodyFocus?.();
  }, [onBodyFocus]);

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

    // Wait until the side column has a real width — a 0/1px probe overfits.
    if (el.clientWidth < 8) {
      const full = String(fullText ?? "");
      return applySplitResult({ side: full, below: "", split: full.length });
    }

    const { lineHeight, padY } = measureBodyLineMetrics(el);
    // Floor to whole lines inside the card-tall box so the last line is never
    // half-clipped; live shrink below is the source of truth for overflow.
    const maxFitH = resolveLineFitHeight(boxH, lineHeight, padY);
    sideFitHeightRef.current = maxFitH;

    let result = splitBodyToFitHeight(el, fullText, maxFitH);

    // Live textarea can disagree with the probe after image resize — shrink until clean.
    if (bodyTextareaRef.current && result.split > 0) {
      const live = bodyTextareaRef.current;
      live.value = result.side;
      if (live.scrollHeight > live.clientHeight + 0.5) {
        result = shrinkSplitUntilNoOverflow(live, String(fullText ?? ""), result.split);
      }
      // Keep live.value at result.side (never restore the pre-measure long value).
      live.value = result.side;
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
      const ratio = (showingImage && iw > 0 && ih > 0)
        ? (ih / iw)
        : IMAGE_SPLIT_EMPTY_ASPECT;
      const naturalCardH = Math.round(innerW * ratio + padTotal);
      const cardHeight = Math.max(
        Math.round(lineHeight + padTotal),
        Math.min(naturalCardH, portraitCap),
      );

      // Side column matches card height; body fit uses remaining space under headline.
      const headlineH = !isTodoBody && headlineRef.current
        ? Math.ceil(headlineRef.current.getBoundingClientRect().height)
        : 0;
      const bodyH = Math.max(Math.round(lineHeight), cardHeight - headlineH);

      row.style.setProperty("--image-split-body-max", `${bodyH}px`);
      card.style.height = `${cardHeight}px`;
      card.style.minHeight = `${cardHeight}px`;
      card.style.maxHeight = `${cardHeight}px`;

      columnHeightRef.current = cardHeight;
      sideHeightRef.current = bodyH;
      sideFitHeightRef.current = resolveLineFitHeight(bodyH, lineHeight, 0);
      setColumnHeight((prev) => (prev === cardHeight ? prev : cardHeight));
      setSideHeight((prev) => (prev === bodyH ? prev : bodyH));
    };

    sync();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(sync);
    });
    ro.observe(card);
    ro.observe(row);
    if (headlineRef.current) ro.observe(headlineRef.current);

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
  }, [showingImage, splitSaved, isTodoBody, headlineValue, block?.src, block?.width, block?.height, mediaFace]);

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
    if (!focusTodoItemId || !isTodoBody) return;
    todoInputRefs.current[focusTodoItemId]?.focus();
  }, [focusTodoItemId, isTodoBody, todoItems.length]);

  useEffect(() => {
    if (!autoFocusBody || !isEdit || isTodoBody) return;
    const el = headlineRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      const len = el.value?.length ?? 0;
      el.setSelectionRange?.(len, len);
    });
  }, [autoFocusBody, isEdit, isTodoBody, block?.id]);

  const handleClearImage = () => {
    if (!isEdit) return;
    onChange?.({
      src: "",
      name: "",
      alt: "",
      width: 0,
      height: 0,
      imageSaved: false,
      libraryItemId: "",
      libraryOwnerKind: "",
      libraryOwnerId: "",
      libraryPrompt: "",
      libraryTag: "",
      wallColor: null,
      mediaFace: "image",
      openFilePicker: false,
      splitSaved: false,
    });
    setError(null);
  };

  const handlePickLibraryItem = (item, ownerKind, ownerId) => {
    if (!isEdit) return;
    const resolvedOwnerId = String(ownerId || "").trim()
      || (ownerKind === "folder" ? pickerFolderId : pickerDocumentId);
    const patch = libraryItemToImageSplitPatch(item, ownerKind, resolvedOwnerId);
    if (!patch) return;
    libraryPromptRef.current = patch.libraryPrompt || "";
    onChange?.(patch);
    setLibraryPickerOpen(false);
    setError(null);
  };

  const writeLinkedLibraryPrompt = (nextBlock) => {
    const target = writeImageSplitPromptToLibrary(nextBlock, libraryHints);
    if (!target) return;
    const sameLink = String(nextBlock?.libraryItemId || "").trim() === target.itemId
      && String(nextBlock?.libraryOwnerId || "").trim() === target.ownerId
      && nextBlock?.libraryOwnerKind === target.ownerKind;
    if (sameLink) return;
    onChange?.({
      libraryItemId: target.itemId,
      libraryOwnerKind: target.ownerKind,
      libraryOwnerId: target.ownerId,
    });
  };

  const latestLibraryBlock = () => ({
    ...block,
    libraryPrompt: libraryPromptRef.current,
  });

  const flushLibraryPrompt = (nextBlock = latestLibraryBlock()) => {
    if (libraryPromptSyncTimerRef.current) {
      window.clearTimeout(libraryPromptSyncTimerRef.current);
      libraryPromptSyncTimerRef.current = null;
    }
    writeLinkedLibraryPrompt(nextBlock);
  };

  const scheduleLibraryPromptSync = (nextPrompt) => {
    libraryPromptRef.current = nextPrompt;
    const nextBlock = { ...block, libraryPrompt: nextPrompt };
    if (libraryPromptSyncTimerRef.current) {
      window.clearTimeout(libraryPromptSyncTimerRef.current);
    }
    libraryPromptSyncTimerRef.current = window.setTimeout(() => {
      libraryPromptSyncTimerRef.current = null;
      writeLinkedLibraryPrompt(nextBlock);
    }, 400);
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

  const handleFaceChange = (face) => {
    onChange?.({ mediaFace: face });
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

  const focusBodyStart = useCallback(() => {
    requestAnimationFrame(() => {
      const el = bodyTextareaRef.current;
      el?.focus();
      el?.setSelectionRange(0, 0);
      bodyFocusZoneRef.current = "side";
    });
  }, []);

  const focusHeadlineEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = headlineRef.current;
      if (!el) return;
      el.focus();
      const len = String(el.value ?? "").length;
      el.setSelectionRange?.(len, len);
    });
  }, []);

  const handleHeadlineChange = (event) => {
    if (!isEdit) return;
    const next = String(event.target.value ?? "").slice(0, IMAGE_SPLIT_TITLE_MAX);
    handleFieldChange({ overlayTitle: next });
  };

  const handleHeadlineKeyDown = (event) => {
    if (!isEdit) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      focusBodyStart();
    }
  };

  const handleSideChange = (event) => {
    if (!isEdit) return;
    const nextSideDom = String(event.target.value ?? "");
    const prevSide = sideTextRef.current;
    const below = belowTextRef.current;
    const nextBody = composeBodyAfterSideEdit(prevSide, nextSideDom, below);
    // Keep side ref aligned to the portion before below in the reconciled body.
    const nextSide = below && nextBody.endsWith(below)
      ? nextBody.slice(0, nextBody.length - below.length)
      : nextSideDom;
    sideTextRef.current = nextSide;
    if (nextBody === bodyValue) {
      // Still force DOM back to the authoritative side half if it drifted.
      if (event.target.value !== nextSide) event.target.value = nextSide;
      return;
    }
    const caret = event.target.selectionStart ?? nextSide.length;
    pendingCaretRef.current = { zone: "side", offset: caret };
    handleFieldChange({ body: nextBody });
  };

  const handleBelowChange = (event) => {
    if (!isEdit) return;
    const nextBelowDom = String(event.target.value ?? "");
    const nextBody = composeBodyAfterBelowEdit(
      sideTextRef.current,
      belowTextRef.current,
      nextBelowDom,
    );
    belowTextRef.current = nextBelowDom;
    if (nextBody === bodyValue) return;
    const caret = event.target.selectionStart ?? nextBelowDom.length;
    pendingCaretRef.current = {
      zone: "below",
      offset: caret,
      prevSplit: splitIndexRef.current,
    };
    handleFieldChange({ body: nextBody });
  };

  const handleSideKeyDown = (event) => {
    if (!isEdit) return;

    const el = bodyTextareaRef.current;
    const atStart = el
      && el.selectionStart === 0
      && el.selectionEnd === 0;

    if (event.key === "Backspace" && atStart) {
      event.preventDefault();
      focusHeadlineEnd();
      return;
    }

    emitBodyKeyDown(event);
    if (event.defaultPrevented) return;

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

    if (event.key === "ArrowUp" && atStart) {
      event.preventDefault();
      focusHeadlineEnd();
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
      const side = sideTextRef.current;
      const below = belowTextRef.current;
      if (side.length <= 0) return;
      const nextSide = side.slice(0, -1);
      const nextBody = nextSide + below;
      sideTextRef.current = nextSide;
      pendingCaretRef.current = {
        zone: below.length > 0 || nextSide.length > 0 ? "below" : "side",
        offset: below.length > 0 || nextSide.length > 0 ? 0 : nextSide.length,
        prevSplit: nextSide.length,
      };
      if (below.length === 0 && nextSide.length === 0) {
        pendingCaretRef.current = { zone: "side", offset: 0 };
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
    const side = sideTextRef.current;
    const nextSideDom = `${side.slice(0, start)}${paste}${side.slice(end)}`;
    const below = belowTextRef.current;
    const nextBody = composeBodyAfterSideEdit(side, nextSideDom, below);
    const nextSide = below && nextBody.endsWith(below)
      ? nextBody.slice(0, nextBody.length - below.length)
      : nextSideDom;
    sideTextRef.current = nextSide;
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
    const below = belowTextRef.current;
    const nextBelow = `${below.slice(0, start)}${paste}${below.slice(end)}`;
    const nextBody = composeBodyAfterBelowEdit(sideTextRef.current, below, nextBelow);
    belowTextRef.current = nextBelow;
    pendingCaretRef.current = {
      zone: "below",
      offset: start + paste.length,
      prevSplit: splitIndexRef.current,
    };
    if (nextBody !== bodyValue) handleFieldChange({ body: nextBody });
  };

  const canSave = cardFilled;
  const columnStyle = columnHeight ? {
    height: `${columnHeight}px`,
    maxHeight: `${columnHeight}px`,
  } : undefined;
  const bodyStyle = sideHeight ? {
    height: `${sideHeight}px`,
    maxHeight: `${sideHeight}px`,
  } : undefined;

  const renderSideHeadline = () => {
    if (isTodoBody) return null;
    if (isEdit) {
      return (
        <input
          ref={headlineRef}
          type="text"
          className="doc-image-split__side-headline"
          value={headlineValue}
          maxLength={IMAGE_SPLIT_TITLE_MAX}
          placeholder={t("doc.imageSplit.headlinePlaceholder")}
          aria-label={t("doc.imageSplit.headlinePlaceholder")}
          spellCheck={false}
          onChange={handleHeadlineChange}
          onKeyDown={handleHeadlineKeyDown}
          onFocus={() => {
            notifyBodyFocus();
          }}
        />
      );
    }
    if (!headlineValue.trim()) return null;
    return (
      <div className="doc-image-split__side-headline doc-image-split__side-headline--static">
        {headlineValue}
      </div>
    );
  };

  const renderMediaBar = ({ showSources = true } = {}) => (
    <div className="doc-image-split__media-actions">
      {isEdit ? (
        <button
          type="button"
          className="doc-image-split__media-btn doc-image-split__media-btn--save"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            flushLibraryPrompt(latestLibraryBlock());
            onSave?.();
          }}
        >
          {t("doc.imageSplit.save")}
        </button>
      ) : (
        <button
          type="button"
          className="doc-image-split__media-btn"
          onClick={() => onEdit?.()}
        >
          {t("doc.imageSplit.edit")}
        </button>
      )}
      <div className="doc-image-split__media-actions-end">
        {isEdit && showSources ? (
          <>
            <button
              type="button"
              className="doc-image-split__media-btn"
              onClick={() => setLibraryPickerOpen(true)}
            >
              {t("doc.imageSplit.pickLibrary")}
            </button>
          </>
        ) : null}
        {isEdit && onDelete ? (
          <button
            type="button"
            className="doc-image-split__media-btn"
            onClick={handleRemoveBlock}
          >
            {t("doc.imageBlock.remove")}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={"doc-image-split" + (splitSaved ? " doc-image-split--saved" : "")}>
      <div className="doc-image-split__row" ref={rowRef}>
        <div className="doc-image-split__card" ref={cardRef}>
          {showingImage ? (
            <div className="doc-image-split__media" style={wallStyle}>
              {showFaceSwitch ? (
                <div
                  className="doc-image-split__face-switch doc-image-split__face-switch--on-image"
                  role="tablist"
                  aria-label={t("doc.library.viewSwitchAria")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className="doc-image-split__face-switch-btn"
                    onClick={() => handleFaceChange("prompt")}
                  >
                    {t("doc.library.viewRef")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected
                    className="doc-image-split__face-switch-btn is-active"
                    onClick={() => handleFaceChange("image")}
                  >
                    {t("doc.library.viewImage")}
                  </button>
                </div>
              ) : null}
              <img
                className="doc-image-split__img"
                src={block.src}
                alt={block.alt || block.name || t("doc.imageBlock.previewAlt")}
                width={block.width || undefined}
                height={block.height || undefined}
                draggable={false}
              />
              {renderMediaBar()}
            </div>
          ) : showingPrompt ? (
            <div className="doc-image-split__media doc-image-split__media--prompt" style={wallStyle}>
              {showFaceSwitch ? (
                <div
                  className="doc-image-split__face-switch doc-image-split__face-switch--ghost"
                  role="tablist"
                  aria-label={t("doc.library.viewSwitchAria")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected
                    className="doc-image-split__face-switch-btn is-active"
                    onClick={() => handleFaceChange("prompt")}
                  >
                    {t("doc.library.viewRef")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className="doc-image-split__face-switch-btn"
                    onClick={() => handleFaceChange("image")}
                  >
                    {t("doc.library.viewImage")}
                  </button>
                </div>
              ) : null}
              {isEdit ? (
                <textarea
                  className="doc-image-split__prompt"
                  value={libraryPrompt}
                  maxLength={BANNER_HEADLINE_MAX}
                  placeholder={t("doc.imageSplit.promptPlaceholder")}
                  aria-label={t("doc.imageSplit.promptPlaceholder")}
                  spellCheck={false}
                  onChange={(event) => {
                    const next = event.target.value.slice(0, BANNER_HEADLINE_MAX);
                    libraryPromptRef.current = next;
                    handleFieldChange({ libraryPrompt: next });
                    scheduleLibraryPromptSync(next);
                  }}
                  onBlur={() => flushLibraryPrompt(latestLibraryBlock())}
                />
              ) : (
                <div className="doc-image-split__prompt doc-image-split__prompt--static">
                  {libraryPrompt}
                </div>
              )}
              {renderMediaBar()}
            </div>
          ) : (
            <div className="doc-image-split__media doc-image-split__media--empty">
              <button
                type="button"
                className="doc-image-split__dropzone"
                disabled={!isEdit}
                onClick={() => isEdit && setLibraryPickerOpen(true)}
              >
                <span className="doc-image-split__dropzone-title">
                  {t("doc.imageSplit.pickLibrary")}
                </span>
                <span className="doc-image-split__dropzone-hint">
                  {t("doc.imageSplit.libraryDropHint")}
                </span>
              </button>
              {renderMediaBar({ showSources: false })}
            </div>
          )}
        </div>

        <div className="doc-image-split__side" style={columnStyle}>
          {renderSideHeadline()}
          <div
            className="doc-image-split__body"
            ref={bodyWrapRef}
            style={isTodoBody ? columnStyle : bodyStyle}
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
                    onFocus={notifyBodyFocus}
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
                        onFocus={notifyBodyFocus}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : isEdit ? (
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
                onChange={handleSideChange}
                onKeyDown={handleSideKeyDown}
                onPaste={handleSidePaste}
                onFocus={() => {
                  bodyFocusZoneRef.current = "side";
                  notifyBodyFocus();
                }}
                style={bodyStyle}
              />
            ) : (
              <div
                className="doc-image-split__body-static doc-image-split__body-static--side"
                style={bodyStyle}
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
                notifyBodyFocus();
              }}
              onBlur={() => {
                setBelowFocused(false);
              }}
            />
          ) : (
            <div className="doc-image-split__body-static doc-image-split__body-static--below">
              {belowText}
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="doc-image-split__error" role="alert">{error}</p> : null}

      {libraryPickerOpen ? (
        <LibraryImageCardPicker
          layout="segmentedStrip"
          folderId={pickerFolderId}
          documentId={pickerDocumentId}
          onPick={handlePickLibraryItem}
          onClose={() => setLibraryPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
