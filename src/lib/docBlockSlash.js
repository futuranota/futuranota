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
import {
  createInlineAgentBlock,
  serializeNodeWritingBody,
} from "./nodeInlineContent.js";
import { buildVideoNodeContent } from "./videoEmbed.js";

export { getSlashTail, splitBodyForSlash };

export const DOC_SLASH_COMMANDS = [
  {
    label: "Heading 1",
    ghostHint: "heading 1",
    aliases: ["h1", "heading1"],
    blockType: DOC_BLOCK_TYPES.H1,
    nodeDataType: NODE_DATA_TYPES.TEXT,
    macronodeHeading: false,
  },
  {
    label: "Heading 2",
    ghostHint: "heading 2",
    aliases: ["h2", "heading2"],
    blockType: DOC_BLOCK_TYPES.H2,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Heading 3",
    ghostHint: "heading 3",
    aliases: ["h3", "heading3"],
    blockType: DOC_BLOCK_TYPES.H3,
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
    label: "ProductCard",
    ghostHint: "productcard",
    aliases: ["productcard", "product-card", "product card"],
    blockType: DOC_BLOCK_TYPES.PRODUCT_CARD,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Imagen",
    ghostHint: "imagen",
    aliases: ["imagen", "image", "img"],
    blockType: DOC_BLOCK_TYPES.IMAGE,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Image card",
    menuLabel: "Card",
    menuGroup: "imageCard",
    menuGroupLabel: "Image Card",
    ghostHint: "image card",
    aliases: [
      "imagecard",
      "image-card",
      "image card",
      "image-split",
      "imagesplit",
      "image split",
      "split",
    ],
    blockType: DOC_BLOCK_TYPES.IMAGE_SPLIT,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Banner",
    menuLabel: "Banner",
    menuGroup: "imageCard",
    menuGroupLabel: "Image Card",
    ghostHint: "banner",
    aliases: ["banner", "imagebanner", "image-banner", "image banner"],
    blockType: DOC_BLOCK_TYPES.BANNER,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Moodboard",
    menuLabel: "Board",
    menuGroup: "moodboard",
    menuGroupLabel: "Moodboard",
    ghostHint: "moodboard",
    aliases: ["moodboard", "mood board", "mood-board", "board"],
    blockType: DOC_BLOCK_TYPES.MOODBOARD,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Code",
    ghostHint: "code",
    aliases: ["code", "codigo", "snippet", "codeblock"],
    blockType: DOC_BLOCK_TYPES.CODE,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Password",
    ghostHint: "queue to table",
    aliases: [
      "password",
      "queue to password",
      "queuetopassword",
      "queue password",
      "pass",
      "clave",
      "contraseña",
      "contrasena",
    ],
    blockType: DOC_BLOCK_TYPES.PASSWORD_VAULT,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "URL",
    ghostHint: "queue to table",
    aliases: ["queue to table", "queuetotable", "queuetable", "urltable", "linktable", "link", "enlace", "url", "bookmark"],
    blockType: DOC_BLOCK_TYPES.LINK_VAULT,
    nodeDataType: NODE_DATA_TYPES.TEXT,
  },
  {
    label: "Create node",
    ghostHint: "create node",
    aliases: ["node", "createnode", "macronodo", "createtitle", "title"],
    blockType: DOC_BLOCK_TYPES.H1,
    nodeDataType: NODE_DATA_TYPES.TEXT,
    allowsNodeLink: true,
    macronodeHeading: true,
  },
  {
    label: "Agent",
    ghostHint: "agent",
    aliases: ["agent"],
    blockType: DOC_BLOCK_TYPES.AGENT,
    nodeDataType: NODE_DATA_TYPES.TEXT,
    macroOnly: true,
  },
];

export const DOC_SLASH_GHOST_HINTS = DOC_SLASH_COMMANDS.map(
  (c) => c.ghostHint ?? c.label,
);

/**
 * Collapse flat slash commands into menu rows for the [+] picker.
 * Commands with the same `menuGroup` render under one header (Image Card, Moodboard…).
 * @param {typeof DOC_SLASH_COMMANDS} commands
 * @returns {Array<
 *   | { kind: "command"; command: (typeof DOC_SLASH_COMMANDS)[number] }
 *   | { kind: "group"; id: string; label: string; commands: typeof DOC_SLASH_COMMANDS }
 * >}
 */
export function buildSlashMenuSections(commands = DOC_SLASH_COMMANDS) {
  const sections = [];
  let openGroup = null;

  for (const cmd of commands) {
    const groupId = cmd.menuGroup || null;
    if (groupId) {
      if (!openGroup || openGroup.id !== groupId) {
        openGroup = {
          kind: "group",
          id: groupId,
          label: cmd.menuGroupLabel || cmd.label,
          commands: [],
        };
        sections.push(openGroup);
      }
      openGroup.commands.push(cmd);
      continue;
    }
    openGroup = null;
    sections.push({ kind: "command", command: cmd });
  }

  return sections;
}

/** Content folders: only create / link nodes (macronodes). */
export const FOLDER_SLASH_COMMANDS = DOC_SLASH_COMMANDS.filter(
  (cmd) => Boolean(cmd.macronodeHeading),
);

/** Documents (and node writing surfaces): all tools except Create node. */
export const DOCUMENT_SLASH_COMMANDS = DOC_SLASH_COMMANDS.filter(
  (cmd) => !cmd.macronodeHeading,
);

