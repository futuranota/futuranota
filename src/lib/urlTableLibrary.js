import { normalizeLinkEntries } from "./vaultBlocks.js";
import { useUrlTableStore } from "../stores/urlTableStore.js";
import { useUrlTablesStore } from "../stores/urlTablesStore.js";
import { generateId } from "./ids.js";
import { createLinkEntry } from "./vaultBlocks.js";
import {
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  normalizeDocBlocks,
} from "./docBlocks.js";

const PREVIEW_MAX = 120;

/**
 * @typedef {Object} UrlTableRef
 * @property {string} id
 * @property {string} tableId
 * @property {string} title
 * @property {string} preview
 * @property {number} entryCount
 * @property {string|null} objectId
 * @property {'links'|'affiliates'} [kind]
 * @property {import("./vaultBlocks.js").LinkEntry[]} entries
 */

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function entryPreview(entries) {
  return entries
    .map((entry) => entry.name || entry.url)
    .filter(Boolean)
    .join(", ");
}

function displayTitle(table) {
  const title = String(table?.title ?? "").trim();
  return title || "URL table";
}

function blocksForDoc(doc) {
  if (Array.isArray(doc?.blocks) && doc.blocks.length) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc?.body || doc?.content || "");
}

/**
 * Find the dedicated company URL table doc (legacy campaign docs).
 * @param {string} objectId
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {string} defaultTitle
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
 * Ensure orphan local entries (no tableId) get a default table per objectId.
 */
