import { createDocBlock, createTodoItem, DOC_BLOCK_TYPES } from "./docBlocks.js";
import { NODE_DATA_TYPES } from "./nodeDataTypes.js";

export const DOC_SLASH_COMMANDS = [
  {
    label: "Title",
    ghostHint: "create title",
    aliases: ["title", "h1", "createtitle"],
    blockType: DOC_BLOCK_TYPES.H1,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Checkbox",
    ghostHint: "checkbox",
    aliases: ["checkbox", "todo", "to-do"],
    blockType: DOC_BLOCK_TYPES.TODO,
    nodeDataType: NODE_DATA_TYPES.CHECKBOX,
    defaultListTitle: "Checkbox:",
  },
  {
    label: "Date",
    ghostHint: "Date",
    aliases: ["date"],
    blockType: DOC_BLOCK_TYPES.DATE,
    nodeDataType: NODE_DATA_TYPES.DATE,
  },
  {
    label: "ProductCard",
    ghostHint: "productcard",
    aliases: ["productcard", "product-card", "product card"],
    blockType: DOC_BLOCK_TYPES.PRODUCT_CARD,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "metric",
    ghostHint: "metric",
    aliases: ["metric"],
    blockType: DOC_BLOCK_TYPES.METRIC,
    nodeDataType: NODE_DATA_TYPES.METRIC,
  },
];

export const DOC_SLASH_GHOST_HINTS = DOC_SLASH_COMMANDS.map(
  (c) => c.ghostHint ?? c.label,
);

export function getSlashTail(value) {
  const m = String(value ?? "").match(/(?:^|\n)(\/[^\n]*)$/);
  return m ? m[1] : null;
}

export function splitBodyForSlash(body) {
  const slash = getSlashTail(body);
  if (!slash) {
    return { prefix: String(body ?? ""), slash: null };
  }
  return {
    prefix: String(body ?? "").slice(0, body.length - slash.length),
    slash,
  };
}

export function parseSlashQuery(query) {
  const normalized = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = DOC_SLASH_COMMANDS.find((cmd) =>
    cmd.aliases.some((alias) => alias.replace(/\s+/g, "") === normalized),
  );

  if (!match) return null;

  return {
    type: match.blockType,
    nodeDataType: match.nodeDataType,
    label: match.label,
  };
}

/** Build a new doc block from a parsed slash command. */
export function createDocBlockFromSlash(parsed) {
  if (!parsed?.type) return createDocBlock();

  if (parsed.type === DOC_BLOCK_TYPES.H1) {
    return createDocBlock(DOC_BLOCK_TYPES.H1, { title: "" });
  }

  if (parsed.type === DOC_BLOCK_TYPES.TODO) {
    const cmd = DOC_SLASH_COMMANDS.find((c) => c.blockType === DOC_BLOCK_TYPES.TODO);
    return createDocBlock(DOC_BLOCK_TYPES.TODO, {
      items: [createTodoItem()],
      listTitle: cmd?.defaultListTitle ?? "Checkbox:",
    });
  }

  if (parsed.type === DOC_BLOCK_TYPES.DATE) {
    return createDocBlock(DOC_BLOCK_TYPES.DATE, {
      title: "",
      date: "",
      time: "",
    });
  }

  if (parsed.type === DOC_BLOCK_TYPES.METRIC) {
    return createDocBlock(DOC_BLOCK_TYPES.METRIC, {
      title: "",
      value: "",
      unit: "",
    });
  }

  if (parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
    return createDocBlock(DOC_BLOCK_TYPES.PRODUCT_CARD, {
      title: "ProductCard",
    });
  }

  return createDocBlock();
}

export function isNodeLinkableBlockType(blockType) {
  return [
    DOC_BLOCK_TYPES.H1,
    DOC_BLOCK_TYPES.TODO,
    DOC_BLOCK_TYPES.DATE,
    DOC_BLOCK_TYPES.METRIC,
  ].includes(blockType);
}

export function nodeDataTypeForBlock(block) {
  if (!block) return NODE_DATA_TYPES.TEXT;
  if (block.type === DOC_BLOCK_TYPES.H1) return NODE_DATA_TYPES.TEXT;
  if (block.type === DOC_BLOCK_TYPES.TODO) return NODE_DATA_TYPES.CHECKBOX;
  if (block.type === DOC_BLOCK_TYPES.DATE) return NODE_DATA_TYPES.DATE;
  if (block.type === DOC_BLOCK_TYPES.METRIC) return NODE_DATA_TYPES.METRIC;
  return NODE_DATA_TYPES.TEXT;
}
