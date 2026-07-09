import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
  removeBlockAt,
} from "./docBlocks.js";
import { normalizeLinkEntries } from "./vaultBlocks.js";
import { resolveDocKind } from "./templateDoc.js";

const PREVIEW_MAX = 120;

/**
 * @typedef {Object} UrlTableRef
 * @property {string} id
 * @property {string} docId
 * @property {string} blockId
 * @property {string} title
 * @property {string} preview
 * @property {number} entryCount
 * @property {string|null} objectId
 * @property {string} docKind
 * @property {string} category
 * @property {import("./vaultBlocks.js").LinkEntry[]} entries
 */

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function urlTableTitleFrom(doc, entries) {
  const docTitle = String(doc.title ?? "").trim();
  if (docTitle) return docTitle;
  const first = entries.map((entry) => entry.name || entry.url).find(Boolean);
  return first ? truncate(first, 60) : "URL table";
}

function entryPreview(entries) {
  return entries
    .map((entry) => entry.name || entry.url)
    .filter(Boolean)
    .join(", ");
}

function blocksForDoc(doc) {
  if (Array.isArray(doc?.blocks) && doc.blocks.length) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc?.body || doc?.content || "");
}

/**
 * Collect saved link_vault tables from workspace docs.
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {{ objectId?: string|null }} [options]
 * @returns {UrlTableRef[]}
 */
export function collectSavedUrlTables(docs, { objectId = null } = {}) {
  /** @type {UrlTableRef[]} */
  const tables = [];

  for (const doc of Object.values(docs || {})) {
    if (!doc?.id) continue;

    const parentObjectId = doc.parentObjectId ?? null;
    if (objectId && parentObjectId !== objectId) {
      continue;
    }

    const blocks = blocksForDoc(doc);

    blocks.forEach((block) => {
      if (block.type !== DOC_BLOCK_TYPES.LINK_VAULT) return;

      const entries = normalizeLinkEntries(Array.isArray(block.entries) ? block.entries : []);
      if (!entries.length) return;

      tables.push({
        id: `${doc.id}:${block.id}`,
        docId: doc.id,
        blockId: block.id,
        title: urlTableTitleFrom(doc, entries),
        preview: truncate(entryPreview(entries), PREVIEW_MAX),
        entryCount: entries.length,
        objectId: parentObjectId,
        docKind: resolveDocKind(doc) || "standard",
        category: String(doc.category ?? "").trim(),
        entries,
      });
    });
  }

  return tables.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/**
 * @param {UrlTableRef[]} tables
 * @param {string} query
 * @returns {UrlTableRef[]}
 */
export function filterUrlTables(tables, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return tables;

  return tables.filter((table) => {
    if (table.title.toLowerCase().includes(normalized)) return true;
    if (table.preview.toLowerCase().includes(normalized)) return true;
    if (table.category.toLowerCase().includes(normalized)) return true;
    return table.entries.some((entry) => (
      String(entry.name ?? "").toLowerCase().includes(normalized)
      || String(entry.description ?? "").toLowerCase().includes(normalized)
      || String(entry.url ?? "").toLowerCase().includes(normalized)
    ));
  });
}

/**
 * Remove a saved URL table from its backing document.
 * @param {UrlTableRef} table
 * @param {import("../types/docs.js").Doc} doc
 * @param {(id: string, patch: object) => void} updateDoc
 * @param {(id: string) => void} deleteDoc
 * @returns {{ docRemoved: boolean }}
 */
export function removeUrlTableFromDoc(table, doc, updateDoc, deleteDoc) {
  if (!table?.docId || !doc?.id) return { docRemoved: false };

  const blocks = blocksForDoc(doc);
  const blockIndex = blocks.findIndex((block) => block.id === table.blockId);
  if (blockIndex < 0) return { docRemoved: false };

  const isDedicatedDoc = blocks.length === 1
    && blocks[0]?.type === DOC_BLOCK_TYPES.LINK_VAULT;

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