export function migrateLocalUrlEntriesToTables() {
  const entryStore = useUrlTableStore.getState();
  const tableStore = useUrlTablesStore.getState();
  const orphans = entryStore.entries.filter((entry) => !entry.tableId);
  if (!orphans.length) return;

  const groups = new Map();
  for (const entry of orphans) {
    const key = entry.objectId || "__none__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const nextEntries = entryStore.entries.map((entry) => ({ ...entry }));
  for (const [key, group] of groups) {
    const objectId = key === "__none__" ? null : key;
    let table = objectId
      ? tableStore.getTablesForObject(objectId)[0]
      : null;
    if (!table) {
      table = tableStore.createTable({
        objectId,
        title: "URL table",
      });
    }
    for (const orphan of group) {
      const idx = nextEntries.findIndex((item) => item.id === orphan.id);
      if (idx >= 0) {
        nextEntries[idx] = {
          ...nextEntries[idx],
          tableId: table.id,
          objectId: objectId ?? nextEntries[idx].objectId,
        };
      }
    }
  }
  entryStore.replaceEntries(nextEntries);
}

/**
 * Ensure the company has at least one URL table; return it (prefer first by updatedAt).
 * @param {string} objectId
 * @param {string} [defaultTitle]
 */
export function ensureDefaultUrlTable(objectId, defaultTitle = "URL table") {
  if (!objectId) return null;
  migrateLocalUrlEntriesToTables();
  const existing = useUrlTablesStore.getState().getTablesForObject(objectId);
  if (existing.length) return existing[0];
  return useUrlTablesStore.getState().createTable({
    objectId,
    title: defaultTitle,
  });
}

/**
 * @param {Record<string, unknown>} [_docs]
 * @param {{ objectId?: string|null }} [options]
 * @returns {UrlTableRef[]}
 */
export function collectSavedUrlTables(_docs, { objectId = null } = {}) {
  migrateLocalUrlEntriesToTables();
  const tables = useUrlTablesStore.getState().tables
    .filter((table) => (objectId ? table.objectId === objectId : true));

  return tables
    .map((table) => {
      const stored = useUrlTableStore.getState().getEntriesForTable(table.id);
      const entries = normalizeLinkEntries(stored);
      return {
        id: table.id,
        tableId: table.id,
        title: displayTitle(table),
        preview: truncate(entryPreview(entries), PREVIEW_MAX),
        entryCount: entries.length,
        objectId: table.objectId ?? null,
        kind: table.kind === "affiliates" ? "affiliates" : "links",
        entries,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/**
 * @param {import("./vaultBlocks.js").LinkEntry[]} entries
 * @param {string} query
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
 * @param {string|null} objectId
 * @param {string} [defaultTitle]
 * @returns {import("./urlTableSession.js").UrlTableSession}
 */
export function loadCompanyUrlTableSession(objectId, defaultTitle = "URL table") {
  if (!objectId) {
    return {
      objectId: null,
      tableId: null,
      docId: null,
      blockId: "",
      title: defaultTitle,
      entries: [],
      saved: false,
    };
  }

  if (defaultTitle && typeof defaultTitle === "object") {
    defaultTitle = arguments[2] || "URL table";
  }

  const table = ensureDefaultUrlTable(objectId, typeof defaultTitle === "string" ? defaultTitle : "URL table");
  return loadUrlTableSessionById(table.id);
}

/**
 * @param {string} tableId
 * @returns {import("./urlTableSession.js").UrlTableSession}
 */
export function loadUrlTableSessionById(tableId) {
  const table = useUrlTablesStore.getState().getTableById(tableId);
  if (!table) {
    return {
      objectId: null,
      tableId: null,
      docId: null,
      blockId: "",
      title: "",
      kind: "links",
      entries: [],
      saved: false,
    };
  }

  const stored = useUrlTableStore.getState().getEntriesForTable(tableId);
  const entries = normalizeLinkEntries(stored);

  return {
    objectId: table.objectId ?? null,
    tableId: table.id,
    docId: null,
    blockId: generateId("BLK"),
    title: table.title || "",
    kind: table.kind === "affiliates" ? "affiliates" : "links",
    entries: entries.map((entry) => createLinkEntry(entry)),
    saved: true,
  };
}

/**
 * @param {string|null} objectId
 * @param {string} [defaultTitle]
 */
/**
 * @param {string} objectId
 * @param {string} [defaultTitle]
 * @param {{ kind?: 'links'|'affiliates' }} [options]
 */
export function createBlankUrlTableForObject(objectId, defaultTitle = "", options = {}) {
  if (!objectId) return null;
  const kind = options.kind === "affiliates" ? "affiliates" : "links";
  const table = useUrlTablesStore.getState().createTable({
    objectId,
    title: defaultTitle,
    kind,
  });
  return loadUrlTableSessionById(table.id);
}

/**
 * Duplicate a table meta + entries.
 * @param {UrlTableRef|string} tableOrId
 */
export function duplicateUrlTable(tableOrId) {
  const tableId = typeof tableOrId === "string" ? tableOrId : tableOrId?.tableId || tableOrId?.id;
  const source = useUrlTablesStore.getState().getTableById(tableId);
  if (!source?.objectId) return null;

  const sourceEntries = useUrlTableStore.getState().getEntriesForTable(source.id);
  const titleBase = displayTitle(source);
  const copy = useUrlTablesStore.getState().createTable({
    objectId: source.objectId,
    title: `Copy of ${titleBase}`,
    kind: source.kind === "affiliates" ? "affiliates" : "links",
  });

  const cloned = normalizeLinkEntries(sourceEntries).map((entry) => createLinkEntry({
    ...entry,
    id: generateId("LNK"),
  }));
  useUrlTableStore.getState().replaceEntriesForTable(copy.id, source.objectId, cloned);

  Promise.all([
    import("./urlTableSync.js").then((m) => m.flushUrlTableSync()),
    import("./urlTablesSync.js").then((m) => m.flushUrlTablesSync()),
  ]).catch((err) => {
    console.warn("[url-table] flush after duplicate failed", err);
  });

  return loadUrlTableSessionById(copy.id);
}

/**
 * @param {UrlTableRef[]} tables
 * @param {string} query
 */
export function filterUrlTables(tables, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return tables;

  return tables.filter((table) => {
    if (table.title.toLowerCase().includes(normalized)) return true;
    if (table.preview.toLowerCase().includes(normalized)) return true;
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
 * @param {UrlTableRef} table
 */
export function removeUrlTableFromDoc(table) {
  const tableId = table?.tableId || table?.id;
  if (!tableId) return { docRemoved: false };
  useUrlTableStore.getState().removeEntriesForTable(tableId);
  useUrlTablesStore.getState().removeTable(tableId);
  return { docRemoved: true };
}
