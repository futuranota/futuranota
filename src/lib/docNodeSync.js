import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  insertBlockAfter,
  normalizeDocBlocks,
  updateBlockAt,
} from "./docBlocks.js";

export function getTextBlockIndexAfterH1(blocks, h1Index) {
  const normalized = normalizeDocBlocks(blocks);
  const next = normalized[h1Index + 1];
  if (next?.type === DOC_BLOCK_TYPES.TEXT) return h1Index + 1;
  return -1;
}

export function getAnswerBelowH1(blocks, h1Index) {
  const textIndex = getTextBlockIndexAfterH1(blocks, h1Index);
  if (textIndex < 0) return "";
  const normalized = normalizeDocBlocks(blocks);
  return normalized[textIndex]?.text || "";
}

export function setAnswerBelowH1(blocks, h1Index, answerText) {
  const textIndex = getTextBlockIndexAfterH1(blocks, h1Index);
  if (textIndex >= 0) {
    return updateBlockAt(blocks, textIndex, { text: answerText });
  }
  return insertBlockAfter(
    blocks,
    h1Index,
    createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: answerText }),
  );
}

export function findH1BlockIndex(blocks, blockId) {
  const normalized = normalizeDocBlocks(blocks);
  return normalized.findIndex((b) => b.id === blockId && b.type === DOC_BLOCK_TYPES.H1);
}

/** Text block index immediately after an H1, or -1. */
export function getH1IndexForTextBlock(blocks, textBlockIndex) {
  if (textBlockIndex <= 0) return -1;
  const normalized = normalizeDocBlocks(blocks);
  const prev = normalized[textBlockIndex - 1];
  if (prev?.type === DOC_BLOCK_TYPES.H1) return textBlockIndex - 1;
  return -1;
}

export function nodeContentAsString(node) {
  if (!node) return "";
  if (typeof node.content === "string") return node.content;
  return JSON.stringify(node.content ?? "");
}

/** Opening the node from the doc: prefer answer text in the document when present. */
export function resolveNodeDraftFromDoc(answer, node) {
  const answerStr = answer ?? "";
  if (answerStr.trim() !== "") return answerStr;
  return nodeContentAsString(node);
}
