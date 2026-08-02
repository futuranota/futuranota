import { getNodeWritingPlainText } from "../nodeWritingExcerpt.js";
import { docBlocksToBody } from "../docBlocks.js";

/**
 * Resolve a skill/document learn brief from canvas selection or named doc.
 *
 * @param {{
 *   selectedCanvasNodeIds?: string[],
 *   canvasNodes?: Record<string, { id?: string, nodeId?: string, docId?: string }>,
 *   nodes?: Record<string, { id?: string, query?: string, title?: string, content?: unknown, parentDocId?: string }>,
 *   docs?: Record<string, { id?: string, title?: string, name?: string, body?: string, content?: string, blocks?: unknown[] }>,
 *   preferDocId?: string | null,
 * }} opts
 * @returns {{ title: string, body: string, documentId: string | null } | null}
 */
export function resolveGinaLearnBrief(opts = {}) {
  const docs = opts.docs || {};
  const nodes = opts.nodes || {};
  const canvasNodes = opts.canvasNodes || {};
  const selected = Array.isArray(opts.selectedCanvasNodeIds) ? opts.selectedCanvasNodeIds : [];

  if (opts.preferDocId && docs[opts.preferDocId]) {
    const brief = briefFromDoc(docs[opts.preferDocId]);
    if (brief?.body) return brief;
  }

  for (const canvasId of selected) {
    const cn = canvasNodes[canvasId];
    if (!cn) continue;

    if (cn.docId && docs[cn.docId]) {
      const brief = briefFromDoc(docs[cn.docId]);
      if (brief?.body) return brief;
    }

    const node = cn.nodeId ? nodes[cn.nodeId] : null;
    if (node) {
      const fromNode = briefFromNode(node);
      if (fromNode?.body) return fromNode;
      if (node.parentDocId && docs[node.parentDocId]) {
        const brief = briefFromDoc(docs[node.parentDocId]);
        if (brief?.body) return brief;
      }
    }
  }

  // Single selected-looking doc among open canvas: first node with rich text
  for (const cn of Object.values(canvasNodes)) {
    if (!selected.length) break;
    // already scanned selected above
  }

  return null;
}

/**
 * Match "aprende … [title]" to a document by title (case-insensitive).
 * @param {string} userText
 * @param {Record<string, { id?: string, title?: string, name?: string, body?: string, content?: string, blocks?: unknown[] }>} docs
 */
export function resolveGinaLearnBriefByTitle(userText, docs = {}) {
  const text = String(userText || "").trim();
  if (!text) return null;
  const learn = /(?:aprende|learn|enseña|ensena)\s+(?:esto|this|el|la|del?|from)?\s*/i.exec(text);
  if (!learn) return null;

  const remainder = text.slice(learn.index + learn[0].length).trim();
  // If message is only "aprende esto" with no title, caller uses canvas brief
  if (!remainder || /^(esto|this|eso|that)\.?$/i.test(remainder)) return null;

  const needle = remainder.replace(/^["“]|["”]$/g, "").trim().toLowerCase();
  if (needle.length < 2) return null;

  for (const doc of Object.values(docs)) {
    const title = String(doc?.title || doc?.name || "").trim();
    if (!title) continue;
    if (title.toLowerCase() === needle || title.toLowerCase().includes(needle) || needle.includes(title.toLowerCase())) {
      const brief = briefFromDoc(doc);
      if (brief?.body) return brief;
    }
  }
  return null;
}

/**
 * @param {{ id?: string, title?: string, name?: string, body?: string, content?: string, blocks?: unknown[] }} doc
 */
function briefFromDoc(doc) {
  if (!doc) return null;
  const title = String(doc.title || doc.name || "Document").trim() || "Document";
  let body = "";
  if (Array.isArray(doc.blocks) && doc.blocks.length) {
    try {
      body = String(docBlocksToBody(doc.blocks) || "").trim();
    } catch {
      body = "";
    }
  }
  if (!body) body = String(doc.body || doc.content || "").trim();
  if (!body) return null;
  return { title, body: body.slice(0, 12000), documentId: doc.id || null };
}

/**
 * @param {{ id?: string, query?: string, title?: string, content?: unknown }} node
 */
function briefFromNode(node) {
  if (!node) return null;
  const title = String(node.query || node.title || "Skill").trim() || "Skill";
  const body = getNodeWritingPlainText(node.content);
  if (!body) return null;
  return { title, body: body.slice(0, 12000), documentId: node.id || null };
}
