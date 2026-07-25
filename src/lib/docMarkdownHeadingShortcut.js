import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  ensureEmptyTextBlockAfter,
  normalizeDocBlock,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { normalizeMentions } from "./docMentions.js";
import { normalizeTagRefs, splitTagRefsAt } from "./docTagRefs.js";
import { normalizeBoldRanges, splitBoldRangesAt } from "./docTextBoldRanges.js";
import { normalizeMarkerRanges, splitMarkerRangesAt } from "./docTextMarkerRanges.js";
import {
  createEmptyTextBlock,
  createInlineH1Block,
  ensureNodeWritingTail,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";

const H1_MARKER = "##";

function clampCaret(text, caret) {
  const str = String(text ?? "");
  const raw = Number(caret);
  return Math.max(
    0,
    Math.min(str.length, Number.isFinite(raw) ? Math.floor(raw) : str.length),
  );
}

function lineStartAt(text, caret) {
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  return str.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
}

/**
 * True when the current line from start → caret is exactly `##`
 * (confirm with Space, or already completed via second `#`).
 * @param {string} text
 * @param {number} caret
 */
export function matchH1MarkdownShortcut(text, caret) {
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = lineStartAt(str, pos);
  return str.slice(start, pos) === H1_MARKER;
}

/**
 * Resolve a keydown into a matched `##` caret state to apply.
 * Primary: second `#` when the line so far is `#` (no Space needed — `#` opens tags).
 * Secondary: Space / Spacebar when the line so far is already `##`.
 *
 * Note: do not gate on altKey/ctrlKey for `#` — many layouts type `#` via AltGr.
 *
 * @param {string} text
 * @param {number} caret
 * @param {string} key
 * @param {string} [code]
 * @returns {{ text: string, caret: number }|null}
 */
export function resolveH1MarkdownShortcutFromKey(text, caret, key, code = "") {
  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = lineStartAt(str, pos);
  const lineToCaret = str.slice(start, pos);

  // Completing `##` with the second hash — fires before `#` is inserted.
  if (key === "#" && lineToCaret === "#") {
    return {
      text: `${str.slice(0, pos)}#${str.slice(pos)}`,
      caret: pos + 1,
    };
  }

  // Confirm with Space after `##` is already in the field.
  if ((key === " " || code === "Space") && lineToCaret === H1_MARKER) {
    return { text: str, caret: pos };
  }

  return null;
}

/**
 * Split TEXT around a matched `##` marker at caret.
 * @param {string} text
 * @param {number} caret
 * @returns {{ before: string, after: string, headEnd: number, tailStart: number }|null}
 */
export function splitAroundH1MarkdownMarker(text, caret) {
  if (!matchH1MarkdownShortcut(text, caret)) return null;

  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = lineStartAt(str, pos);

  return {
    before: str.slice(0, start),
    after: str.slice(pos),
    headEnd: start,
    tailStart: pos,
  };
}

function splitTextAnnotations(block, headEnd, tailStart, beforeText, afterText) {
  const { headRanges: headMarkers, tailRanges: tailMarkers } = splitMarkerRangesAt(
    block?.markerRanges,
    headEnd,
    tailStart,
  );
  const { headRanges: headBolds, tailRanges: tailBolds } = splitBoldRangesAt(
    block?.boldRanges,
    headEnd,
    tailStart,
  );
  const { headRanges: headTagRefs, tailRanges: tailTagRefs } = splitTagRefsAt(
    block?.tagRefs,
    headEnd,
    tailStart,
  );
  return {
    beforePatch: {
      mentions: normalizeMentions(beforeText, block?.mentions),
      tagRefs: normalizeTagRefs(beforeText, headTagRefs),
      markerRanges: normalizeMarkerRanges(beforeText, headMarkers),
      boldRanges: normalizeBoldRanges(beforeText, headBolds),
    },
    afterPatch: {
      mentions: normalizeMentions(afterText, block?.mentions),
      tagRefs: normalizeTagRefs(afterText, tailTagRefs),
      markerRanges: normalizeMarkerRanges(afterText, tailMarkers),
      boldRanges: normalizeBoldRanges(afterText, tailBolds),
    },
  };
}

function annotationFields(patch) {
  return {
    ...(patch.mentions.length ? { mentions: patch.mentions } : {}),
    ...(patch.tagRefs.length ? { tagRefs: patch.tagRefs } : {}),
    ...(patch.markerRanges.length ? { markerRanges: patch.markerRanges } : {}),
    ...(patch.boldRanges.length ? { boldRanges: patch.boldRanges } : {}),
  };
}

/**
 * Convert a doc TEXT block at `##` + Space into Heading 1.
 * @returns {{ blocks: object[], h1Id: string }|null}
 */
export function applyH1MarkdownShortcutToDocBlocks(blocks, blockIndex, text, caret) {
  const parts = splitAroundH1MarkdownMarker(text, caret);
  if (!parts) return null;

  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return null;

  const { before, after, headEnd, tailStart } = parts;
  const beforeHasContent = Boolean(before.trim());
  const afterHasContent = Boolean(after.trim());
  const { beforePatch, afterPatch } = splitTextAnnotations(
    block,
    headEnd,
    tailStart,
    before,
    after,
  );

  const h1 = createDocBlock(DOC_BLOCK_TYPES.H1, { title: "" });
  const next = [...normalized];

  if (!beforeHasContent && !afterHasContent) {
    next[blockIndex] = h1;
  } else if (!beforeHasContent) {
    next[blockIndex] = h1;
    next.splice(
      blockIndex + 1,
      0,
      normalizeDocBlock(createDocBlock(DOC_BLOCK_TYPES.TEXT, {
        text: after,
        ...annotationFields(afterPatch),
      })),
    );
  } else {
    next[blockIndex] = normalizeDocBlock({
      ...block,
      text: before,
      mentions: beforePatch.mentions.length ? beforePatch.mentions : undefined,
      tagRefs: beforePatch.tagRefs.length ? beforePatch.tagRefs : undefined,
      markerRanges: beforePatch.markerRanges.length ? beforePatch.markerRanges : undefined,
      boldRanges: beforePatch.boldRanges.length ? beforePatch.boldRanges : undefined,
    });
    next.splice(blockIndex + 1, 0, h1);
    if (afterHasContent) {
      next.splice(
        blockIndex + 2,
        0,
        normalizeDocBlock(createDocBlock(DOC_BLOCK_TYPES.TEXT, {
          text: after,
          ...annotationFields(afterPatch),
        })),
      );
    }
  }

  const withTail = ensureEmptyTextBlockAfter(next, next.findIndex((b) => b.id === h1.id));
  return { blocks: withTail, h1Id: h1.id };
}

/**
 * Convert a node-writing TEXT block at `##` + Space into Heading 1.
 * @returns {{ blocks: object[], h1Id: string }|null}
 */
export function applyH1MarkdownShortcutToNodeBlocks(blocks, blockIndex, text, caret) {
  const parts = splitAroundH1MarkdownMarker(text, caret);
  if (!parts) return null;

  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return null;

  const { before, after, headEnd, tailStart } = parts;
  const beforeHasContent = Boolean(before.trim());
  const afterHasContent = Boolean(after.trim());
  const { beforePatch, afterPatch } = splitTextAnnotations(
    block,
    headEnd,
    tailStart,
    before,
    after,
  );

  const h1 = createInlineH1Block("");
  const next = [...normalized];

  if (!beforeHasContent && !afterHasContent) {
    next[blockIndex] = h1;
  } else if (!beforeHasContent) {
    next[blockIndex] = h1;
    next.splice(blockIndex + 1, 0, createEmptyTextBlock(after, afterPatch));
  } else {
    next[blockIndex] = {
      ...block,
      text: before,
      mentions: beforePatch.mentions.length ? beforePatch.mentions : undefined,
      tagRefs: beforePatch.tagRefs.length ? beforePatch.tagRefs : undefined,
      markerRanges: beforePatch.markerRanges.length ? beforePatch.markerRanges : undefined,
      boldRanges: beforePatch.boldRanges.length ? beforePatch.boldRanges : undefined,
    };
    next.splice(blockIndex + 1, 0, h1);
    if (afterHasContent) {
      next.splice(blockIndex + 2, 0, createEmptyTextBlock(after, afterPatch));
    }
  }

  return { blocks: ensureNodeWritingTail(next), h1Id: h1.id };
}
