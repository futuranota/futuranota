import {
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { normalizeLinkEntries } from "./vaultBlocks.js";
import { useUrlTableStore } from "../stores/urlTableStore.js";
import { generateId } from "./ids.js";

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
 * Collect URL tables for library UI — one virtual table per company from SQL store.
 * @param {Record<string, import("../types/docs.js").Doc>} [_docs] unused (kept for call-site compat)
 * @param {{ objectId?: string|null }} [options]
 * @returns {UrlTableRef[]}
 */
export function collectSavedUrlTables(_docs, { objectId = null } = {}) {
  /** @type {UrlTableRef[]} */
  const tables = [];
  const allEntries = useUrlTableStore.getState().entries;
  const byObject = new Map();

  for (const entry of allEntries) {
    if (!entry.objectId) continue;
    if (objectId && entry.objectId !== objectId) continue;
    if (!byObject.has(entry.objectId)) byObject.set(entry.objectId, []);
    byObject.get(entry.objectId).push(entry);
  }

  for (const [oid, stored] of byObject) {
    const entries = normalizeLinkEntries(stored);
    if (!entries.length) continue;
    tables.push({
      id: `url-table:${oid}`,
      docId: "",
      blockId: "",
      title: urlTableTitleFrom({ title: "URL table" }, entries),
      preview: truncate(entryPreview(entries), PREVIEW_MAX),
      entryCount: entries.length,
      objectId: oid,
      docKind: "standard",
      category: "",
      entries,
    });
  }

  return tables.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/**
 * @param {import("./vaultBlocks.js").LinkEntry[]} entries
 * @param {string} query
 * @returns {import("./vaultBlocks.js").LinkEntry[]}
 */
export function filterUrlTableEntries(entries, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return entries;

  return entries.filter((entry) => (
    String(entry.name ?? "").toLowerCase().includes(normalized)
    || String(entry.tag ?? "").toLowerCase().includes(normalized)
    || String(entry.category ?? "").toLowerCase().includes(normalized)
    || String(entry.description ?? "").toLowerCase().includes(normalized)
    || String(entry.url ?? "").toLowerCase().includes(normalized)
  ));
}

/**
 * Find the dedicated company URL table doc (toolbar overlay), not slash blocks
 * embedded in regular documents.
 * @param {string} objectId
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {string} defaultTitle
 * @returns {{ doc: import("../types/docs.js").Doc, block: object }|null}
 */
export function findDedicatedCompanyUrlTableDoc(objectId, docs, defaultTitle = "URL table") {
  if (!objectId) return null;

  for (const doc of Object.values(docs || {})) {
    if (doc?.parentObjectId !== objectId) continue;
    if (String(doc.title ?? "").trim() !== defaultTitle) continue;

    const blocks = blocksForDoc(doc);
    const vaultBlocks = blocks.filter((block) => block.type === DOC_BLOCK_TYPES.LINK_VAULT);
    if (vaultBlocks.length !== 1) continue;
    if (blocks.length > 1) continue;

    return { doc, block: vaultBlocks[0] };
  }

  return null;
}

/**
 * Load company URL table session from the SQL-backed store.
 * @param {string|null} objectId
 * @param {string} [defaultTitle]
 * @returns {import("./urlTableSession.js").UrlTableSession}
 */
export function loadCompanyUrlTableSession(objectId, defaultTitle = "URL table") {
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

  // Backward-compatible: old callers passed (objectId, docs, defaultTitle).
  if (defaultTitle && typeof defaultTitle === "object") {
    defaultTitle = arguments[2] || "URL table";
  }

  const stored = useUrlTableStore.getState().getEntriesForObject(objectId);
  const entries = normalizeLinkEntries(stored);

  return {
    objectId,
    docId: null,
    blockId: generateId("BLK"),
    title: typeof defaultTitle === "string" ? defaultTitle : "URL table",
    entries: entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      tag: entry.tag,
      category: entry.category,
      description: entry.description,
      url: entry.url,
    })),
    saved: entries.length > 0,
  };
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
      || String(entry.tag ?? "").toLowerCase().includes(normalized)
      || String(entry.category ?? "").toLowerCase().includes(normalized)
      || String(entry.description ?? "").toLowerCase().includes(normalized)
      || String(entry.url ?? "").toLowerCase().includes(normalized)
    ));
  });
}

/**
 * Clear all URL entries for a company from the SQL store.
 * @param {UrlTableRef} table
 * @returns {{ docRemoved: boolean }}
 */
export function removeUrlTableFromDoc(table) {
  const objectId = table?.objectId;
  if (!objectId) return { docRemoved: false };
  useUrlTableStore.getState().replaceEntriesForObject(objectId, []);
  return { docRemoved: true };
}
