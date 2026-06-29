import {
  createDocBlock,
  createEmbedVideoBlocks,
  createTodoItem,
  DOC_BLOCK_TYPES,
} from "./docBlocks.js";
import { getSlashTail, splitBodyForSlash } from "./docSlashTail.js";
import { NODE_DATA_TYPES } from "./nodeDataTypes.js";
import {
  createDefaultNodeTodoContent,
  DEFAULT_NODE_TODO_LIST_TITLE,
} from "./nodeTodoContent.js";
import { buildVideoNodeContent } from "./videoEmbed.js";

export { getSlashTail, splitBodyForSlash };

export const DOC_SLASH_COMMANDS = [
  {
    label: "Title",
    ghostHint: "create title",
    aliases: ["title", "h1", "createtitle"],
    blockType: DOC_BLOCK_TYPES.H1,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Todo list",
    ghostHint: "todo",
    aliases: ["todo", "todolist", "todo-list", "checkbox", "to-do"],
    blockType: DOC_BLOCK_TYPES.TODO,
    nodeDataType: NODE_DATA_TYPES.CHECKBOX,
    defaultListTitle: "Todo list:",
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
  {
    label: "Embedded video",
    ghostHint: "embedvideo",
    aliases: ["embedvideo", "embeddedvideo", "video", "embed"],
    blockType: DOC_BLOCK_TYPES.VIDEO_EMBED,
    nodeDataType: NODE_DATA_TYPES.VIDEO,
    compound: true,
  },
  {
    label: "Imagen",
    ghostHint: "imagen",
    aliases: ["imagen", "image", "img"],
    blockType: DOC_BLOCK_TYPES.IMAGE,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
];

export const DOC_SLASH_GHOST_HINTS = DOC_SLASH_COMMANDS.map(
  (c) => c.ghostHint ?? c.label,
);

/** Slash commands available in standalone node editors (not full documents). */
export const NODE_SLASH_COMMANDS = DOC_SLASH_COMMANDS.filter(
  (cmd) => cmd.blockType === DOC_BLOCK_TYPES.TODO,
);

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
    compound: Boolean(match.compound),
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

  if (parsed.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
    const [, video] = createEmbedVideoBlocks();
    return video;
  }

  if (parsed.type === DOC_BLOCK_TYPES.IMAGE) {
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE, { openFilePicker: true });
  }

  return createDocBlock();
}

export function createBlocksFromSlash(parsed, prefix = "") {
  const blocks = [];
  if (String(prefix).trim()) {
    blocks.push(createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: prefix }));
  }
  if (parsed?.compound && parsed.type === DOC_BLOCK_TYPES.VIDEO_EMBED) {
    blocks.push(...createEmbedVideoBlocks());
  } else {
    blocks.push(createDocBlockFromSlash(parsed));
  }
  return blocks;
}

/** Default node entity shape when a slash command is applied outside a document. */
export function initialNodeShapeFromSlash(alias, prefix = "") {
  const parsed = parseSlashQuery(alias);
  if (!parsed?.nodeDataType) return null;

  const trimmedPrefix = String(prefix ?? "").trim();
  const defaultTitle = trimmedPrefix || parsed.label || "Untitled query";

  switch (parsed.nodeDataType) {
    case NODE_DATA_TYPES.TEXT:
      if (parsed.type === DOC_BLOCK_TYPES.PRODUCT_CARD) {
        return {
          dataType: NODE_DATA_TYPES.TEXT,
          content: JSON.stringify({
            category: "",
            partNumber: "",
            dimensions: { x: "", y: "", z: "" },
            material: "",
            mountingPointDistance: "",
            imageCount: 0,
            images: [],
          }),
          defaultTitle: "ProductCard",
        };
      }
      return {
        dataType: NODE_DATA_TYPES.TEXT,
        content: trimmedPrefix,
        defaultTitle,
      };
    case NODE_DATA_TYPES.CHECKBOX: {
      const todoCmd = DOC_SLASH_COMMANDS.find((c) => c.blockType === DOC_BLOCK_TYPES.TODO);
      return {
        dataType: NODE_DATA_TYPES.CHECKBOX,
        content: createDefaultNodeTodoContent(
          todoCmd?.defaultListTitle ?? DEFAULT_NODE_TODO_LIST_TITLE,
        ),
        defaultTitle: defaultTitle || "Todo list",
      };
    }
    case NODE_DATA_TYPES.DATE:
      return {
        dataType: NODE_DATA_TYPES.DATE,
        content: { date: "", time: "" },
        defaultTitle,
      };
    case NODE_DATA_TYPES.METRIC:
      return {
        dataType: NODE_DATA_TYPES.METRIC,
        content: { value: "", unit: "" },
        defaultTitle,
      };
    case NODE_DATA_TYPES.VIDEO: {
      const [, videoBlock] = createEmbedVideoBlocks();
      return {
        dataType: NODE_DATA_TYPES.VIDEO,
        content: buildVideoNodeContent(videoBlock),
        defaultTitle: defaultTitle || "Video",
      };
    }
    default:
      return {
        dataType: NODE_DATA_TYPES.TEXT,
        content: trimmedPrefix,
        defaultTitle,
      };
  }
}

/** Apply slash tail at end of a text field → node type + content (standalone nodes). */
export function applySlashTailToNodeField(textValue) {
  const { prefix, slash } = splitBodyForSlash(textValue);
  if (!slash) return null;
  const normalized = slash.slice(1).trim().toLowerCase().replace(/\s+/g, "");
  const cmd = NODE_SLASH_COMMANDS.find((c) =>
    c.aliases.some((alias) => alias.replace(/\s+/g, "") === normalized),
  );
  if (!cmd) return null;
  return initialNodeShapeFromSlash(cmd.aliases[0], prefix);
}

export function parseNodeSlashQuery(query) {
  const normalized = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = NODE_SLASH_COMMANDS.find((cmd) =>
    cmd.aliases.some((alias) => alias.replace(/\s+/g, "") === normalized),
  );

  if (!match) return null;

  return {
    type: match.blockType,
    nodeDataType: match.nodeDataType,
    label: match.label,
    compound: Boolean(match.compound),
  };
}

export function isNodeSlashCommandEnabled(cmd) {
  return NODE_SLASH_COMMANDS.some((entry) => entry.label === cmd?.label);
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
