import { useCallback, useEffect, useRef, useState } from "react";
import { updateBlockAt } from "../../lib/docBlocks.js";
import { toggleBoldRange } from "../../lib/docTextBoldRanges.js";
import { resolveTextSelectionToolbarPosition } from "../../lib/textareaSelectionRect.js";
import { DocTextSelectionBubble } from "./blocks/DocTextSelectionBubble.jsx";

export const DOC_BODY_SELECTION_ID = "__doc_body__";

export function isRegularDocTextarea(textarea) {
  if (!textarea || textarea.tagName !== "TEXTAREA") return false;
  if (textarea.classList.contains("doc-new-head-title")) return false;
  if (textarea.classList.contains("doc-h1-block__input")) return false;
  if (textarea.closest(".doc-h1-block") && !textarea.closest(".doc-text-block")) return false;

  return (
    textarea.classList.contains("doc-new-body-field")
    || textarea.classList.contains("doc-text-block__field")
    || Boolean(textarea.closest(".doc-text-block"))
  );
}

export function resolveTextBlockIdFromTextarea(textarea) {
  if (!isRegularDocTextarea(textarea)) return null;

  const fromWrap = textarea.closest("[data-doc-text-block-id]")?.getAttribute("data-doc-text-block-id");
  if (fromWrap) return fromWrap;

  const fromCollapsed = textarea.closest("[data-collapsed-write-field]")?.getAttribute("data-collapsed-write-field");
  if (fromCollapsed) return fromCollapsed;

  if (textarea.classList.contains("doc-new-body-field")) return DOC_BODY_SELECTION_ID;

  return textarea.closest("[data-block-id]")?.getAttribute("data-block-id") ?? null;
}

function readTextareaSelection(el) {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) return null;

  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const selected = (el.value ?? "").slice(lo, hi);
  if (!selected.trim()) return null;

  return { start: lo, end: hi };
}

function findTextareaForBlock(blockId) {
  if (blockId === DOC_BODY_SELECTION_ID) {
    return document.querySelector(".doc-new-body-field");
  }
  return document.querySelector(`[data-doc-text-block-id="${blockId}"] textarea`)
    ?? document.querySelector(`[data-block-id="${blockId}"] textarea`)
    ?? document.querySelector(`[data-collapsed-write-field="${blockId}"] textarea`);
}

export function useDocTextSelectionToolbar({
  contentRootRef,
  blocks,
  bodyBoldRanges = [],
  onBlocksChange,
  onBodyBoldRangesChange,
}) {
  const [textSelectionBubble, setTextSelectionBubble] = useState(null);
  const blocksRef = useRef(blocks);
  const bodyBoldRangesRef = useRef(bodyBoldRanges);
  const syncFrameRef = useRef(null);

  blocksRef.current = blocks;
  bodyBoldRangesRef.current = bodyBoldRanges;

  const dismissTextSelectionBubble = useCallback(() => {
    setTextSelectionBubble(null);
  }, []);

  const offerTextSelectionBubble = useCallback((blockId, el) => {
    if (!blockId || !el || el.tagName !== "TEXTAREA") return false;

    const selection = readTextareaSelection(el);
    if (!selection) return false;

    const position = resolveTextSelectionToolbarPosition(el, selection.start, selection.end);
    if (!position) return false;

    setTextSelectionBubble({
      blockId,
      start: selection.start,
      end: selection.end,
      position,
    });
    return true;
  }, []);

  const syncTextareaSelection = useCallback((textarea) => {
    if (syncFrameRef.current) {
      cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }

    syncFrameRef.current = requestAnimationFrame(() => {
      syncFrameRef.current = requestAnimationFrame(() => {
        syncFrameRef.current = null;

        const root = contentRootRef?.current;
        if (!textarea || textarea.tagName !== "TEXTAREA") {
          dismissTextSelectionBubble();
          return;
        }

        if (!root?.contains(textarea)) {
          dismissTextSelectionBubble();
          return;
        }

        if (!isRegularDocTextarea(textarea)) {
          dismissTextSelectionBubble();
          return;
        }

        const blockId = resolveTextBlockIdFromTextarea(textarea);
        if (!blockId) {
          dismissTextSelectionBubble();
          return;
        }

        if (!offerTextSelectionBubble(blockId, textarea)) {
          dismissTextSelectionBubble();
        }
      });
    });
  }, [contentRootRef, dismissTextSelectionBubble, offerTextSelectionBubble]);

  useEffect(() => {
    const root = contentRootRef?.current;
    if (!root) return undefined;

    const onRootPointerUp = (event) => {
      const textarea = event.target?.tagName === "TEXTAREA"
        ? event.target
        : document.activeElement;
      if (textarea?.tagName === "TEXTAREA" && root.contains(textarea)) {
        syncTextareaSelection(textarea);
      }
    };

    root.addEventListener("mouseup", onRootPointerUp);
    root.addEventListener("keyup", onRootPointerUp);
    return () => {
      root.removeEventListener("mouseup", onRootPointerUp);
      root.removeEventListener("keyup", onRootPointerUp);
    };
  }, [contentRootRef, syncTextareaSelection]);

  const handleBoldFromSelection = useCallback(() => {
    if (!textSelectionBubble) return;
    const { blockId, start, end } = textSelectionBubble;
    const el = findTextareaForBlock(blockId);
    if (!el) {
      setTextSelectionBubble(null);
      return;
    }

    if (blockId === DOC_BODY_SELECTION_ID) {
      const nextRanges = toggleBoldRange(
        el.value ?? "",
        bodyBoldRangesRef.current,
        start,
        end,
      );
      onBodyBoldRangesChange?.(nextRanges);
    } else {
      const index = blocksRef.current.findIndex((b) => b.id === blockId);
      if (index >= 0) {
        const block = blocksRef.current[index];
        const nextRanges = toggleBoldRange(
          block.text || "",
          block.boldRanges,
          start,
          end,
        );
        onBlocksChange?.(updateBlockAt(blocksRef.current, index, { boldRanges: nextRanges }));
      }
    }

    setTextSelectionBubble(null);
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(start, end);
    });
  }, [textSelectionBubble, onBlocksChange, onBodyBoldRangesChange]);

  const selectionBubble = textSelectionBubble ? (
    <DocTextSelectionBubble
      position={textSelectionBubble.position}
      onBold={handleBoldFromSelection}
      onDismiss={dismissTextSelectionBubble}
    />
  ) : null;

  return {
    selectionBubble,
    syncTextareaSelection,
  };
}
