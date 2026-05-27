import {
  createDocBlock,
  createTodoItem,
  DOC_BLOCK_TYPES,
  insertBlockAfter,
  normalizeDocBlocks,
  updateBlockAt,
} from "./docBlocks.js";
import { nodeDataTypeForBlock } from "./docBlockSlash.js";
import { NODE_DATA_TYPES } from "./nodeDataTypes.js";

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

export function findBlockIndex(blocks, blockId, blockType = null) {
  const normalized = normalizeDocBlocks(blocks);
  return normalized.findIndex(
    (b) => b.id === blockId && (blockType == null || b.type === blockType),
  );
}

export function findH1BlockIndex(blocks, blockId) {
  return findBlockIndex(blocks, blockId, DOC_BLOCK_TYPES.H1);
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

function todoItemsToCheckboxContent(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return false;
  return list.some((item) => item.checked);
}

function normalizeDateContent(content) {
  if (content && typeof content === "object") {
    return { date: content.date || "", time: content.time || "" };
  }
  if (typeof content === "string") {
    return { date: content, time: "" };
  }
  return { date: "", time: "" };
}

function normalizeMetricContent(content) {
  if (content && typeof content === "object") {
    return {
      value: content.value != null && content.value !== "" ? String(content.value) : "",
      unit: content.unit || "",
    };
  }
  if (content != null && content !== "") {
    return { value: String(content), unit: "" };
  }
  return { value: "", unit: "" };
}

/** Node content shape from a doc block (for modal draft / save). */
export function getContentForNodeBlock(block) {
  if (!block) return "";

  if (block.type === DOC_BLOCK_TYPES.H1) {
    return "";
  }

  if (block.type === DOC_BLOCK_TYPES.TODO) {
    return todoItemsToCheckboxContent(block.items);
  }

  if (block.type === DOC_BLOCK_TYPES.DATE) {
    return { date: block.date || "", time: block.time || "" };
  }

  if (block.type === DOC_BLOCK_TYPES.METRIC) {
    return {
      value: block.value != null && block.value !== "" ? block.value : "",
      unit: block.unit || "",
    };
  }

  return "";
}

/** Apply node content back onto a doc block. */
export function setContentForNodeBlock(blocks, blockIndex, content, dataType) {
  const normalized = normalizeDocBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block) return normalized;

  if (block.type === DOC_BLOCK_TYPES.H1 && dataType === NODE_DATA_TYPES.TEXT) {
    return setAnswerBelowH1(blocks, blockIndex, typeof content === "string" ? content : "");
  }

  if (block.type === DOC_BLOCK_TYPES.TODO && dataType === NODE_DATA_TYPES.CHECKBOX) {
    const checked = Boolean(content);
    const items = (block.items || []).map((item, i) =>
      i === 0 ? { ...item, checked } : item,
    );
    if (items.length === 0) {
      return updateBlockAt(blocks, blockIndex, {
        items: [createTodoItem({ checked })],
      });
    }
    return updateBlockAt(blocks, blockIndex, { items });
  }

  if (block.type === DOC_BLOCK_TYPES.DATE && dataType === NODE_DATA_TYPES.DATE) {
    const { date, time } = normalizeDateContent(content);
    return updateBlockAt(blocks, blockIndex, { date, time });
  }

  if (block.type === DOC_BLOCK_TYPES.METRIC && dataType === NODE_DATA_TYPES.METRIC) {
    const { value, unit } = normalizeMetricContent(content);
    return updateBlockAt(blocks, blockIndex, { value, unit });
  }

  return blocks;
}

/** Opening the node from the doc: prefer block content when present, else node store. */
export function resolveNodeDraftFromDoc(blockContent, node, dataType) {
  if (blockContent != null && blockContent !== "") {
    if (dataType === NODE_DATA_TYPES.DATE && typeof blockContent === "object") {
      return normalizeDateContent(blockContent);
    }
    if (dataType === NODE_DATA_TYPES.METRIC && typeof blockContent === "object") {
      return normalizeMetricContent(blockContent);
    }
    if (typeof blockContent === "string" && blockContent.trim() !== "") {
      return blockContent;
    }
    if (dataType === NODE_DATA_TYPES.CHECKBOX && typeof blockContent === "boolean") {
      return blockContent;
    }
  }

  if (!node) {
    if (dataType === NODE_DATA_TYPES.DATE) return { date: "", time: "" };
    if (dataType === NODE_DATA_TYPES.METRIC) return { value: "", unit: "" };
    if (dataType === NODE_DATA_TYPES.CHECKBOX) return false;
    return "";
  }

  if (dataType === NODE_DATA_TYPES.DATE) {
    return normalizeDateContent(node.content);
  }
  if (dataType === NODE_DATA_TYPES.METRIC) {
    return normalizeMetricContent(node.content);
  }
  if (dataType === NODE_DATA_TYPES.CHECKBOX) {
    if (typeof node.content === "boolean") return node.content;
    return false;
  }

  return nodeContentAsString(node);
}

export function getBlockQueryText(block) {
  if (!block) return "";
  if (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.DATE || block.type === DOC_BLOCK_TYPES.METRIC) {
    return (block.title || block.sourceQuery || "").trim();
  }
  if (block.type === DOC_BLOCK_TYPES.TODO) {
    return (block.listTitle || block.sourceQuery || "").trim();
  }
  return "";
}

export function blockDataType(block) {
  return nodeDataTypeForBlock(block);
}
