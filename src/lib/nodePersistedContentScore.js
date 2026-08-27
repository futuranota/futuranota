import { isNodeWritingBody, parseNodeWritingBody } from "./nodeInlineContent.js";

/**
 * Character count for merge/hydrate — never use String(object) on node.content.
 * @param {unknown} content
 * @returns {number}
 */
export function nodePersistedContentCharCount(content) {
  if (content == null) return 0;
  if (typeof content === "string") return content.length;
  if (typeof content !== "object" || Array.isArray(content)) {
    return String(content).length;
  }

  if (isNodeWritingBody(content)) {
    const { blocks } = parseNodeWritingBody(content);
    let n = 0;
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      n += String(block.text || block.code || block.title || block.instruction || "").length;
      if (block.type === "todo" && Array.isArray(block.items)) {
        for (const item of block.items) {
          n += String(item?.text || "").length;
        }
      }
    }
    return n;
  }

  try {
    return JSON.stringify(content).length;
  } catch {
    return 0;
  }
}

/**
 * @param {object|null|undefined} node
 * @returns {number}
 */
export function nodeEntityPersistedContentCharCount(node) {
  if (!node || typeof node !== "object") return 0;
  return nodePersistedContentCharCount(node.content)
    + String(node.title || node.sourceQuery || "").length;
}

/**
 * True when a node carries user-authored payload (incl. node-body code blocks).
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function nodeHasPersistedContent(node) {
  return nodeEntityPersistedContentCharCount(node) > 0;
}

/**
 * Folder-linked child that missed a cloud upsert but should not vanish on hydrate.
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function isLinkedFolderChildNode(node) {
  if (!node || typeof node !== "object") return false;
  return Boolean(node.parentDocId) || Boolean(node.linkedToDoc);
}
