import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  insertBlockAfter,
  normalizeDocBlock,
  normalizeDocBlocks,
  normalizeQLoopSource,
} from "./docBlocks.js";

/**
 * @param {string} title
 * @param {object} qloopSource
 */
export function buildQLoopH1Block(title, qloopSource) {
  const normalizedSource = normalizeQLoopSource(qloopSource);
  return createDocBlock(DOC_BLOCK_TYPES.H1, {
    title: String(title ?? "").trim(),
    queryEnabled: false,
    ...(normalizedSource ? { qloopSource: normalizedSource } : {}),
  });
}

function buildQLoopTailText(description, afterText, block = {}) {
  const desc = String(description ?? "").trim();
  const after = String(afterText ?? "");
  let text = "";
  if (desc && after.trim()) {
    text = `${desc}\n${after}`;
  } else if (desc) {
    text = desc;
  } else {
    text = after;
  }

  return createDocBlock(DOC_BLOCK_TYPES.TEXT, {
    text,
    ...(Array.isArray(block.mentions) && block.mentions.length ? { mentions: block.mentions } : {}),
    ...(Array.isArray(block.tagRefs) && block.tagRefs.length ? { tagRefs: block.tagRefs } : {}),
    ...(Array.isArray(block.libraryNameRefs) && block.libraryNameRefs.length
      ? { libraryNameRefs: block.libraryNameRefs }
      : {}),
    ...(Array.isArray(block.markerRanges) && block.markerRanges.length
      ? { markerRanges: block.markerRanges }
      : {}),
    ...(Array.isArray(block.boldRanges) && block.boldRanges.length
      ? { boldRanges: block.boldRanges }
      : {}),
  });
}

/**
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @param {{
 *   blockIndex: number,
 *   caretOffset?: number|null,
 *   title: string,
 *   description?: string,
 *   qloopSource: object,
 * }} options
 * @returns {{ blocks: import("./docBlocks.js").DocBlock[], focusBlockId: string, h1BlockId: string }}
 */
export function insertQLoopQueryIntoDocBlocks(blocks, {
  blockIndex,
  caretOffset = null,
  title,
  description = "",
  qloopSource,
}) {
  const normalized = normalizeDocBlocks(blocks);
  const safeIndex = Math.max(0, Math.min(blockIndex, normalized.length - 1));
  const block = normalized[safeIndex];
  const h1 = buildQLoopH1Block(title, qloopSource);

  if (!block || block.type !== DOC_BLOCK_TYPES.TEXT) {
    const withH1 = insertBlockAfter(normalized, safeIndex, h1);
    const h1Index = withH1.findIndex((entry) => entry.id === h1.id);
    const tail = buildQLoopTailText(description, "", {});
    const withTail = insertBlockAfter(withH1, h1Index, tail);
    const tailIndex = withTail.findIndex((entry) => entry.id === tail.id);
    if (!String(tail.text ?? "").trim()) {
      return {
        blocks: withTail,
        focusBlockId: tail.id,
        h1BlockId: h1.id,
      };
    }
    const emptyTail = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
    withTail.splice(tailIndex + 1, 0, emptyTail);
    return {
      blocks: withTail,
      focusBlockId: emptyTail.id,
      h1BlockId: h1.id,
    };
  }

  const text = String(block.text ?? "");
  const offset = caretOffset == null
    ? text.length
    : Math.max(0, Math.min(text.length, caretOffset));
  const before = text.slice(0, offset);
  const after = text.slice(offset);

  const next = [...normalized];
  let h1Index;

  if (!before.trim()) {
    next[safeIndex] = h1;
    h1Index = safeIndex;
  } else {
    next[safeIndex] = normalizeDocBlock({ ...block, text: before });
    next.splice(safeIndex + 1, 0, h1);
    h1Index = safeIndex + 1;
  }

  const afterBlock = buildQLoopTailText(description, after, block);
  next.splice(h1Index + 1, 0, afterBlock);
  if (!String(afterBlock.text ?? "").trim()) {
    return {
      blocks: next,
      focusBlockId: afterBlock.id,
      h1BlockId: h1.id,
    };
  }

  const emptyTail = createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" });
  const tailIndex = next.findIndex((entry) => entry.id === afterBlock.id);
  next.splice(tailIndex + 1, 0, emptyTail);
  return {
    blocks: next,
    focusBlockId: emptyTail.id,
    h1BlockId: h1.id,
  };
}

/**
 * @param {string} text
 * @param {{ start: number, end: number }|null|undefined} mentionQuery
 * @returns {{ text: string, caret: number }}
 */
export function stripAtMentionQuery(text, mentionQuery) {
  const value = String(text ?? "");
  if (!mentionQuery) {
    return { text: value, caret: value.length };
  }
  const start = Math.max(0, Math.min(value.length, mentionQuery.start));
  const end = Math.max(start, Math.min(value.length, mentionQuery.end));
  const nextText = `${value.slice(0, start)}${value.slice(end)}`;
  return { text: nextText, caret: start };
}
