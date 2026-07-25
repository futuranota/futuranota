import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  ensureWritableDocTail,
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
 * (rest of the line becomes the H1 title).
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
 * Find caret after a line-start `##` (for onChange / IME fallback).
 * Prefers the last matching line.
 * @param {string} text
 * @returns {number} caret index, or -1
 */
export function findH1MarkdownShortcutCaret(text) {
  const str = String(text ?? "");
  let found = -1;
  let idx = 0;
  while (idx <= str.length) {
    if (str.startsWith(H1_MARKER, idx)) {
      const caret = idx + H1_MARKER.length;
      if (matchH1MarkdownShortcut(str, caret)) found = caret;
    }
    const next = str.indexOf("\n", idx);
    if (next === -1) break;
    idx = next + 1;
  }
  return found;
}

/**
 * Resolve a keydown into a matched `##` caret state to apply.
 * Primary: second `#` when the line so far is `#` (works with text after caret).
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
  // Works at start of a line that already has text: `#Hello` + `#` → `##Hello`.
  if (key === "#" && lineToCaret === "#") {
    return {
      text: `${str.slice(0, pos)}#${str.slice(pos)}`,
      caret: pos + 1,
    };
  }

  // Confirm with Space after `##` (title may follow on the same line).
  if ((key === " " || code === "Space") && lineToCaret === H1_MARKER) {
    return { text: str, caret: pos };
  }

  return null;
}

/**
 * Split TEXT around a matched `##` marker at caret.
 * Rest of the current line → H1 title; later lines → body TEXT after.
 *
 * @param {string} text
 * @param {number} caret
 * @returns {{
 *   before: string,
 *   title: string,
 *   after: string,
 *   headEnd: number,
 *   tailStart: number,
 * }|null}
 */
export function splitAroundH1MarkdownMarker(text, caret) {
  if (!matchH1MarkdownShortcut(text, caret)) return null;

  const str = String(text ?? "");
  const pos = clampCaret(str, caret);
  const start = lineStartAt(str, pos);
  const nextBreak = str.indexOf("\n", pos);
  const lineEnd = nextBreak === -1 ? str.length : nextBreak;

  let title = str.slice(pos, lineEnd);
  // Drop one leading space (Space confirm / `## Title` habit).
  if (title.startsWith(" ")) title = title.slice(1);

  const before = str.slice(0, start);
  const after = nextBreak === -1 ? "" : str.slice(nextBreak + 1);
  const tailStart = nextBreak === -1 ? str.length : nextBreak + 1;

  return {
    before,
    title,
    after,
    headEnd: start,
    tailStart,
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

function applySplitToDocBlocks(normalized, blockIndex, block, parts) {
  const { before, title, after, headEnd, tailStart } = parts;
  const beforeHasContent = Boolean(before.trim());
  const afterHasContent = Boolean(after.trim());
  const { beforePatch, afterPatch } = splitTextAnnotations(
    block,
    headEnd,
    tailStart,
    before,
    after,
  );

  const h1 = createDocBlock(DOC_BLOCK_TYPES.H1, { title: title || "" });
  const next = [...normalized];

  const afterBlock = afterHasContent
    ? normalizeDocBlock(createDocBlock(DOC_BLOCK_TYPES.TEXT, {
      text: after,
      ...annotationFields(afterPatch),
    }))
    : null;

  if (!beforeHasContent) {
    next[blockIndex] = h1;
    if (afterBlock) next.splice(blockIndex + 1, 0, afterBlock);
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
    if (afterBlock) next.splice(blockIndex + 2, 0, afterBlock);
  }

  // Writable tail only at the end of the stack — never insert an empty TEXT
  // between the new H1 and existing content below (that caused the ghost gap).
  return { blocks: ensureWritableDocTail(next), h1Id: h1.id };
}

function applySplitToNodeBlocks(normalized, blockIndex, block, parts) {
  const { before, title, after, headEnd, tailStart } = parts;
  const beforeHasContent = Boolean(before.trim());
  const afterHasContent = Boolean(after.trim());
  const { beforePatch, afterPatch } = splitTextAnnotations(
    block,
    headEnd,
    tailStart,
    before,
    after,
  );

  const h1 = createInlineH1Block(title || "");
  const next = [...normalized];

  const afterBlock = afterHasContent
    ? createEmptyTextBlock(after, afterPatch)
    : null;

  if (!beforeHasContent) {
    next[blockIndex] = h1;
    if (afterBlock) next.splice(blockIndex + 1, 0, afterBlock);
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
    if (afterBlock) next.splice(blockIndex + 2, 0, afterBlock);
  }

  return { blocks: ensureNodeWritingTail(next), h1Id: h1.id };
}

/**
 * Convert a doc TEXT block at `##` into Heading 1 (rest of line → title).
 * @returns {{ blocks: object[], h1Id: string }|null}
 */
export function applyH1MarkdownShortcutToDocBlocks(blocks, blockIndex, text, caret) {
  const parts = splitAroundH1MarkdownMarker(text, caret);
  if (!parts) return null;

  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) return null;

  return applySplitToDocBlocks(normalized, blockIndex, block, parts);
}

/**
 * Convert a node-writing TEXT block at `##` into Heading 1 (rest of line → title).
 * @returns {{ blocks: object[], h1Id: string }|null}
 */
export function applyH1MarkdownShortcutToNodeBlocks(blocks, blockIndex, text, caret) {
  const parts = splitAroundH1MarkdownMarker(text, caret);
  if (!parts) return null;

  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return null;

  return applySplitToNodeBlocks(normalized, blockIndex, block, parts);
}
