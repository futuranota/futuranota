import {
  createDocBlock,
  createQLoopEntry,
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  docBlocksToBody,
  getQLoopPreview,
  normalizeDocBlocks,
  normalizeQLoopQueries,
  qloopEntryHasContent,
  removeBlockAt,
} from "./docBlocks.js";
import { isDedicatedQLoopDoc, resolveDocKind } from "./templateDoc.js";

const PREVIEW_MAX = 120;

/**
 * @typedef {Object} QLoopRef
 * @property {string} id
 * @property {string} docId
 * @property {string} blockId
 * @property {string} title
 * @property {string} preview
 * @property {number} queryCount
 * @property {string|null} objectId
 * @property {string} docKind
 * @property {string} category
 * @property {import("./docBlocks.js").QLoopEntry[]} queries
 */

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function loopTitleFrom(block, doc, queries) {
  const blockTitle = String(block?.title ?? "").trim();
  if (blockTitle) return blockTitle;
  const docTitle = String(doc.title ?? "").trim();
  if (docTitle) return docTitle;
  const first = queries.map(getQLoopPreview).find(Boolean);
  return first ? truncate(first, 60) : "QLoops";
}

function qloopHasContent(queries) {
  return queries.some(qloopEntryHasContent);
}

function blocksForDoc(doc) {
  if (Array.isArray(doc?.blocks) && doc.blocks.length) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc?.body || doc?.content || "");
}

/**
 * @returns {import("./docBlocks.js").DocBlock[]}
 */
export function createNewQLoopBlocks() {
  return [
    createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
      title: "",
      queries: [createQLoopEntry({ index: 1 })],
      saved: false,
    }),
  ];
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {{ objectId?: string|null }} [options]
 * @returns {QLoopRef[]}
 */
export function collectSavedQLoops(docs, { objectId = null } = {}) {
  /** @type {QLoopRef[]} */
  const loops = [];

  for (const doc of Object.values(docs || {})) {
    if (!doc?.id) continue;

    const parentObjectId = doc.parentObjectId ?? null;
    if (objectId && parentObjectId !== objectId) {
      continue;
    }

    const blocks = blocksForDoc(doc);

    blocks.forEach((block) => {
      if (block.type !== DOC_BLOCK_TYPES.QLOOP_SEQUENCE) return;
      if (!block.saved) return;

      const queries = normalizeQLoopQueries(Array.isArray(block.queries) ? block.queries : []);
      const title = loopTitleFrom(block, doc, queries);
      const hasQueries = qloopHasContent(queries);
      const hasTitle = Boolean(String(block?.title ?? "").trim() || String(doc.title ?? "").trim());
      if (!hasQueries && !hasTitle) return;

      const firstPreview = queries.map(getQLoopPreview).find(Boolean) ?? "";

      loops.push({
        id: `${doc.id}:${block.id}`,
        docId: doc.id,
        blockId: block.id,
        title,
        preview: truncate(firstPreview, PREVIEW_MAX),
        queryCount: queries.length,
        objectId: parentObjectId,
        docKind: resolveDocKind(doc) || "standard",
        category: String(doc.category ?? "").trim(),
        queries,
      });
    });
  }

  return loops.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/**
 * @param {QLoopRef[]} loops
 * @param {string} query
 * @returns {QLoopRef[]}
 */
export function filterQLoops(loops, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return loops;

  return loops.filter((loop) => {
    if (loop.title.toLowerCase().includes(normalized)) return true;
    if (loop.preview.toLowerCase().includes(normalized)) return true;
    if (loop.category.toLowerCase().includes(normalized)) return true;
    return loop.queries.some((entry) => {
      if (getQLoopPreview(entry).toLowerCase().includes(normalized)) return true;
      return String(entry.description ?? "").toLowerCase().includes(normalized);
    });
  });
}

/**
 * @param {QLoopRef} loop
 * @param {import("../types/docs.js").Doc} doc
 * @param {(id: string, patch: object) => void} updateDoc
 * @param {(id: string) => void} deleteDoc
 * @returns {{ docRemoved: boolean }}
 */
export function removeQLoopFromDoc(loop, doc, updateDoc, deleteDoc) {
  if (!loop?.docId || !doc?.id) return { docRemoved: false };

  const blocks = blocksForDoc(doc);
  const blockIndex = blocks.findIndex((block) => block.id === loop.blockId);
  if (blockIndex < 0) return { docRemoved: false };

  const isDedicatedDoc = isDedicatedQLoopDoc(doc);

  if (isDedicatedDoc) {
    deleteDoc(doc.id);
    return { docRemoved: true };
  }

  let nextBlocks = removeBlockAt(blocks, blockIndex);
  if (!nextBlocks.length) {
    nextBlocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
  }

  updateDoc(doc.id, {
    blocks: nextBlocks,
    body: docBlocksToBody(nextBlocks),
    content: docBlocksToBody(nextBlocks),
  });

  return { docRemoved: false };
}

/**
 * @param {QLoopRef[]} loops
 * @param {string} docId
 * @param {string} blockId
 * @returns {Set<number>}
 */
export function collectUsedQLoopIndexesInDocBlocks(blocks, loopId) {
  const normalizedLoopId = String(loopId ?? "").trim();
  if (!normalizedLoopId) return new Set();

  const used = new Set();
  for (const block of normalizeDocBlocks(blocks || [])) {
    if (block.type !== DOC_BLOCK_TYPES.H1 || !block.qloopSource) continue;
    if (String(block.qloopSource.loopId ?? "").trim() !== normalizedLoopId) continue;
    const index = Number(block.qloopSource.index);
    if (Number.isFinite(index) && index > 0) {
      used.add(Math.floor(index));
    }
  }
  return used;
}

/**
 * @param {QLoopRef} loop
 * @param {import("./docBlocks.js").DocBlock[]} blocks
 * @returns {number|null}
 */
export function suggestNextQLoopIndex(loop, blocks) {
  if (!loop?.id) return null;
  const used = collectUsedQLoopIndexesInDocBlocks(blocks, loop.id);
  for (const entry of loop.queries || []) {
    const index = Number(entry.index);
    if (!Number.isFinite(index) || index <= 0) continue;
    if (!used.has(Math.floor(index))) return Math.floor(index);
  }
  return null;
}
