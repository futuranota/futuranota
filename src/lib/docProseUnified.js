import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  h1HasVideoEmbedSibling,
  normalizeDocBlocks,
} from "./docBlocks.js";
import {
  isDocBlockLinkedToNode,
  isLinkedOwnerContinuationSlot,
  isTextHiddenByLinkedMacroNode,
} from "./docNodeSync.js";

/**
 * @typedef {{ kind: "prose", start: number, end: number, blockIds: string[] }} ProseRenderSegment
 * @typedef {{ kind: "block", index: number }} BlockRenderSegment
 * @typedef {ProseRenderSegment | BlockRenderSegment} DocRenderSegment
 */

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {number} index
 */
export function isProseUnifiedEligibleBlock(blocks, index) {
  const block = blocks[index];
  if (!block) return false;

  if (block.type === DOC_BLOCK_TYPES.H1) {
    if (isDocBlockLinkedToNode(block)) return false;
    if (block.nodeId || block.queryEnabled) return false;
    if (h1HasVideoEmbedSibling(blocks, index)) return false;
    return true;
  }

  if (block.type === DOC_BLOCK_TYPES.TEXT) {
    if (block.embedded) return false;
    if (isLinkedOwnerContinuationSlot(blocks, index)) return false;
    if (isTextHiddenByLinkedMacroNode(blocks, index)) return false;
    return true;
  }

  return false;
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {DocRenderSegment[]}
 */
export function partitionBlocksForUnifiedProse(blocks) {
  const normalized = normalizeDocBlocks(blocks);
  /** @type {DocRenderSegment[]} */
  const segments = [];
  let index = 0;

  while (index < normalized.length) {
    const block = normalized[index];

    if (
      block.type === DOC_BLOCK_TYPES.TEXT
      && (isTextHiddenByLinkedMacroNode(normalized, index)
        || isLinkedOwnerContinuationSlot(normalized, index))
    ) {
      index += 1;
      continue;
    }

    if (isProseUnifiedEligibleBlock(normalized, index)) {
      const start = index;
      while (index < normalized.length && isProseUnifiedEligibleBlock(normalized, index)) {
        index += 1;
      }
      segments.push({
        kind: "prose",
        start,
        end: index - 1,
        blockIds: normalized.slice(start, index).map((entry) => entry.id),
      });
      continue;
    }

    segments.push({ kind: "block", index });
    index += 1;
  }

  return segments;
}

/**
 * Contiguous H1 + TEXT run for select-all / copy (render stays per-block).
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {number} blockIndex
 * @returns {{ start: number, end: number } | null}
 */
export function findProseUnitForBlockIndex(blocks, blockIndex) {
  const normalized = normalizeDocBlocks(blocks);
  if (blockIndex < 0 || blockIndex >= normalized.length) return null;

  if (!isProseUnifiedEligibleBlock(normalized, blockIndex)) {
    return { start: blockIndex, end: blockIndex };
  }

  let start = blockIndex;
  let end = blockIndex;

  while (start > 0 && isProseUnifiedEligibleBlock(normalized, start - 1)) {
    start -= 1;
  }

  while (end + 1 < normalized.length && isProseUnifiedEligibleBlock(normalized, end + 1)) {
    end += 1;
  }

  return { start, end };
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
export function proseSegmentToPlainText(blocks, start, end) {
  const parts = [];

  for (let i = start; i <= end; i += 1) {
    const block = blocks[i];
    if (block.type === DOC_BLOCK_TYPES.H1) {
      const title = String(block.title ?? "").trim();
      if (title) parts.push(title);
    } else if (block.type === DOC_BLOCK_TYPES.TEXT) {
      const text = String(block.text ?? "").trim();
      if (text) parts.push(text);
    }
  }

  return parts.join("\n\n");
}

/**
 * Raw join for the unified editor — preserves untrimmed block values.
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
export function proseSegmentToEditableText(blocks, start, end) {
  const slice = blocks.slice(start, end + 1);
  const h1 = slice.find((block) => block.type === DOC_BLOCK_TYPES.H1);
  const texts = slice.filter((block) => block.type === DOC_BLOCK_TYPES.TEXT);

  if (h1) {
    const title = String(h1.title ?? "");
    const body = texts.map((block) => String(block.text ?? "")).join("\n\n");
    if (!body) return title;
    return `${title}\n\n${body}`;
  }

  return texts.map((block) => String(block.text ?? "")).join("\n\n");
}

/**
 * @param {string} text
 * @param {import("./docBlocks.js").DocBlock[]} existingSlice
 * @returns {import("./docBlocks.js").DocBlock[]}
 */
export function plainTextToProseBlocks(text, existingSlice) {
  const existing = normalizeDocBlocks(existingSlice || []);
  const hadH1 = existing.some((block) => block.type === DOC_BLOCK_TYPES.H1);
  const existingH1 = existing.find((block) => block.type === DOC_BLOCK_TYPES.H1);
  const existingTexts = existing.filter((block) => block.type === DOC_BLOCK_TYPES.TEXT);

  let parts = String(text ?? "").split(/\n\n+/).map((part) => part.trim());
  while (parts.length > 1 && !parts[parts.length - 1]) {
    parts.pop();
  }

  if (!parts.some(Boolean)) {
    if (hadH1 && existingH1) {
      const tail = existingTexts[0] || createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
      return [
        { ...existingH1, title: "" },
        { ...tail, text: "" },
      ];
    }
    if (existingTexts[0]) {
      return [{ ...existingTexts[0], text: "" }];
    }
    return [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
  }

  parts = parts.filter(Boolean);

  if (hadH1) {
    const h1Title = parts[0] ?? "";
    const bodyParts = parts.slice(1);
    /** @type {import("./docBlocks.js").DocBlock[]} */
    const next = [{ ...(existingH1 || existing[0]), title: h1Title }];

    bodyParts.forEach((section, i) => {
      if (existingTexts[i]) {
        next.push({ ...existingTexts[i], text: section });
      } else {
        next.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: section }));
      }
    });

    return next;
  }

  return parts.map((section, i) => {
    if (existing[i]?.type === DOC_BLOCK_TYPES.TEXT) {
      return { ...existing[i], text: section };
    }
    return createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: section });
  });
}

/**
 * Replace a prose segment inside a full block list.
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {ProseRenderSegment} segment
 * @param {string} text
 */
export function replaceProseSegmentInBlocks(blocks, segment, text) {
  const slice = blocks.slice(segment.start, segment.end + 1);
  const nextProse = plainTextToProseBlocks(text, slice);
  return [
    ...blocks.slice(0, segment.start),
    ...nextProse,
    ...blocks.slice(segment.end + 1),
  ];
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {string[]} blockIds
 * @returns {{ start: number, end: number } | null}
 */
export function findProseSegmentBounds(blocks, blockIds) {
  const indices = blockIds
    .map((id) => blocks.findIndex((block) => block.id === id))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (!indices.length) return null;
  return { start: indices[0], end: indices[indices.length - 1] };
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {string[]} blockIds
 * @param {string} text
 */
export function replaceProseSegmentByBlockIds(blocks, blockIds, text) {
  const bounds = findProseSegmentBounds(blocks, blockIds);
  if (!bounds) return blocks;
  return replaceProseSegmentInBlocks(blocks, {
    kind: "prose",
    start: bounds.start,
    end: bounds.end,
    blockIds,
  }, text);
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {boolean}
 */
export function shouldUseUnifiedProseEditor(blocks) {
  const segments = partitionBlocksForUnifiedProse(blocks);
  return segments.some((segment) => segment.kind === "prose");
}
