import { useCallback, useEffect, useRef, useState } from "react";
import { toggleBoldRange } from "../../lib/docTextBoldRanges.js";
import {
  applyHeadingToTextBlock,
  demoteHeadingBlockToText,
  isHeadingBlockType,
  materializeNodeBlocksFromPieces,
} from "../../lib/textSelectionHeading.js";
import {
  ensureNodeWritingTail,
  normalizeWritingBlocks,
} from "../../lib/nodeInlineContent.js";
import {
  readTextareaSelection,
  resolveTextSelectionToolbarPosition,
} from "../../lib/textareaSelectionRect.js";
import { DocTextSelectionBubble } from "../docs/blocks/DocTextSelectionBubble.jsx";

const NODE_WRITING_BLOCK_SELECTOR = [
  ".node-writing-block-stack__text",
  ".node-writing-block-stack__h1",
  ".node-writing-block-stack__h2",
  ".node-writing-block-stack__h3",
].join(", ");

export function isNodeWritingTextarea(textarea) {
  if (!textarea || textarea.tagName !== "TEXTAREA") return false;
  return Boolean(textarea.closest(NODE_WRITING_BLOCK_SELECTOR));
}

export function resolveNodeBlockIdFromTextarea(textarea) {
  if (!isNodeWritingTextarea(textarea)) return null;
  return textarea.closest("[data-writing-block-id]")?.getAttribute("data-writing-block-id") ?? null;
}

function findTextareaForBlock(blockId) {
  return document.querySelector(`[data-writing-block-id="${blockId}"] textarea`);
}

function resolveNodeBlockKind(blocks, blockId) {
  const block = blocks.find((entry) => entry.id === blockId);
  if (!block) return "text";
  return isHeadingBlockType(block.type) ? "heading" : "text";
}

export function useNodeTextSelectionToolbar({
  stackRef,
  blocks,
  onBlocksChange,
}) {
  const [textSelectionBubble, setTextSelectionBubble] = useState(null);
  const blocksRef = useRef(blocks);
  const syncFrameRef = useRef(null);

  blocksRef.current = blocks;

  const dismissTextSelectionBubble = useCallback(() => {
    setTextSelectionBubble(null);
  }, []);

  const offerTextSelectionBubble = useCallback((blockId, el) => {
    if (!blockId || !el || el.tagName !== "TEXTAREA") return false;

    const selection = readTextareaSelection(el);
    if (!selection) return false;

    const position = resolveTextSelectionToolbarPosition(
      el,
      selection.start,
      selection.start,
    );
    if (!position) return false;

    setTextSelectionBubble({
      blockId,
      blockKind: resolveNodeBlockKind(blocksRef.current, blockId),
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

        const root = stackRef?.current;
        if (!textarea || textarea.tagName !== "TEXTAREA") {
          dismissTextSelectionBubble();
          return;
        }

        if (!root?.contains(textarea)) {
          dismissTextSelectionBubble();
          return;
        }

        if (!isNodeWritingTextarea(textarea)) {
          dismissTextSelectionBubble();
          return;
        }

        const blockId = resolveNodeBlockIdFromTextarea(textarea);
        if (!blockId) {
          dismissTextSelectionBubble();
          return;
        }

        if (!offerTextSelectionBubble(blockId, textarea)) {
          dismissTextSelectionBubble();
        }
      });
    });
  }, [dismissTextSelectionBubble, offerTextSelectionBubble, stackRef]);

  useEffect(() => {
    const root = stackRef?.current;
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
  }, [stackRef, syncTextareaSelection]);

  const handleSelectFormat = useCallback((formatId) => {
    if (!textSelectionBubble) return;
    const { blockId } = textSelectionBubble;
    const el = findTextareaForBlock(blockId);
    if (!el) {
      setTextSelectionBubble(null);
      return;
    }

    const index = blocksRef.current.findIndex((block) => block.id === blockId);
    if (index < 0) {
      setTextSelectionBubble(null);
      return;
    }

    const liveSelection = readTextareaSelection(el) ?? {
      start: textSelectionBubble.start,
      end: textSelectionBubble.end,
    };
    const { start, end } = liveSelection;
    const text = el.value ?? "";
    let nextBlocks = blocksRef.current;

    if (formatId === "bold") {
      const block = blocksRef.current[index];
      const nextRanges = toggleBoldRange(text, block.boldRanges, start, end);
      nextBlocks = blocksRef.current.map((entry, entryIndex) => (
        entryIndex === index
          ? { ...entry, text, boldRanges: nextRanges }
          : entry
      ));
    } else if (formatId === "body") {
      nextBlocks = demoteHeadingBlockToText(blocksRef.current, index);
      nextBlocks = ensureNodeWritingTail(normalizeWritingBlocks(nextBlocks));
    } else if (formatId === "h1" || formatId === "h2" || formatId === "h3") {
      const block = { ...blocksRef.current[index], text, boldRanges: blocksRef.current[index].boldRanges };
      const splitBlocks = applyHeadingToTextBlock(
        blocksRef.current.map((entry, entryIndex) => (
          entryIndex === index ? block : entry
        )),
        index,
        { start, end },
        formatId,
        { idPrefix: "NTX" },
      );
      const pieceCount = splitBlocks.length - blocksRef.current.length + 1;
      const pieces = splitBlocks.slice(index, index + pieceCount);
      const materialized = materializeNodeBlocksFromPieces(pieces);
      nextBlocks = [
        ...blocksRef.current.slice(0, index),
        ...materialized,
        ...blocksRef.current.slice(index + 1),
      ];
      nextBlocks = ensureNodeWritingTail(normalizeWritingBlocks(nextBlocks));
    }

    onBlocksChange?.(nextBlocks);
    setTextSelectionBubble(null);

    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      if (formatId === "bold") {
        el.setSelectionRange(start, end);
      }
    });
  }, [onBlocksChange, textSelectionBubble]);

  const selectionBubble = textSelectionBubble ? (
    <DocTextSelectionBubble
      position={textSelectionBubble.position}
      blockKind={textSelectionBubble.blockKind}
      onSelectFormat={handleSelectFormat}
      onDismiss={dismissTextSelectionBubble}
    />
  ) : null;

  return { selectionBubble };
}
