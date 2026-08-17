import { createTodoItem, createDocBlock, DOC_BLOCK_TYPES, applyTodoSlashToImageSplit } from "./docBlocks.js";
import { DEFAULT_CODE_LANGUAGE, normalizeCodeLanguage } from "./codeBlockLanguages.js";
import { generateId } from "./ids.js";
import { applyTextEditToMentions, normalizeMentions } from "./docMentions.js";
import { applyTextEditToTagRefs, normalizeTagRefs, splitTagRefsAt } from "./docTagRefs.js";
import { applyTextEditToMarkerRanges, normalizeMarkerRanges, splitMarkerRangesAt } from "./docTextMarkerRanges.js";
import { applyTextEditToBoldRanges, normalizeBoldRanges, splitBoldRangesAt } from "./docTextBoldRanges.js";
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
  MOODBOARD: "moodboard",
  BANNER: "banner",
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

export function createEmptyTextBlock(text = "", patch = {}) {
  const value = text || "";
  const mentions = normalizeMentions(value, patch.mentions);
  const tagRefs = normalizeTagRefs(value, patch.tagRefs);
  const markerRanges = normalizeMarkerRanges(value, patch.markerRanges);
  const boldRanges = normalizeBoldRanges(value, patch.boldRanges);
  return {
    id: patch.id || generateId("NTX"),
    type: NODE_BLOCK_TYPES.TEXT,
    text: value,
    ...(mentions.length ? { mentions } : {}),
    ...(tagRefs.length ? { tagRefs } : {}),
    ...(markerRanges.length ? { markerRanges } : {}),
    ...(boldRanges.length ? { boldRanges } : {}),
    ...(patch.embedded && typeof patch.embedded === "object"
      ? { embedded: patch.embedded }
      : {}),
  };
}

/**
 * Split a writing TEXT value at the caret so a heading/widget can land on that line.
 * Empty (free) lines are replaced; otherwise splits exactly at the caret.
 */
export function splitWritingTextAtCaret(text, caret) {
  const str = String(text ?? "");
  const raw = Number(caret);
  const pos = Math.max(0, Math.min(str.length, Number.isFinite(raw) ? raw : str.length));

  const lineStart = str.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const nextBreak = str.indexOf("\n", pos);
  const lineEnd = nextBreak === -1 ? str.length : nextBreak;
  const lineContent = str.slice(lineStart, lineEnd);

  if (!lineContent.trim()) {
    // Free line → drop it and insert between surrounding lines.
    let before = str.slice(0, lineStart);
    if (before.endsWith("\n")) before = before.slice(0, -1);
    const after = nextBreak === -1 ? "" : str.slice(nextBreak + 1);
    return {
      before,
      after,
      headEnd: before.length,
      // Original index where `after` began in `str` (for range splitting).
      tailStart: nextBreak === -1 ? str.length : nextBreak + 1,
    };
  }

  return {
    before: str.slice(0, pos),
    after: str.slice(pos),
    headEnd: pos,
    tailStart: pos,
  };
}

