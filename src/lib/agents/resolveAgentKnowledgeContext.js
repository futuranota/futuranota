import { docBlocksToBody, normalizeDocBlocks } from "../docBlocks.js";
import { isKnowledgeDoc, resolveKnowledgeDocDisplayTitle } from "../templateDoc.js";

const DEFAULT_MAX_CHARS = 8000;

/**
 * @param {object | null | undefined} node
 * @param {Record<string, object>} docsById
 */
function resolveDocFromCanvasNode(node, docsById = {}) {
  if (!node) return null;
  const docId = node.docId || node.noteId;
  if (!docId) return null;
  return docsById[docId] || null;
}

/**
 * Extract text body from a knowledge document.
 * @param {object} doc
 * @returns {string}
 */
export function extractKnowledgeDocBody(doc) {
  if (!doc) return "";
  if (Array.isArray(doc.blocks) && doc.blocks.length > 0) {
    return docBlocksToBody(normalizeDocBlocks(doc.blocks)).trim();
  }
  return String(doc.body || doc.content || "").trim();
}

/**
 * Build concatenated knowledge corpus from wired canvas input nodes.
 * @param {object[]} inputNodes
 * @param {Record<string, object>} docsById
 * @param {number} [maxChars]
 * @returns {string}
 */
export function resolveAgentKnowledgeContext(inputNodes = [], docsById = {}, maxChars = DEFAULT_MAX_CHARS) {
  const sections = [];

  for (const node of inputNodes) {
    const doc = resolveDocFromCanvasNode(node, docsById);
    if (!doc || !isKnowledgeDoc(doc)) continue;

    const body = extractKnowledgeDocBody(doc);
    if (!body) continue;

    const title = resolveKnowledgeDocDisplayTitle(doc) || doc.title || "Knowledge";
    sections.push(`## ${title}\n${body}`);
  }

  if (sections.length === 0) return "";

  let combined = sections.join("\n\n");
  if (combined.length > maxChars) {
    combined = `${combined.slice(0, maxChars)}\n…`;
  }
  return combined;
}
