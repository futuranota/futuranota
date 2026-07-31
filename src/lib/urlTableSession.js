import { useUrlTableStore } from "../stores/urlTableStore.js";
import { useUrlTablesStore } from "../stores/urlTablesStore.js";
import { flushUrlTableSync } from "./urlTableSync.js";
import { flushUrlTablesSync } from "./urlTablesSync.js";
import { createLinkEntry, normalizeLinkEntries } from "./vaultBlocks.js";
import { generateId } from "./ids.js";
import { ensureDefaultUrlTable } from "./urlTableLibrary.js";

/** @type {((objectId: string, entry: import("./vaultBlocks.js").LinkEntry) => void)|null} */
let urlTableQueueCallback = null;

/**
 * @param {((objectId: string, entry: import("./vaultBlocks.js").LinkEntry) => void)|null} callback
 */
export function setUrlTableQueueCallback(callback) {
  urlTableQueueCallback = callback;
}

/**
 * @typedef {Object} UrlTableOpenRequest
 * @property {string|null} tableId
 * @property {string|null} objectId
 * @property {string} [searchQuery] - prefills the overlay search bar (live filter)
 */

/** @type {((request: UrlTableOpenRequest) => void)|null} */
let urlTableOpenCallback = null;

/** App registers this to open the URL table dashboard from deep components. */
export function setUrlTableOpenCallback(callback) {
  urlTableOpenCallback = callback;
}

/**
 * Open the URL table overlay (e.g. from a @mention hover card).
 * @param {UrlTableOpenRequest} request
 * @returns {boolean} whether a handler was registered
 */
export function requestUrlTableOpen(request) {
  if (typeof urlTableOpenCallback !== "function") return false;
  urlTableOpenCallback(request);
  return true;
}

/**
 * @typedef {Object} UrlTableSession
 * @property {string|null} objectId
 * @property {string|null} tableId
 * @property {string|null} docId
 * @property {string} blockId
 * @property {string} title
 * @property {'links'|'affiliates'} [kind]
 * @property {import("./vaultBlocks.js").LinkEntry[]} entries
 * @property {boolean} saved
 * @property {string} [initialSearch]
 */

/**
 * @param {string|null} objectId
 * @param {string|null} [tableId]
 * @param {{ kind?: 'links'|'affiliates' }} [options]
 * @returns {UrlTableSession}
 */
export function createBlankUrlTableSession(objectId = null, tableId = null, options = {}) {
  return {
    objectId,
    tableId,
    docId: null,
    blockId: generateId("BLK"),
    title: "",
    kind: options.kind === "affiliates" ? "affiliates" : "links",
    entries: [],
    saved: false,
  };
}

/**
 * @param {import("./urlTableLibrary.js").UrlTableRef} ref
 * @returns {UrlTableSession}
 */
export function urlTableSessionFromRef(ref) {
  return {
    objectId: ref.objectId ?? null,
    tableId: ref.tableId || ref.id || null,
    docId: null,
    blockId: generateId("BLK"),
    title: ref.title === "URL table" ? "" : (ref.title || ""),
    kind: ref.kind === "affiliates" ? "affiliates" : "links",
    entries: (ref.entries || []).map((entry) => createLinkEntry(entry)),
    saved: true,
  };
}

/** @param {Partial<UrlTableSession>|null|undefined} session */
export function urlTableSessionHasContent(session) {
  if (!session) return false;
  if (String(session.title ?? "").trim()) return true;
  return normalizeLinkEntries(session.entries || []).length > 0;
}

/**
 * Persist overlay session into stores (table meta + entries).
 * @param {UrlTableSession} session
 */
export function persistUrlTableSession(session) {
  const objectId = session?.objectId || null;
  let tableId = session?.tableId || null;
  if (!objectId) {
    return { objectId: null, tableId: null, entryCount: 0 };
  }

  const kind = session.kind === "affiliates" ? "affiliates" : "links";

  if (!tableId) {
    const created = useUrlTablesStore.getState().createTable({
      objectId,
      title: session.title || "",
      kind,
    });
    tableId = created.id;
  } else {
    useUrlTablesStore.getState().updateTable(tableId, {
      title: session.title || "",
      objectId,
      kind,
    });
  }

  const entries = normalizeLinkEntries(session.entries || []);
  const replaced = useUrlTableStore.getState().replaceEntriesForTable(tableId, objectId, entries);
  if (!replaced) {
    return { objectId: null, tableId, entryCount: 0 };
  }
  return { objectId, tableId, entryCount: entries.length };
}

/**
 * @param {UrlTableSession} session
 */
export async function persistUrlTableSessionAndFlush(session) {
  const result = persistUrlTableSession(session);
  if (result.objectId) {
    await Promise.all([flushUrlTablesSync(), flushUrlTableSync()]);
  }
  return result;
}

/**
 * Append one link entry to a company URL table (default table if unspecified).
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").LinkEntry} entry
 * @param {string|null} [tableId]
 */
export function appendEntryToCompanyUrlTable(objectId, entry, tableId = null) {
  if (!objectId || !entry) return null;
  const table = tableId
    ? useUrlTablesStore.getState().getTableById(tableId)
    : ensureDefaultUrlTable(objectId);
  if (!table) return null;
  return useUrlTableStore.getState().addEntry(table.id, objectId, entry);
}

/**
 * Queue a link entry into the company default URL table and flush.
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").LinkEntry} entry
 * @param {string|null} [tableId]
 */
export function queueUrlTableEntry(objectId, entry, tableId = null) {
  if (!objectId || !entry) return null;

  const result = appendEntryToCompanyUrlTable(objectId, entry, tableId);
  if (result) {
    urlTableQueueCallback?.(objectId, result);
    Promise.all([flushUrlTableSync(), flushUrlTablesSync()]).catch((err) => {
      console.warn("[url-table] flush after queue failed", err);
    });
  }
  return result;
}