export const FOLDER_SLASH_GHOST_HINTS = FOLDER_SLASH_COMMANDS.map(
  (c) => c.ghostHint ?? c.label,
);

export const DOCUMENT_SLASH_GHOST_HINTS = DOCUMENT_SLASH_COMMANDS.map(
  (c) => c.ghostHint ?? c.label,
);

/** Slash commands available in node editors (macronodes / docs). */
export const NODE_SLASH_COMMANDS = DOCUMENT_SLASH_COMMANDS;

/** Slash commands for nodes opened from a folder — same writing toolkit. */
export const DOC_LINKED_NODE_SLASH_COMMANDS = DOCUMENT_SLASH_COMMANDS;

/** Slash commands allowed inside Image card body (same toolkit as document text). */
export const IMAGE_CARD_BODY_SLASH_COMMANDS = DOCUMENT_SLASH_COMMANDS;

export const IMAGE_CARD_BODY_SLASH_GHOST_HINTS = DOCUMENT_SLASH_GHOST_HINTS;

/** Slash commands allowed inside a step-by-step instruction field. */
export const STEP_SLASH_COMMANDS = DOC_SLASH_COMMANDS.filter(
  (cmd) => cmd.blockType === DOC_BLOCK_TYPES.CODE,
);

export function parseSlashQuery(query) {
  return parseSlashQueryFromCommands(query, DOC_SLASH_COMMANDS);
}

export function parseFolderSlashQuery(query) {
  return parseSlashQueryFromCommands(query, FOLDER_SLASH_COMMANDS);
}

export function parseDocumentSlashQuery(query) {
  return parseSlashQueryFromCommands(query, DOCUMENT_SLASH_COMMANDS);
}

export function parseDocLinkedNodeSlashQuery(query) {
  return parseSlashQueryFromCommands(query, DOC_LINKED_NODE_SLASH_COMMANDS);
}

export function parseSlashQueryFromCommands(query, commands = DOC_SLASH_COMMANDS) {
  const normalized = String(query ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = commands.find((cmd) =>
    cmd.aliases.some((alias) => alias.replace(/\s+/g, "") === normalized),
  );

  if (!match) return null;

  return {
    type: match.blockType,
    nodeDataType: match.nodeDataType,
    label: match.label,
    compound: Boolean(match.compound),
    macronodeHeading: Boolean(match.macronodeHeading),
    allowsNodeLink: Boolean(match.allowsNodeLink),
    focusTextBlock: Boolean(match.focusTextBlock),
  };
}

/** Build a new doc block from a parsed slash command. */
export function createDocBlockFromSlash(parsed) {
  if (!parsed?.type) return createDocBlock();

  if (parsed.type === DOC_BLOCK_TYPES.H1) {
    return createDocBlock(DOC_BLOCK_TYPES.H1, {
      title: "",
      macronodeHeading: Boolean(parsed.macronodeHeading),
    });
  }

  if (parsed.type === DOC_BLOCK_TYPES.H2) {
    return createDocBlock(DOC_BLOCK_TYPES.H2, { title: "" });
  }

  if (parsed.type === DOC_BLOCK_TYPES.H3) {
    return createDocBlock(DOC_BLOCK_TYPES.H3, { title: "" });
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

  if (parsed.type === DOC_BLOCK_TYPES.IMAGE_SPLIT) {
    return createDocBlock(DOC_BLOCK_TYPES.IMAGE_SPLIT, { openFilePicker: false });
  }

  if (parsed.type === DOC_BLOCK_TYPES.MOODBOARD) {
    return createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, { openFilePicker: false });
  }

  if (parsed.type === DOC_BLOCK_TYPES.BANNER) {
    return createDocBlock(DOC_BLOCK_TYPES.BANNER, { openFilePicker: false });
  }

  if (parsed.type === DOC_BLOCK_TYPES.CODE) {
    return createDocBlock(DOC_BLOCK_TYPES.CODE);
  }

  if (parsed.type === DOC_BLOCK_TYPES.PASSWORD_VAULT) {
    return createDocBlock(DOC_BLOCK_TYPES.PASSWORD_VAULT);
  }

  if (parsed.type === DOC_BLOCK_TYPES.LINK_VAULT) {
    return createDocBlock(DOC_BLOCK_TYPES.LINK_VAULT);
  }

  if (parsed.type === DOC_BLOCK_TYPES.AGENT) {
    return createDocBlock(DOC_BLOCK_TYPES.AGENT, { instruction: "" });
  }

  if (parsed.type === DOC_BLOCK_TYPES.STEP_SEQUENCE) {
    return createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE);
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
    const block = createDocBlockFromSlash(parsed);
    if (block) blocks.push(block);
  }
  return blocks.length ? blocks : [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
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
      if (parsed.type === DOC_BLOCK_TYPES.AGENT) {
        return {
          dataType: NODE_DATA_TYPES.TEXT,
          content: serializeNodeWritingBody({
            blocks: [createInlineAgentBlock(trimmedPrefix)],
          }),
          defaultTitle: trimmedPrefix || "Agent",
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
  return parseSlashQueryFromCommands(query, NODE_SLASH_COMMANDS);
}

export function isNodeSlashCommandEnabled(cmd) {
  return NODE_SLASH_COMMANDS.some((entry) => entry.label === cmd?.label);
}

export function isDocLinkedNodeSlashCommandEnabled(cmd) {
  return DOC_LINKED_NODE_SLASH_COMMANDS.some((entry) => entry.label === cmd?.label);
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
