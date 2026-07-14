import { createTodoItem, createDocBlock, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { DEFAULT_CODE_LANGUAGE, normalizeCodeLanguage } from "./codeBlockLanguages.js";
import { generateId } from "./ids.js";
import { splitBodyForSlash } from "./docSlashTail.js";
import {
  createDefaultNodeTodoContent,
  DEFAULT_NODE_TODO_LIST_TITLE,
  normalizeNodeTodoContent,
} from "./nodeTodoContent.js";
import { normalizeLinkEntries, normalizePasswordEntries } from "./vaultBlocks.js";

export const NODE_BODY_KIND = "node-body";

export const NODE_BLOCK_TYPES = {
  TEXT: "text",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  TODO: "todo",
  CODE: "code",
  PASSWORD_VAULT: "password_vault",
  LINK_VAULT: "link_vault",
  AGENT: "agent",
  STEP_SEQUENCE: "step_sequence",
  IMAGE: "image",
  IMAGE_SPLIT: "image_split",
  PRODUCT_CARD: "product_card",
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

export function createInlineH1Block(title = "", patch = {}) {
  return {
    id: generateId("NH1"),
    type: NODE_BLOCK_TYPES.H1,
    title,
    macronodeHeading: Boolean(patch.macronodeHeading),
  };
}

export function createInlineH2Block(title = "") {
  return {
    id: generateId("NH2"),
    type: NODE_BLOCK_TYPES.H2,
    title,
  };
}

export function createInlineH3Block(title = "") {
  return {
    id: generateId("NH3"),
    type: NODE_BLOCK_TYPES.H3,
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

export function createInlinePasswordVaultBlock(entries = []) {
  return {
    id: generateId("NPW"),
    type: NODE_BLOCK_TYPES.PASSWORD_VAULT,
    entries: normalizePasswordEntries(entries),
  };
}

export function createInlineLinkVaultBlock(entries = []) {
  return {
    id: generateId("NLK"),
    type: NODE_BLOCK_TYPES.LINK_VAULT,
    entries: normalizeLinkEntries(entries),
  };
}

export function createInlineAgentBlock(instruction = "") {
  return {
    id: generateId("NAG"),
    type: NODE_BLOCK_TYPES.AGENT,
    instruction: String(instruction ?? ""),
  };
}

export function createInlineStepSequenceBlock(steps = [], saved = false, title = "") {
  const docShape = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, { steps, saved, title });
  return {
    id: generateId("NST"),
    type: NODE_BLOCK_TYPES.STEP_SEQUENCE,
    title: docShape.title,
    steps: docShape.steps,
    saved: docShape.saved,
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
        macronodeHeading: block.macronodeHeading != null
          ? Boolean(block.macronodeHeading)
          : Boolean(block.nodeId || block.queryEnabled),
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.H2) {
      return {
        id: block.id || generateId("NH2"),
        type: NODE_BLOCK_TYPES.H2,
        title: block.title || "",
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.H3) {
      return {
        id: block.id || generateId("NH3"),
        type: NODE_BLOCK_TYPES.H3,
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
    if (block?.type === NODE_BLOCK_TYPES.PASSWORD_VAULT) {
      return {
        id: block.id || generateId("NPW"),
        type: NODE_BLOCK_TYPES.PASSWORD_VAULT,
        entries: normalizePasswordEntries(block.entries),
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.LINK_VAULT) {
      return {
        id: block.id || generateId("NLK"),
        type: NODE_BLOCK_TYPES.LINK_VAULT,
        entries: normalizeLinkEntries(block.entries),
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.AGENT) {
      return {
        id: block.id || generateId("NAG"),
        type: NODE_BLOCK_TYPES.AGENT,
        instruction: String(block.instruction ?? ""),
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.STEP_SEQUENCE) {
      const docShape = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
        steps: block.steps,
        saved: block.saved,
        title: block.title,
      });
      return {
        id: block.id || generateId("NST"),
        type: NODE_BLOCK_TYPES.STEP_SEQUENCE,
        title: docShape.title,
        steps: docShape.steps,
        saved: docShape.saved,
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.IMAGE || block?.type === DOC_BLOCK_TYPES.IMAGE) {
      const docShape = createDocBlock(DOC_BLOCK_TYPES.IMAGE, block);
      return {
        ...docShape,
        id: block.id || docShape.id || generateId("NIM"),
        type: NODE_BLOCK_TYPES.IMAGE,
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.IMAGE_SPLIT || block?.type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
      const docShape = createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, block);
      return {
        ...docShape,
        id: block.id || docShape.id || generateId("NIS"),
        type: NODE_BLOCK_TYPES.IMAGE_SPLIT,
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.PRODUCT_CARD || block?.type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
      const docShape = createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD, block);
      return {
        ...docShape,
        id: block.id || docShape.id || generateId("NPC"),
        type: NODE_BLOCK_TYPES.PRODUCT_CARD,
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
    if (block.type === NODE_BLOCK_TYPES.H1
      || block.type === NODE_BLOCK_TYPES.H2
      || block.type === NODE_BLOCK_TYPES.H3) {
      return block.title.trim();
    }
    if (block.type === NODE_BLOCK_TYPES.TODO) {
      return block.listTitle.trim()
        || block.items.some((item) => (item.text || "").trim());
    }
    if (block.type === NODE_BLOCK_TYPES.CODE) {
      return Boolean(block.codeSaved && block.code?.trim());
    }
    if (block.type === NODE_BLOCK_TYPES.PASSWORD_VAULT) {
      return block.entries.length > 0;
    }
    if (block.type === NODE_BLOCK_TYPES.LINK_VAULT) {
      return block.entries.length > 0;
    }
    if (block.type === NODE_BLOCK_TYPES.AGENT) {
      return Boolean((block.instruction || "").trim());
    }
    if (block.type === NODE_BLOCK_TYPES.STEP_SEQUENCE) {
      return block.steps.some((step) => (step.text || "").trim());
    }
    if (block.type === NODE_BLOCK_TYPES.IMAGE || block.type === NODE_BLOCK_TYPES.IMAGE_SPLIT) {
      return Boolean((block.src || "").trim()) || Boolean(block.imageSaved);
    }
    if (block.type === NODE_BLOCK_TYPES.PRODUCT_CARD) {
      return Boolean(block.specsSaved)
        || Boolean((block.title || "").trim())
        || (Array.isArray(block.images) && block.images.some((img) => img?.src));
    }
    return block.text.trim();
  });
}

/** True when the stack has typed text or any structural block (todo, h1, code, vault). */
export function nodeWritingBlocksHaveStructure(blocks) {
  return normalizeWritingBlocks(blocks).some((block) => {
    if (block.type !== NODE_BLOCK_TYPES.TEXT) return true;
    return block.text.trim();
  });
}

export function serializeNodeWritingBody({ blocks } = {}) {
  const normalized = normalizeWritingBlocks(blocks);
  if (!nodeWritingBlocksHaveStructure(normalized)) {
    return "";
  }
  return {
    kind: NODE_BODY_KIND,
    blocks: normalized,
  };
}

/** Plain string for Zustand when draft is text-only; keep node-body for structural blocks. */
export function nodeDraftContentForStorage(content, dataType = "text") {
  if (dataType !== "text") return content;
  if (
    content
    && typeof content === "object"
    && !Array.isArray(content)
    && content.kind
    && content.kind !== NODE_BODY_KIND
  ) {
    return content;
  }
  if (typeof content === "string") return content;
  if (!isNodeWritingBody(content)) return content;

  const { blocks } = parseNodeWritingBody(content);
  const normalized = normalizeWritingBlocks(blocks);
  const hasStructure = normalized.some((block) => block.type !== NODE_BLOCK_TYPES.TEXT);
  if (hasStructure) {
    return serializeNodeWritingBody({ blocks: normalized });
  }

  const textBlocks = normalized.filter((block) => block.type === NODE_BLOCK_TYPES.TEXT);
  if (textBlocks.length <= 1) {
    return textBlocks[0]?.text ?? "";
  }
  return textBlocks.map((block) => block.text).join("\n\n");
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

export function ensureEmptyTextBlockAfterNode(blocks, blockIndex) {
  const normalized = normalizeWritingBlocks(blocks);
  if (blockIndex < 0 || blockIndex >= normalized.length) return normalized;
  const after = normalized[blockIndex + 1];
  if (after?.type === NODE_BLOCK_TYPES.TEXT && !(after.text || "").trim()) {
    return normalized;
  }
  return insertBlockAfterIndex(normalized, blockIndex, createEmptyTextBlock());
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
    return createInlineH1Block(String(textPrefix || "").trim(), {
      macronodeHeading: Boolean(parsed.macronodeHeading),
    });
  }
  if (parsed.type === DOC_BLOCK_TYPES.H2) {
    return createInlineH2Block(String(textPrefix || "").trim());
  }
  if (parsed.type === DOC_BLOCK_TYPES.H3) {
    return createInlineH3Block(String(textPrefix || "").trim());
  }
  if (parsed.type === DOC_BLOCK_TYPES.TODO) {
    return createInlineTodoBlock();
  }
  if (parsed.type === DOC_BLOCK_TYPES.CODE) {
    return createInlineCodeBlock();
  }
  if (parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT) {
    return createInlinePasswordVaultBlock();
  }
  if (parsed.type === DOC_BLOCK_TYPES.LINK_VAULT) {
    return createInlineLinkVaultBlock();
  }
  if (parsed.type === DOC_BLOCK_TYPES.AGENT) {
    return createInlineAgentBlock(String(textPrefix || "").trim());
  }
  if (parsed.type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
    return createInlineStepSequenceBlock();
  }
  if (parsed.type === DOC_BLOCK_TYPES.IMAGE) {
    const docShape = createDocBlock(DOC_BLOCK_TYPES.IMAGE, { openFilePicker: true });
    return {
      ...docShape,
      id: generateId("NIM"),
      type: NODE_BLOCK_TYPES.IMAGE,
    };
  }
  if (parsed.type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
    const docShape = createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, { openFilePicker: false });
    return {
      ...docShape,
      id: generateId("NIS"),
      type: NODE_BLOCK_TYPES.IMAGE_SPLIT,
    };
  }
  if (parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
    const docShape = createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD, {
      title: "ProductCard",
      openFilePicker: false,
    });
    return {
      ...docShape,
      id: generateId("NPC"),
      type: NODE_BLOCK_TYPES.PRODUCT_CARD,
    };
  }
  return null;
}

export function applySlashInTextBlock(blocks, blockIndex, parsed) {
  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return normalized;

  const { prefix } = splitBodyForSlash(block.text);
  const vaultNodeType = vaultNodeTypeForParsed(parsed);
  if (vaultNodeType) {
    const existingIndex = findLastVaultBlockIndex(normalized, vaultNodeType);
    if (existingIndex >= 0) {
      const updated = normalized.map((entry, index) => (
        index === blockIndex ? { ...entry, text: prefix } : entry
      ));
      return ensureNodeWritingTail(updated);
    }
  }

  if (parsed?.type === DOC_BLOCK_TYPES.AGENT) {
    const existingIndex = findLastAgentBlockIndex(normalized);
    if (existingIndex >= 0) {
      const updated = normalized.map((entry, index) => (
        index === blockIndex ? { ...entry, text: prefix } : entry
      ));
      return ensureNodeWritingTail(updated);
    }
  }

  const newBlock = createNodeWritingBlockFromSlash(parsed, "");
  if (!newBlock) return normalized;

  const next = [...normalized];
  if (!prefix.trim()) {
    next[blockIndex] = newBlock;
  } else {
    next[blockIndex] = { ...block, text: prefix };
    next.splice(blockIndex + 1, 0, newBlock);
  }
  return ensureNodeWritingTail(next);
}

export function appendNodeWritingBlockFromSlash(blocks, parsed, textPrefix = "") {
  if (parsed?.focusTextBlock) {
    const normalized = normalizeWritingBlocks(blocks);
    const tail = ensureNodeWritingTail(normalized);
    let textIndex = tail.length - 1;
    for (let index = tail.length - 1; index >= 0; index -= 1) {
      if (tail[index]?.type === NODE_BLOCK_TYPES.TEXT) {
        textIndex = index;
        break;
      }
    }
    return {
      blocks: tail,
      insertedIndex: textIndex,
      focusText: true,
      reusedVault: false,
      reusedAgent: false,
    };
  }

  if (parsed?.type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
    const normalized = normalizeWritingBlocks(blocks);
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized[index].type === NODE_BLOCK_TYPES.PRODUCT_CARD) {
        return {
          blocks: normalized,
          insertedIndex: index,
          reusedVault: false,
          reusedAgent: false,
        };
      }
    }
  }

  const vaultNodeType =
    parsed?.type === DOC_BLOCK_TYPES.PASSWORD_VAULT ? NODE_BLOCK_TYPES.PASSWORD_VAULT
      : parsed?.type === DOC_BLOCK_TYPES.LINK_VAULT ? NODE_BLOCK_TYPES.LINK_VAULT
        : null;

  if (vaultNodeType) {
    const normalized = normalizeWritingBlocks(blocks);
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized[index].type === vaultNodeType) {
        return {
          blocks: normalized,
          insertedIndex: index,
          reusedVault: true,
        };
      }
    }
  }

  if (parsed?.type === DOC_BLOCK_TYPES.AGENT) {
    const normalized = normalizeWritingBlocks(blocks);
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (normalized[index].type === NODE_BLOCK_TYPES.AGENT) {
        return {
          blocks: normalized,
          insertedIndex: index,
          reusedAgent: true,
        };
      }
    }
  }

  const newBlock = createNodeWritingBlockFromSlash(parsed, textPrefix);
  if (!newBlock) {
    return { blocks: normalizeWritingBlocks(blocks), insertedIndex: -1, reusedVault: false, reusedAgent: false };
  }
  const nextBlocks = appendNodeWritingBlock(blocks, newBlock);
  const insertedIndex = nextBlocks.findIndex((block) => block.id === newBlock.id);
  return { blocks: nextBlocks, insertedIndex, reusedVault: false, reusedAgent: false };
}

function findLastVaultBlockIndex(blocks, vaultNodeType) {
  const normalized = normalizeWritingBlocks(blocks);
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (normalized[index].type === vaultNodeType) return index;
  }
  return -1;
}

function findLastAgentBlockIndex(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (normalized[index].type === NODE_BLOCK_TYPES.AGENT) return index;
  }
  return -1;
}

function vaultNodeTypeForParsed(parsed) {
  if (parsed?.type === DOC_BLOCK_TYPES.PASSWORD_VAULT) return NODE_BLOCK_TYPES.PASSWORD_VAULT;
  if (parsed?.type === DOC_BLOCK_TYPES.LINK_VAULT) return NODE_BLOCK_TYPES.LINK_VAULT;
  return null;
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
