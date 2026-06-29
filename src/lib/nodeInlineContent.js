import { DOC_BLOCK_TYPES } from "./docBlocks.js";
import { generateId } from "./ids.js";
import { splitBodyForSlash } from "./docSlashTail.js";
import {
  createDefaultNodeTodoContent,
  normalizeNodeTodoContent,
} from "./nodeTodoContent.js";

export const NODE_BODY_KIND = "node-body";

export const NODE_BLOCK_TYPES = {
  TEXT: "text",
  H1: "h1",
  TODO: "todo",
};

export function isNodeWritingBody(content) {
  return Boolean(
    content
    && typeof content === "object"
    && !Array.isArray(content)
    && content.kind === NODE_BODY_KIND,
  );
}

export function createEmptyTextBlock(text = "") {
  return {
    id: generateId("NTX"),
    type: NODE_BLOCK_TYPES.TEXT,
    text,
  };
}

export function createInlineH1Block(title = "") {
  return {
    id: generateId("NH1"),
    type: NODE_BLOCK_TYPES.H1,
    title,
  };
}

export function createInlineTodoBlock(listTitle) {
  const todo = createDefaultNodeTodoContent(listTitle);
  return {
    id: generateId("NTB"),
    type: NODE_BLOCK_TYPES.TODO,
    listTitle: todo.listTitle,
    items: todo.items,
  };
}

function normalizeTodoBlock(block) {
  const normalized = normalizeNodeTodoContent(block, block?.listTitle);
  return {
    id: block?.id || generateId("NTB"),
    type: NODE_BLOCK_TYPES.TODO,
    listTitle: normalized.listTitle,
    items: normalized.items,
  };
}

export function normalizeWritingBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) {
    return [createEmptyTextBlock()];
  }

  return blocks.map((block) => {
    if (block?.type === NODE_BLOCK_TYPES.H1) {
      return {
        id: block.id || generateId("NH1"),
        type: NODE_BLOCK_TYPES.H1,
        title: block.title || "",
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.TODO || block?.items) {
      return normalizeTodoBlock(block);
    }
    return {
      id: block?.id || generateId("NTX"),
      type: NODE_BLOCK_TYPES.TEXT,
      text: block?.text || "",
    };
  });
}

export function parseNodeWritingBody(content) {
  if (typeof content === "string") {
    return {
      blocks: content.trim()
        ? [createEmptyTextBlock(content)]
        : [createEmptyTextBlock()],
    };
  }

  if (isNodeWritingBody(content)) {
    if (Array.isArray(content.blocks)) {
      return { blocks: normalizeWritingBlocks(content.blocks) };
    }

    const legacyBlocks = [];
    if ((content.text || "").trim()) {
      legacyBlocks.push(createEmptyTextBlock(content.text));
    }
    for (const todo of content.todoBlocks || []) {
      legacyBlocks.push(normalizeTodoBlock({ ...todo, type: NODE_BLOCK_TYPES.TODO }));
    }
    return {
      blocks: legacyBlocks.length
        ? normalizeWritingBlocks(legacyBlocks)
        : [createEmptyTextBlock()],
    };
  }

  return { blocks: [createEmptyTextBlock()] };
}

export function nodeWritingBlocksHaveContent(blocks) {
  return normalizeWritingBlocks(blocks).some((block) => {
    if (block.type === NODE_BLOCK_TYPES.H1) return block.title.trim();
    if (block.type === NODE_BLOCK_TYPES.TODO) {
      return block.listTitle.trim()
        || block.items.some((item) => (item.text || "").trim());
    }
    return block.text.trim();
  });
}

export function serializeNodeWritingBody({ blocks } = {}) {
  const normalized = normalizeWritingBlocks(blocks);
  if (!nodeWritingBlocksHaveContent(normalized)) {
    return "";
  }
  return {
    kind: NODE_BODY_KIND,
    blocks: normalized,
  };
}

export function getNodeWritingPlainText(blocks) {
  return normalizeWritingBlocks(blocks)
    .filter((block) => block.type === NODE_BLOCK_TYPES.TEXT)
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

export function appendNodeWritingBlock(blocks, newBlock) {
  const normalized = normalizeWritingBlocks(blocks);
  const lastTextIndex = normalized.map((block) => block.type).lastIndexOf(NODE_BLOCK_TYPES.TEXT);
  if (lastTextIndex < 0) {
    return [...normalized, newBlock, createEmptyTextBlock()];
  }
  return [
    ...normalized.slice(0, lastTextIndex),
    newBlock,
    ...normalized.slice(lastTextIndex),
  ];
}

export function insertBlockAfterIndex(blocks, blockIndex, newBlock) {
  const normalized = normalizeWritingBlocks(blocks);
  return [
    ...normalized.slice(0, blockIndex + 1),
    newBlock,
    ...normalized.slice(blockIndex + 1),
  ];
}

export function createNodeWritingBlockFromSlash(parsed, textPrefix = "") {
  if (!parsed?.type) return null;
  if (parsed.type === DOC_BLOCK_TYPES.H1) {
    return createInlineH1Block(String(textPrefix || "").trim());
  }
  if (parsed.type === DOC_BLOCK_TYPES.TODO) {
    return createInlineTodoBlock();
  }
  return null;
}

export function applySlashInTextBlock(blocks, blockIndex, parsed) {
  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return normalized;

  const { prefix } = splitBodyForSlash(block.text);
  const newBlock = createNodeWritingBlockFromSlash(
    parsed,
    parsed.type === DOC_BLOCK_TYPES.H1 ? prefix : "",
  );
  if (!newBlock) return normalized;

  const updated = normalized.map((entry, index) => (
    index === blockIndex ? { ...entry, text: prefix } : entry
  ));
  return insertBlockAfterIndex(updated, blockIndex, newBlock);
}

export function appendNodeWritingBlockFromSlash(blocks, parsed, textPrefix = "") {
  const newBlock = createNodeWritingBlockFromSlash(parsed, textPrefix);
  if (!newBlock) return normalizeWritingBlocks(blocks);
  return appendNodeWritingBlock(blocks, newBlock);
}

/** @deprecated use normalizeWritingBlocks todo entries */
export function normalizeInlineTodoBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => normalizeTodoBlock(block));
}

/** @deprecated */
export function inlineTodoBlocksHaveContent(blocks) {
  return nodeWritingBlocksHaveContent(
    (blocks || []).map((block) => ({ ...block, type: NODE_BLOCK_TYPES.TODO })),
  );
}
