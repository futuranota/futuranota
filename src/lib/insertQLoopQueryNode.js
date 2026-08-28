import {
  createEmptyTextBlock,
  insertBlockAfterIndex,
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";
import { buildQLoopH1Block } from "./insertQLoopQuery.js";
import { createInlineH1Block } from "./nodeInlineContent.js";

function inlineH1FromQLoop(title, qloopSource) {
  const docShape = buildQLoopH1Block(title, qloopSource);
  return createInlineH1Block(docShape.title, {
    qloopSource: docShape.qloopSource,
  });
}

/**
 * @param {object[]} blocks
 * @param {{
 *   blockIndex: number,
 *   caretOffset?: number|null,
 *   title: string,
 *   qloopSource: object,
 * }} options
 */
export function insertQLoopQueryIntoNodeBlocks(blocks, {
  blockIndex,
  caretOffset = null,
  title,
  qloopSource,
}) {
  const normalized = normalizeWritingBlocks(blocks);
  const safeIndex = Math.max(0, Math.min(blockIndex, normalized.length - 1));
  const block = normalized[safeIndex];
  const h1 = inlineH1FromQLoop(title, qloopSource);
  const tailText = createEmptyTextBlock("");

  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) {
    const withH1 = insertBlockAfterIndex(normalized, safeIndex, h1);
    const h1Index = withH1.findIndex((entry) => entry.id === h1.id);
    const withTail = insertBlockAfterIndex(withH1, h1Index, tailText);
    return {
      blocks: withTail,
      focusBlockId: tailText.id,
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
    next[safeIndex] = { ...block, text: before };
    next.splice(safeIndex + 1, 0, h1);
    h1Index = safeIndex + 1;
  }

  const afterBlock = createEmptyTextBlock(after);
  next.splice(h1Index + 1, 0, afterBlock);

  if (!String(afterBlock.text ?? "").trim()) {
    return {
      blocks: next,
      focusBlockId: afterBlock.id,
      h1BlockId: h1.id,
    };
  }

  const emptyTail = createEmptyTextBlock("");
  const tailIndex = next.findIndex((entry) => entry.id === afterBlock.id);
  next.splice(tailIndex + 1, 0, emptyTail);
  return {
    blocks: next,
    focusBlockId: emptyTail.id,
    h1BlockId: h1.id,
  };
}
