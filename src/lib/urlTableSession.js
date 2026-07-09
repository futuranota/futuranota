import { useUrlTableStore } from "../stores/urlTableStore.js";
import { flushUrlTableSync } from "./urlTableSync.js";
import { normalizeLinkEntries } from "./vaultBlocks.js";
import { generateId } from "./ids.js";

/** @type {((objectId: string, entry: import("./vaultBlocks.js").LinkEntry) => void)|null} */
let urlTableQueueCallback = null;

/**
 * @param {((objectId: string, entry: import("./vaultBlocks.js").LinkEntry) => void)|null} callback
 */
export function setUrlTableQueueCallback(callback) {
  urlTableQueueCallback = callback;
}

/**
 * @typedef {Object} UrlTableSession
 * @property {string|null} objectId
 * @property {string|null} docId
 * @property {string} blockId
 * @property {string} title
 * @property {import("./vaultBlocks.js").LinkEntry[]} entries
 * @property {boolean} saved
 */

/**
 * @param {string|null} objectId
 * @returns {UrlTableSession}
 */
export function createBlankUrlTableSession(objectId = null) {
  return {
    objectId,
    docId: null,
    blockId: generateId("BLK"),
    title: "",
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
    docId: ref.docId ?? null,
    blockId: ref.blockId || generateId("BLK"),
    title: ref.title === "URL table" ? "" : (ref.title || ""),
    entries: (ref.entries || []).map((entry) => ({ ...entry })),
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
 * Persist overlay session into the SQL-backed url table store.
 * @param {UrlTableSession} session
 * @returns {{ objectId: string|null, entryCount: number }}
 */
export function persistUrlTableSession(session) {
  const objectId = session?.objectId || null;
  if (!objectId) {
    return { objectId: null, entryCount: 0 };
  }

  const entries = normalizeLinkEntries(session.entries || []);
  useUrlTableStore.getState().replaceEntriesForObject(objectId, entries);
  return { objectId, entryCount: entries.length };
}

/**
 * Persist overlay session and flush to Supabase immediately.
 * @param {UrlTableSession} session
 */
export async function persistUrlTableSessionAndFlush(session) {
  const result = persistUrlTableSession(session);
  if (result.objectId) {
    await flushUrlTableSync();
  }
  return result;
}

/**
 * Append one link entry to the company URL table (SQL store).
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").LinkEntry} entry
 * @returns {import("../stores/urlTableStore.js").UrlTableStoredEntry|null}
 */
export function appendEntryToCompanyUrlTable(objectId, entry) {
  if (!objectId || !entry) return null;
  return useUrlTableStore.getState().addEntry(objectId, entry);
}

/**
 * Queue a link entry into the company URL table (SQL store) and flush to Supabase.
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").LinkEntry} entry
 */
export function queueUrlTableEntry(objectId, entry) {
  if (!objectId || !entry) return null;

  const result = appendEntryToCompanyUrlTable(objectId, entry);
  if (result) {
    urlTableQueueCallback?.(objectId, result);
    flushUrlTableSync().catch((err) => {
      console.warn("[url-table] flush after queue failed", err);
    });
  }
  return result;
}
