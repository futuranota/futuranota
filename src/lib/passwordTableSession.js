import { usePasswordTableStore } from "../stores/passwordTableStore.js";
import { flushPasswordTableSync } from "./passwordTableSync.js";
import { normalizePasswordEntries } from "./vaultBlocks.js";
import { generateId } from "./ids.js";

/** @type {((objectId: string, entry: import("./vaultBlocks.js").PasswordEntry) => void)|null} */
let passwordTableQueueCallback = null;

/**
 * @param {((objectId: string, entry: import("./vaultBlocks.js").PasswordEntry) => void)|null} callback
 */
export function setPasswordTableQueueCallback(callback) {
  passwordTableQueueCallback = callback;
}

/**
 * @typedef {Object} PasswordTableSession
 * @property {string|null} objectId
 * @property {string|null} docId
 * @property {string} blockId
 * @property {string} title
 * @property {import("./vaultBlocks.js").PasswordEntry[]} entries
 * @property {boolean} saved
 */

/**
 * @param {string|null} objectId
 * @returns {PasswordTableSession}
 */
export function createBlankPasswordTableSession(objectId = null) {
  return {
    objectId,
    docId: null,
    blockId: generateId("BLK"),
    title: "",
    entries: [],
    saved: false,
  };
}

/** @param {Partial<PasswordTableSession>|null|undefined} session */
export function passwordTableSessionHasContent(session) {
  if (!session) return false;
  if (String(session.title ?? "").trim()) return true;
  return normalizePasswordEntries(session.entries || []).length > 0;
}

/**
 * Persist overlay session into the SQL-backed password table store.
 * @param {PasswordTableSession} session
 * @returns {{ objectId: string|null, entryCount: number }}
 */
export function persistPasswordTableSession(session) {
  const objectId = session?.objectId || null;
  if (!objectId) {
    return { objectId: null, entryCount: 0 };
  }

  const entries = normalizePasswordEntries(session.entries || []);
  usePasswordTableStore.getState().replaceEntriesForObject(objectId, entries);
  return { objectId, entryCount: entries.length };
}

/**
 * Persist overlay session and flush to Supabase immediately.
 * @param {PasswordTableSession} session
 */
export async function persistPasswordTableSessionAndFlush(session) {
  const result = persistPasswordTableSession(session);
  if (result.objectId) {
    await flushPasswordTableSync();
  }
  return result;
}

/**
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").PasswordEntry} entry
 */
export function appendEntryToCompanyPasswordTable(objectId, entry) {
  if (!objectId || !entry) return null;
  return usePasswordTableStore.getState().addEntry(objectId, entry);
}

/**
 * Queue a password entry into the company table (SQL store) and flush to Supabase.
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").PasswordEntry} entry
 */
export function queuePasswordTableEntry(objectId, entry) {
  if (!objectId || !entry) return null;

  const result = appendEntryToCompanyPasswordTable(objectId, entry);
  if (result) {
    passwordTableQueueCallback?.(objectId, result);
    flushPasswordTableSync().catch((err) => {
      console.warn("[password-table] flush after queue failed", err);
    });
  }
  return result;
}