function splitTextBlockAnnotations(block, headEnd, tailStart, beforeText, afterText) {
  const { headRanges: headMarkers, tailRanges: tailMarkers } = splitMarkerRangesAt(
    block?.markerRanges,
    headEnd,
    tailStart,
  );
  const { headRanges: headBolds, tailRanges: tailBolds } = splitBoldRangesAt(
    block?.boldRanges,
    headEnd,
    tailStart,
  );
  const { headRanges: headTagRefs, tailRanges: tailTagRefs } = splitTagRefsAt(
    block?.tagRefs,
    headEnd,
    tailStart,
  );
  return {
    beforePatch: {
      mentions: normalizeMentions(beforeText, block?.mentions),
      tagRefs: normalizeTagRefs(beforeText, headTagRefs),
      markerRanges: normalizeMarkerRanges(beforeText, headMarkers),
      boldRanges: normalizeBoldRanges(beforeText, headBolds),
      ...(block?.embedded && typeof block.embedded === "object"
        ? { embedded: block.embedded }
        : {}),
    },
    afterPatch: {
      mentions: normalizeMentions(afterText, block?.mentions),
      tagRefs: normalizeTagRefs(afterText, tailTagRefs),
      markerRanges: normalizeMarkerRanges(afterText, tailMarkers),
      boldRanges: normalizeBoldRanges(afterText, tailBolds),
    },
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
    if (block?.type === NODE_BLOCK_TYPES.MOODBOARD || block?.type === DOC_BLOCK_TYPES.MOODBOARD) {
      const docShape = createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, block);
      return {
        ...docShape,
        id: block.id || docShape.id || generateId("NMB"),
        type: NODE_BLOCK_TYPES.MOODBOARD,
      };
    }
    if (block?.type === NODE_BLOCK_TYPES.BANNER || block?.type === DOC_BLOCK_TYPES.BANNER) {
      const docShape = createDocBlock(DOC_BLOCK_TYPES.BANNER, block);
      return {
        ...docShape,
        id: block.id || docShape.id || generateId("NBN"),
        type: NODE_BLOCK_TYPES.BANNER,
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
    const text = block?.text || "";
    const mentions = normalizeMentions(text, block?.mentions);
    const tagRefs = normalizeTagRefs(text, block?.tagRefs);
    const markerRanges = normalizeMarkerRanges(text, block?.markerRanges);
    const boldRanges = normalizeBoldRanges(text, block?.boldRanges);
    return {
      id: block?.id || generateId("NTX"),
      type: NODE_BLOCK_TYPES.TEXT,
      text,
      ...(mentions.length ? { mentions } : {}),
      ...(tagRefs.length ? { tagRefs } : {}),
      ...(markerRanges.length ? { markerRanges } : {}),
      ...(boldRanges.length ? { boldRanges } : {}),
      // Keep inline Intel widgets (calendar/forecast) attached to the text cell.
      ...(block?.embedded && typeof block.embedded === "object"
        ? { embedded: block.embedded }
        : {}),
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
    if (block.type === NODE_BLOCK_TYPES.MOODBOARD) {
      return Boolean(block.moodboardSaved)
        || Boolean((block.caption || "").trim())
        || Boolean((block.body || "").trim())
        || (Array.isArray(block.columns) && block.columns.some((col) =>
          Boolean(col?.recipe)
          || (Array.isArray(col?.images) && col.images.some((img) => Boolean(img?.imageSaved && img?.src)))
          || Boolean((col?.stickyText || "").trim())
          || Boolean((col?.stickyTitle || "").trim())
          || Boolean((col?.infoLabel || "").trim())
        ))
        || Boolean(block.a?.imageSaved)
        || Boolean(block.b?.imageSaved);
    }
    if (block.type === NODE_BLOCK_TYPES.BANNER) {
      return Boolean((block.src || "").trim())
        || Boolean(block.imageSaved)
        || Boolean(block.bannerSaved)
        || Boolean((block.headline || "").trim());
    }
    if (block.type === NODE_BLOCK_TYPES.PRODUCT_CARD) {
      return Boolean(block.specsSaved)
        || Boolean((block.title || "").trim())
        || (Array.isArray(block.images) && block.images.some((img) => img?.src));
    }
    return Boolean(block.embedded) || block.text.trim();
  });
}

/** True when the stack has typed text or any structural block (todo, h1, code, vault). */
export function nodeWritingBlocksHaveStructure(blocks) {
  return normalizeWritingBlocks(blocks).some((block) => {
    if (block.type !== NODE_BLOCK_TYPES.TEXT) return true;
    if (block.embedded) return true;
    if (Array.isArray(block.mentions) && block.mentions.length > 0) return true;
    if (Array.isArray(block.tagRefs) && block.tagRefs.length > 0) return true;
    if (Array.isArray(block.markerRanges) && block.markerRanges.length > 0) return true;
    if (Array.isArray(block.boldRanges) && block.boldRanges.length > 0) return true;
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
  const hasStructure = normalized.some(
    (block) => (
      block.type !== NODE_BLOCK_TYPES.TEXT
      || block.embedded
      || (Array.isArray(block.mentions) && block.mentions.length > 0)
      || (Array.isArray(block.tagRefs) && block.tagRefs.length > 0)
      || (Array.isArray(block.markerRanges) && block.markerRanges.length > 0)
      || (Array.isArray(block.boldRanges) && block.boldRanges.length > 0)
    ),
  );
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
  return block?.type === NODE_BLOCK_TYPES.TEXT
    && !block.embedded
    && !(block.text || "").trim();
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

/** Drop trailing empty TEXT cells so inserts land next to real content. */
export function trimTrailingEmptyTextBlocks(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  let end = normalized.length;
  while (end > 0 && isEmptyTextBlock(normalized[end - 1])) {
    end -= 1;
  }
  if (end === normalized.length) return normalized;
  if (end === 0) return [createEmptyTextBlock()];
  return normalized.slice(0, end);
}

export function appendNodeWritingBlock(blocks, newBlock) {
  // Insert after last real content — never after a stack of empty TEXT cells.
  const head = trimTrailingEmptyTextBlocks(blocks);
  return ensureNodeWritingTail([...head, newBlock]);
}

/**
 * Resolve which TEXT cell the [+]/slash picker should mutate.
 * Prefers the focused TEXT; if focus is on a heading/widget, uses the TEXT below.
 * Falls back to the first trailing empty / last TEXT.
 */
export function resolveWritingPickerTextIndex(blocks, focusTarget = null) {
  const normalized = normalizeWritingBlocks(blocks);
  let blockIndex = focusTarget?.blockIndex;

  if (blockIndex != null && blockIndex >= 0 && blockIndex < normalized.length) {
    const focused = normalized[blockIndex];
    if (focused?.type === NODE_BLOCK_TYPES.TEXT) return blockIndex;
    const after = normalized[blockIndex + 1];
    if (after?.type === NODE_BLOCK_TYPES.TEXT) return blockIndex + 1;
  }

  // First trailing empty TEXT (right under content), else last TEXT.
  let lastContent = -1;
  for (let i = 0; i < normalized.length; i += 1) {
    if (!isEmptyTextBlock(normalized[i])) lastContent = i;
  }
  for (let i = lastContent + 1; i < normalized.length; i += 1) {
    if (normalized[i]?.type === NODE_BLOCK_TYPES.TEXT) return i;
  }
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    if (normalized[i]?.type === NODE_BLOCK_TYPES.TEXT) return i;
  }
  return Math.max(0, normalized.length - 1);
}

/**
 * Insert a slash block at the focused writing cell (not appended past empty cells).
 */
export function insertNodeWritingSlashAtFocus(blocks, focusTarget, parsed, textPrefix = "") {
  if (parsed?.action) {
    const normalized = normalizeWritingBlocks(blocks);
    const textIndex = resolveWritingPickerTextIndex(normalized, focusTarget);
    if (normalized[textIndex]?.type === NODE_BLOCK_TYPES.TEXT) {
      return {
        blocks: applySlashInTextBlock(normalized, textIndex, parsed),
        insertedIndex: -1,
        reusedVault: false,
        reusedAgent: false,
        focusText: false,
      };
    }
    return {
      blocks: normalized,
      insertedIndex: -1,
      reusedVault: false,
      reusedAgent: false,
      focusText: false,
    };
  }

  if (parsed?.focusTextBlock) {
    return appendNodeWritingBlockFromSlash(blocks, parsed, textPrefix);
  }

  const normalized = normalizeWritingBlocks(blocks);
  const focusIndex = focusTarget?.blockIndex;

  // Image-split body: apply slash against the card (todo embeds; else sibling after).
  if (
    focusIndex != null
    && focusIndex >= 0
    && normalized[focusIndex]?.type === NODE_BLOCK_TYPES.IMAGE_SPLIT
  ) {
    const bodyValue = normalized[focusIndex].body || "";
    const prevIds = new Set(normalized.map((b) => b.id));
    const nextBlocks = applySlashInImageSplitBody(
      normalized,
      focusIndex,
      parsed,
      bodyValue,
    );
    if (parsed?.type === DOC_BLOCK_TYPES.TODO) {
      return {
        blocks: nextBlocks,
        insertedIndex: focusIndex,
        reusedVault: false,
        reusedAgent: false,
        focusText: false,
      };
    }
    const insertedIndex = nextBlocks.findIndex((b, i) => (
      i > focusIndex && !prevIds.has(b.id)
    ));
    return {
      blocks: nextBlocks,
      insertedIndex: insertedIndex >= 0 ? insertedIndex : focusIndex + 1,
      reusedVault: false,
      reusedAgent: false,
      focusText: false,
    };
  }

  const textIndex = resolveWritingPickerTextIndex(normalized, focusTarget);

  if (normalized[textIndex]?.type === NODE_BLOCK_TYPES.TEXT) {
    const caret = focusTarget?.caret;
    const prevIds = new Set(normalized.map((b) => b.id));
    const nextBlocks = applySlashInTextBlock(normalized, textIndex, parsed, caret);

    const insertedIndex = nextBlocks.findIndex((b, i) => (
      i >= textIndex
      && !prevIds.has(b.id)
      && b.type !== NODE_BLOCK_TYPES.TEXT
    ));

    if (insertedIndex < 0) {
      // Vault/agent reuse left TEXT in place — focus/append via shared helper.
      if (nextBlocks[textIndex]?.type === NODE_BLOCK_TYPES.TEXT) {
        return appendNodeWritingBlockFromSlash(blocks, parsed, textPrefix);
      }
      return {
        blocks: nextBlocks,
        insertedIndex: textIndex,
        reusedVault: false,
        reusedAgent: false,
        focusText: false,
      };
    }

    return {
      blocks: ensureNodeWritingTail(trimTrailingEmptyTextBlocks(nextBlocks)),
      insertedIndex,
      reusedVault: false,
      reusedAgent: false,
      focusText: false,
    };
  }

  // Focused on a non-text block with no TEXT below — insert after it.
  const newBlock = createNodeWritingBlockFromSlash(parsed, textPrefix);
  if (!newBlock) {
    return { blocks: normalized, insertedIndex: -1, reusedVault: false, reusedAgent: false };
  }
  const nextBlocks = ensureNodeWritingTail([
    ...normalized.slice(0, textIndex + 1),
    newBlock,
    ...normalized.slice(textIndex + 1),
  ]);
  return {
    blocks: nextBlocks,
    insertedIndex: nextBlocks.findIndex((b) => b.id === newBlock.id),
    reusedVault: false,
    reusedAgent: false,
    focusText: false,
  };
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
  if (parsed.type === DOC_BLOCK_TYPES.MOODBOARD) {
    const docShape = createDocBlock(DOC_BLOCK_TYPES.MOODBOARD, { openFilePicker: false });
    return {
      ...docShape,
      id: generateId("NMB"),
      type: NODE_BLOCK_TYPES.MOODBOARD,
    };
  }
  if (parsed.type === DOC_BLOCK_TYPES.BANNER) {
    const docShape = createDocBlock(DOC_BLOCK_TYPES.BANNER, { openFilePicker: false });
    return {
      ...docShape,
      id: generateId("NBN"),
      type: NODE_BLOCK_TYPES.BANNER,
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

/**
 * Strip a confirmed `#i` / `#o` token at the caret without inserting a writing block.
 * @param {object[]} blocks
 * @param {number} blockIndex
 * @param {{ start: number, end: number }} hashAction
 */
export function applyLibraryHashInTextBlock(blocks, blockIndex, hashAction) {
  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return normalized;
  if (!hashAction || typeof hashAction.start !== "number") return normalized;

  const text = block.text || "";
  const start = Math.max(0, Math.min(text.length, hashAction.start));
  const end = Math.max(start, Math.min(text.length, Number(hashAction.end) || start));
  if (end <= start) return normalized;

  const nextText = `${text.slice(0, start)}${text.slice(end)}`;
  const mentions = normalizeMentions(nextText, applyTextEditToMentions(text, nextText, block.mentions));
  const tagRefs = normalizeTagRefs(nextText, applyTextEditToTagRefs(text, nextText, block.tagRefs));
  const markerRanges = normalizeMarkerRanges(
    nextText,
    applyTextEditToMarkerRanges(text, nextText, block.markerRanges),
  );
  const boldRanges = normalizeBoldRanges(
    nextText,
    applyTextEditToBoldRanges(text, nextText, block.boldRanges),
  );
  const updated = normalized.map((entry, index) => (
    index === blockIndex
      ? {
        ...entry,
        text: nextText,
        ...(mentions.length ? { mentions } : { mentions: undefined }),
        ...(tagRefs.length ? { tagRefs } : { tagRefs: undefined }),
        ...(markerRanges.length ? { markerRanges } : { markerRanges: undefined }),
        ...(boldRanges.length ? { boldRanges } : { boldRanges: undefined }),
      }
      : entry
  ));
  return ensureNodeWritingTail(updated);
}

export function applySlashInTextBlock(blocks, blockIndex, parsed, caret = null) {
  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) return normalized;

  const text = block.text || "";
  const slashSplit = splitBodyForSlash(text);

  if (parsed?.action) {
    if (!slashSplit.slash) return normalized;
    const updated = normalized.map((entry, index) => (
      index === blockIndex ? { ...entry, text: slashSplit.prefix } : entry
    ));
    return ensureNodeWritingTail(updated);
  }

  const vaultNodeType = vaultNodeTypeForParsed(parsed);
  if (vaultNodeType) {
    const existingIndex = findLastVaultBlockIndex(normalized, vaultNodeType);
    if (existingIndex >= 0) {
      const prefix = slashSplit.slash ? slashSplit.prefix : text;
      const updated = normalized.map((entry, index) => (
        index === blockIndex ? { ...entry, text: prefix } : entry
      ));
      return ensureNodeWritingTail(updated);
    }
  }

  if (parsed?.type === DOC_BLOCK_TYPES.AGENT) {
    const existingIndex = findLastAgentBlockIndex(normalized);
    if (existingIndex >= 0) {
      const prefix = slashSplit.slash ? slashSplit.prefix : text;
      const updated = normalized.map((entry, index) => (
        index === blockIndex ? { ...entry, text: prefix } : entry
      ));
      return ensureNodeWritingTail(updated);
    }
  }

  const newBlock = createNodeWritingBlockFromSlash(parsed, "");
  if (!newBlock) return normalized;

  let before = text;
  let after = "";
  let headEnd = text.length;
  let tailStart = text.length;

  if (slashSplit.slash) {
    before = slashSplit.prefix;
    after = "";
    headEnd = before.length;
    tailStart = text.length;
  } else if (caret != null && Number.isFinite(Number(caret))) {
    const parts = splitWritingTextAtCaret(text, caret);
    before = parts.before;
    after = parts.after;
    headEnd = parts.headEnd;
    tailStart = parts.tailStart;
  }

  const next = [...normalized];
  const beforeHasContent = Boolean(before.trim());
  const afterHasContent = Boolean(after.trim());
  const { beforePatch, afterPatch } = splitTextBlockAnnotations(
    block,
    headEnd,
    tailStart,
    before,
    after,
  );

  if (!beforeHasContent && !afterHasContent) {
    next[blockIndex] = newBlock;
  } else if (!beforeHasContent) {
    next[blockIndex] = newBlock;
    next.splice(blockIndex + 1, 0, createEmptyTextBlock(after, afterPatch));
  } else {
    next[blockIndex] = {
      ...block,
      text: before,
      mentions: beforePatch.mentions.length ? beforePatch.mentions : undefined,
      tagRefs: beforePatch.tagRefs.length ? beforePatch.tagRefs : undefined,
      markerRanges: beforePatch.markerRanges.length ? beforePatch.markerRanges : undefined,
      boldRanges: beforePatch.boldRanges.length ? beforePatch.boldRanges : undefined,
    };
    next.splice(blockIndex + 1, 0, newBlock);
    if (afterHasContent) {
      next.splice(blockIndex + 2, 0, createEmptyTextBlock(after, afterPatch));
    }
  }

  return ensureNodeWritingTail(next);
}

/**
 * Confirm slash inside an image-split body: /todo embeds in-column;
 * other commands insert a sibling writing block after the card.
 * @param {object[]} blocks
 * @param {number} blockIndex
 * @param {object} parsed
 * @param {string} bodyValue
 */
export function applySlashInImageSplitBody(blocks, blockIndex, parsed, bodyValue) {
  const normalized = normalizeWritingBlocks(blocks);
  const block = normalized[blockIndex];
  if (!block || block.type !== NODE_BLOCK_TYPES.IMAGE_SPLIT) return normalized;

  if (parsed?.type === DOC_BLOCK_TYPES.TODO) {
    const patch = applyTodoSlashToImageSplit(block, bodyValue);
    if (!patch) return normalized;
    return normalized.map((entry, index) => (
      index === blockIndex
        ? { ...entry, ...patch, type: NODE_BLOCK_TYPES.IMAGE_SPLIT }
        : entry
    ));
  }

  const newBlock = createNodeWritingBlockFromSlash(parsed, "");
  if (!newBlock) return normalized;

  const { prefix } = splitBodyForSlash(bodyValue);
  const next = [...normalized];
  next[blockIndex] = {
    ...block,
    body: prefix,
    type: NODE_BLOCK_TYPES.IMAGE_SPLIT,
  };
  next.splice(blockIndex + 1, 0, newBlock);
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
