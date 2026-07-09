import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
  removeBlockAt,
} from "./docBlocks.js";
import { normalizePasswordEntries } from "./vaultBlocks.js";
import { createBlankPasswordTableSession } from "./passwordTableSession.js";
import { resolveDocKind } from "./templateDoc.js";

const PREVIEW_MAX = 120;

/**
 * @typedef {Object} PasswordTableRef
 * @property {string} id
 * @property {string} docId
 * @property {string} blockId
 * @property {string} title
 * @property {string} preview
 * @property {number} entryCount
 * @property {string|null} objectId
 * @property {string} docKind
 * @property {string} category
 * @property {import("./vaultBlocks.js").PasswordEntry[]} entries
 */

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function passwordTableTitleFrom(doc, entries) {
  const docTitle = String(doc.title ?? "").trim();
  if (docTitle) return docTitle;
  const first = entries.map((entry) => entry.description).find(Boolean);
  return first ? truncate(first, 60) : "Password table";
}

function entryPreview(entries) {
  return entries
    .map((entry) => entry.description)
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
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {{ objectId?: string|null }} [options]
 * @returns {PasswordTableRef[]}
 */
export function collectSavedPasswordTables(docs, { objectId = null } = {}) {
  /** @type {PasswordTableRef[]} */
  const tables = [];

  for (const doc of Object.values(docs || {})) {
    if (!doc?.id) continue;

    const parentObjectId = doc.parentObjectId ?? null;
    if (objectId && parentObjectId !== objectId) {
      continue;
    }

    const blocks = blocksForDoc(doc);

    blocks.forEach((block) => {
      if (block.type !== DOC_BLOCK_TYPES.PASSWORD_VAULT) return;

      const entries = normalizePasswordEntries(Array.isArray(block.entries) ? block.entries : []);
      if (!entries.length) return;

      tables.push({
        id: `${doc.id}:${block.id}`,
        docId: doc.id,
        blockId: block.id,
        title: passwordTableTitleFrom(doc, entries),
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
 * @param {import("./vaultBlocks.js").PasswordEntry[]} entries
 * @param {string} query
 */
export function filterPasswordTableEntries(entries, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return entries;

  return entries.filter((entry) => (
    String(entry.description ?? "").toLowerCase().includes(normalized)
    || String(entry.tag ?? "").toLowerCase().includes(normalized)
  ));
}

/**
 * @param {string|null} objectId
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {string} [defaultTitle]
 */
export function loadCompanyPasswordTableSession(objectId, docs, defaultTitle = "Password table") {
  if (!objectId) {
    return {
      objectId: null,
      docId: null,
      blockId: "",
      title: defaultTitle,
      entries: [],
      saved: false,
    };
  }

  const tables = collectSavedPasswordTables(docs, { objectId });
  if (!tables.length) {
    return { ...createBlankPasswordTableSession(objectId), title: defaultTitle };
  }

  const canonical = tables.find((table) => table.title === defaultTitle) || tables[0];
  const mergedEntries = [];
  const seen = new Set();

  for (const table of tables) {
    for (const entry of table.entries) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      mergedEntries.push({ ...entry });
    }
  }

  return {
    objectId,
    docId: canonical.docId,
    blockId: canonical.blockId,
    title: defaultTitle,
    entries: mergedEntries,
    saved: true,
  };
}

/**
 * @param {PasswordTableRef} table
 * @param {import("../types/docs.js").Doc} doc
 * @param {(id: string, patch: object) => void} updateDoc
 * @param {(id: string) => void} deleteDoc
 */
export function removePasswordTableFromDoc(table, doc, updateDoc, deleteDoc) {
  if (!table?.docId || !doc?.id) return { docRemoved: false };

  const blocks = blocksForDoc(doc);
  const blockIndex = blocks.findIndex((block) => block.id === table.blockId);
  if (blockIndex < 0) return { docRemoved: false };

  const isDedicatedDoc = blocks.length === 1
    && blocks[0]?.type === DOC_BLOCK_TYPES.PASSWORD_VAULT;

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
