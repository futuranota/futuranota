import {
  NODE_BLOCK_TYPES,
  parseNodeWritingBody,
} from "./nodeInlineContent.js";

export const NODE_WRITING_EXCERPT_MAX = 220;

/**
 * Collect plain readable text from writing blocks (skip vaults/images/media).
 * @param {unknown} content
 * @returns {string}
 */
export function getNodeWritingPlainText(content) {
  try {
    if (typeof content === "string") {
      return content.replace(/\s+/g, " ").trim();
    }

    const { blocks } = parseNodeWritingBody(content);
    const parts = [];

    for (const block of blocks) {
      if (!block) continue;
      if (
        block.type === NODE_BLOCK_TYPES.H1
        || block.type === NODE_BLOCK_TYPES.H2
        || block.type === NODE_BLOCK_TYPES.H3
      ) {
        const title = String(block.title || "").trim();
        if (title) parts.push(title);
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.TEXT) {
        const text = String(block.text || "").replace(/\s+/g, " ").trim();
        if (text) parts.push(text);
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.TODO) {
        const listTitle = String(block.listTitle || "").trim();
        if (listTitle) parts.push(listTitle);
        for (const item of block.items || []) {
          const itemText = String(item?.text || "").trim();
          if (itemText) parts.push(itemText);
        }
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.STEP_SEQUENCE) {
        for (const step of block.steps || []) {
          const stepText = String(step?.text || "").trim();
          if (stepText) parts.push(stepText);
        }
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.AGENT) {
        const instruction = String(block.instruction || "").trim();
        if (instruction) parts.push(instruction);
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.BANNER) {
        const headline = String(block.headline || "").trim();
        if (headline) parts.push(headline);
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.SPECS_CARD) {
        const specs = block.specs && typeof block.specs === "object" ? block.specs : {};
        const title = String(specs.name || specs.partNumber || "").trim();
        if (title) parts.push(title);
        continue;
      }
      if (block.type === NODE_BLOCK_TYPES.MOODBOARD) {
        const caption = String(block.caption || "").trim();
        const body = String(block.body || "").replace(/\s+/g, " ").trim();
        if (caption) parts.push(caption);
        if (body) parts.push(body);
        continue;
      }
      // Skip code, vaults, images, product cards for excerpt.
    }

    return parts.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/**
 * Truncate writing body for folder Description line.
 * Prefer the same body text the user sees in the macronode textarea
 * (TEXT / writing blocks); skip heading titles so Description ≠ Title.
 * @param {unknown} content
 * @param {number} [maxChars]
 * @returns {{ excerpt: string, hasMore: boolean }}
 */
export function getNodeWritingExcerpt(content, maxChars = NODE_WRITING_EXCERPT_MAX) {
  const limit = Number.isFinite(maxChars) && maxChars > 0
    ? Math.floor(maxChars)
    : NODE_WRITING_EXCERPT_MAX;
  const plain = getNodeWritingBodyPlainText(content);
  if (!plain) {
    return { excerpt: "", hasMore: false };
  }
  if (plain.length <= limit) {
    return { excerpt: plain, hasMore: false };
  }
  const cut = plain.slice(0, limit).replace(/\s+\S*$/, "").trim() || plain.slice(0, limit).trim();
  return { excerpt: cut, hasMore: true };
}

/**
 * Body-only plain text for Description (textarea / TEXT blocks).
 * Falls back to full writing text only when there is no TEXT body.
 */
export function getNodeWritingBodyPlainText(content) {
  try {
    if (typeof content === "string") {
      return content.replace(/\s+/g, " ").trim();
    }

    const { blocks } = parseNodeWritingBody(content);
    const textParts = [];
    for (const block of blocks) {
      if (!block || block.type !== NODE_BLOCK_TYPES.TEXT) continue;
      const text = String(block.text || "").replace(/\s+/g, " ").trim();
      if (text) textParts.push(text);
    }
    if (textParts.length) {
      return textParts.join(" ").replace(/\s+/g, " ").trim();
    }
    return getNodeWritingPlainText(content);
  } catch {
    return "";
  }
}
