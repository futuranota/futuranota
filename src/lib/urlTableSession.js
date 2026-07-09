import { useDocsStore } from "../stores/docsStore.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import {
  createDocBlock,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  normalizeDocBlocks,
} from "./docBlocks.js";
import { loadCompanyUrlTableSession } from "./urlTableLibrary.js";
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
    docId: ref.docId,
    blockId: ref.blockId,
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
 * @param {UrlTableSession} session
 * @param {Object} deps
 * @param {(title: string, parentObjectId: string|null, dataProperties: unknown[], tags: string[], initialContent: string, createdAt: string|null, initialBlocks: unknown[]|null, campaignMeta: object) => string|null} deps.addDoc
 * @param {(id: string, patch: object) => void} deps.updateDoc
 * @param {Record<string, import("../types/docs.js").Doc>} deps.docs
 * @param {Record<string, { name?: string }>} deps.objects
 * @param {string} deps.defaultTitle
 * @returns {{ docId: string|null, blockId: string }}
 */
export function persistUrlTableSession(session, {
  addDoc,
  updateDoc,
  docs,
  objects,
  defaultTitle,
}) {
  const block = createDocBlock(DOC_BLOCK_TYPES.LINK_VAULT, {
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
 * Append one link entry to the company URL table and persist immediately.
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").LinkEntry} entry
 * @param {Object} deps
 * @returns {{ docId: string|null, blockId: string }|null}
 */
export function appendEntryToCompanyUrlTable(objectId, entry, {
  addDoc,
  updateDoc,
  docs,
  objects,
  defaultTitle,
}) {
  if (!objectId || !entry) return null;

  const session = loadCompanyUrlTableSession(objectId, docs, defaultTitle);
  const merged = {
    ...session,
    entries: [...session.entries, entry],
    saved: true,
  };

  return persistUrlTableSession(merged, {
    addDoc,
    updateDoc,
    docs,
    objects,
    defaultTitle,
  });
}

/**
 * Queue a link entry into the company URL table (reads workspace stores).
 * @param {string} objectId
 * @param {import("./vaultBlocks.js").LinkEntry} entry
 * @param {{ defaultTitle?: string }} [options]
 */
export function queueUrlTableEntry(objectId, entry, { defaultTitle = "URL table" } = {}) {
  if (!objectId || !entry) return null;

  const { addDoc, updateDoc, docs } = useDocsStore.getState();
  const { objects } = useObjectsStore.getState();

  const result = appendEntryToCompanyUrlTable(objectId, entry, {
    addDoc,
    updateDoc,
    docs,
    objects,
    defaultTitle,
  });

  urlTableQueueCallback?.(objectId, entry);
  return result;
}
