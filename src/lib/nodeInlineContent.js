import { createTodoItem, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { DEFAULT_CODE_LANGUAGE, normalizeCodeLanguage } from "./codeBlockLanguages.js";
import { generateId } from "./ids.js";
import { splitBodyForSlash } from "./docSlashTail.js";
import {
  createDefaultNodeTodoContent,
  DEFAULT_NODE_TODO_LIST_TITLE,
  normalizeNodeTodoContent,
} from "./nodeTodoContent.js";

export const NODE_BODY_KIND = "node-body";

export const NODE_BLOCK_TYPES = {
  TEXT: "text",
  H1: "h1",
  TODO: "todo",
  CODE: "code",
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

export function createInlineCodeBlock(language = DEFAULT_CODE_LANGUAGE, code = "") {
  const trimmed = String(code || "");
  return {
    id: generateId("NCD"),
    type: NODE_BLOCK_TYPES.CODE,
    language: normalizeCodeLanguage(language),
    code: trimmed,
    codeSaved: Boolean(trimmed.trim()),
  };
}

function normalizeTodoBlock(block) {
  if (block?.type === NODE_BLOCK_TYPES.TODO || Array.isArray(block?.items)) {
    const items = Array.isArray(block?.items) ? block.items : [];
    return {
      id: block?.id || generateId("NTB"),
      type: NODE_BLOCK_TYPES.TODO,
      listTitle: block?.listTitle || DEFAULT_NODE_TODO_LIST_TITLE,
      items: items.length
        ? items.map((item) => createTodoItem({ ...item }))
        : [createTodoItem()],
    };
  }

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
    if (block?.type === NODE_BLOCK_TYPES.CODE) {
      const code = block.code || "";
      const hasCode = Boolean(code.trim());
      return {
        id: block.id || generateId("NCD"),
        type: NODE_BLOCK_TYPES.CODE,
        language: normalizeCodeLanguage(block.language),
        code,
        codeSaved: Boolean(block?.codeSaved ?? hasCode) && hasCode,
      };
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
    if (block.type === NODE_BLOCK_TYPES.CODE) {
      return Boolean(block.codeSaved && block.code?.trim());
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

function isEmptyTextBlock(block) {
  return block?.type === NODE_BLOCK_TYPES.TEXT && !(block.text || "").trim();
}

/** Keep an empty text block at the end so the user can keep writing. */
export function ensureNodeWritingTail(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  const last = normalized[normalized.length - 1];
  if (isEmptyTextBlock(last)) return normalized;
  return [...normalized, createEmptyTextBlock()];
}

export function appendNodeWritingBlock(blocks, newBlock) {
  const normalized = normalizeWritingBlocks(blocks);
  const last = normalized[normalized.length - 1];

  if (isEmptyTextBlock(last)) {
    if (normalized.length === 1) {
      return ensureNodeWritingTail([newBlock]);
    }
    return ensureNodeWritingTail([
      ...normalized.slice(0, -1),
      newBlock,
      last,
    ]);
  }

  return ensureNodeWritingTail([...normalized, newBlock]);
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
  if (parsed.type === DOC_BLOCK_TYPES.CODE) {
    return createInlineCodeBlock();
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
  return ensureNodeWritingTail(insertBlockAfterIndex(updated, blockIndex, newBlock));
}

export function appendNodeWritingBlockFromSlash(blocks, parsed, textPrefix = "") {
  const newBlock = createNodeWritingBlockFromSlash(parsed, textPrefix);
  if (!newBlock) {
    return { blocks: normalizeWritingBlocks(blocks), insertedIndex: -1 };
  }
  const nextBlocks = appendNodeWritingBlock(blocks, newBlock);
  const insertedIndex = nextBlocks.findIndex((block) => block.id === newBlock.id);
  return { blocks: nextBlocks, insertedIndex };
}

export function removeWritingBlockAt(blocks, blockIndex) {
  const normalized = normalizeWritingBlocks(blocks);
  if (blockIndex < 0 || blockIndex >= normalized.length) return normalized;

  const filtered = normalized.filter((_, index) => index !== blockIndex);
  if (!filtered.length) return [createEmptyTextBlock()];

  const hasTextBlock = filtered.some((block) => block.type === NODE_BLOCK_TYPES.TEXT);
  if (!hasTextBlock) {
    filtered.push(createEmptyTextBlock());
  }

  return ensureNodeWritingTail(filtered);
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
