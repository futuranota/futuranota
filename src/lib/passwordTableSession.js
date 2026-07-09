import { useDocsStore } from "../stores/docsStore.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { loadCompanyPasswordTableSession } from "./passwordTableLibrary.js";
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
 * @param {PasswordTableSession} session
 * @param {Object} deps
 */
export function persistPasswordTableSession(session, {
  addDoc,
  updateDoc,
  docs,
  objects,
  defaultTitle,
}) {
  const block = createDocBlock(DOC_BLOCK_TYPES.PASSWORD_VAULT, {
    id: session.blockId,
    entries: session.entries,
  });

  const docTitle = defaultTitle;

  if (!session.docId) {
    if (!session.objectId) {
      return { docId: null, blockId: block.id };
    }

    for (const doc of Object.values(docs || {})) {
      if (doc.parentObjectId !== session.objectId) continue;
      const existingBlocks = normalizeDocBlocks(doc.blocks || []);
      const existingIndex = existingBlocks.findIndex((entry) => entry.id === session.blockId);
      if (existingIndex < 0) continue;

      const nextBlocks = existingBlocks.map((entry, index) => (
        index === existingIndex ? block : entry
      ));
      updateDoc(doc.id, {
        title: docTitle,
        blocks: nextBlocks,
        body: docBlocksToBody(nextBlocks),
        content: docBlocksToBody(nextBlocks),
      });
      return { docId: doc.id, blockId: block.id };
    }

    const parentObject = objects[session.objectId];
    const tags = parentObject?.name ? [parentObject.name] : [];
    const newDocId = addDoc(
      docTitle,
      session.objectId,
      [],
      tags,
      docBlocksToBody([block]),
      null,
      [block],
      {
        docKind: "standard",
        nodeLinkColor: "dark",
      },
    );

    return { docId: newDocId, blockId: block.id };
  }

  const doc = docs[session.docId];
  if (!doc) {
    return { docId: session.docId, blockId: block.id };
  }

  const existingBlocks = normalizeDocBlocks(doc.blocks || []);
  const blockIndex = existingBlocks.findIndex((entry) => entry.id === session.blockId);
  const nextBlocks = blockIndex >= 0
    ? existingBlocks.map((entry, index) => (index === blockIndex ? block : entry))
    : [...existingBlocks, block];

  updateDoc(session.docId, {
    title: docTitle,
    blocks: nextBlocks,
    body: docBlocksToBody(nextBlocks),
    content: docBlocksToBody(nextBlocks),
  });

  return { docId: session.docId, blockId: block.id };
}

/**
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").PasswordEntry} entry
 * @param {Object} deps
 */
export function appendEntryToCompanyPasswordTable(objectId, entry, {
  addDoc,
  updateDoc,
  docs,
  objects,
  defaultTitle,
}) {
  if (!objectId || !entry) return null;

  const session = loadCompanyPasswordTableSession(objectId, docs, defaultTitle);
  const merged = {
    ...session,
    entries: [...session.entries, entry],
    saved: true,
  };

  return persistPasswordTableSession(merged, {
    addDoc,
    updateDoc,
    docs,
    objects,
    defaultTitle,
  });
}

/**
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").PasswordEntry} entry
 * @param {{ defaultTitle?: string }} [options]
 */
export function queuePasswordTableEntry(objectId, entry, { defaultTitle = "Password table" } = {}) {
  if (!objectId || !entry) return null;

  const { addDoc, updateDoc, docs } = useDocsStore.getState();
  const { objects } = useObjectsStore.getState();

  const result = appendEntryToCompanyPasswordTable(objectId, entry, {
    addDoc,
    updateDoc,
    docs,
    objects,
    defaultTitle,
  });

  passwordTableQueueCallback?.(objectId, entry);
  return result;
}
