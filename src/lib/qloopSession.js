import {
  createDocBlock,
  createQLoopEntry,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  normalizeDocBlocks,
  qloopEntryHasContent,
} from "./docBlocks.js";
import { generateId } from "./ids.js";

/**
 * @typedef {Object} QLoopSession
 * @property {string|null} objectId
 * @property {string|null} docId
 * @property {string} blockId
 * @property {string} title
 * @property {import("./docBlocks.js").QLoopEntry[]} queries
 * @property {boolean} saved
 */

/**
 * @param {string|null} objectId
 * @returns {QLoopSession}
 */
export function createBlankQLoopSession(objectId = null) {
  return {
    objectId,
    docId: null,
    blockId: generateId("BLK"),
    title: "",
    queries: [createQLoopEntry({ index: 1 })],
    saved: false,
  };
}

/**
 * @param {import("./qloopsLibrary.js").QLoopRef} loop
 * @param {{ saved?: boolean }} [options]
 * @returns {QLoopSession}
 */
export function qloopSessionFromRef(loop, options = {}) {
  const saved = options.saved != null ? Boolean(options.saved) : true;
  return {
    objectId: loop.objectId ?? null,
    docId: loop.docId,
    blockId: loop.blockId,
    title: loop.title === "QLoops" ? "" : (loop.title || ""),
    queries: (loop.queries || []).map((entry) => ({ ...entry })),
    saved,
  };
}

/** @param {Partial<QLoopSession>|null|undefined} session */
export function qloopSessionHasContent(session) {
  if (!session) return false;
  if (String(session.title ?? "").trim()) return true;
  return (session.queries || []).some(qloopEntryHasContent);
}

/**
 * @param {QLoopSession} session
 * @param {Object} deps
 * @param {(title: string, parentObjectId: string|null, dataProperties: unknown[], tags: string[], initialContent: string, createdAt: string|null, initialBlocks: unknown[]|null, campaignMeta: object) => string|null} deps.addDoc
 * @param {(id: string, patch: object) => void} deps.updateDoc
 * @param {Record<string, import("../types/docs.js").Doc>} deps.docs
 * @param {Record<string, { name?: string }>} deps.objects
 * @param {string} deps.defaultTitle
 * @returns {{ docId: string|null, blockId: string }}
 */
export function persistQLoopSession(session, {
  addDoc,
  updateDoc,
  docs,
  objects,
  defaultTitle,
}) {
  const buildBlock = () => createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
    id: session.blockId,
    title: String(session.title ?? "").trim(),
    queries: session.queries,
    saved: true,
  });

  if (!session.docId) {
    if (!session.objectId) {
      const block = buildBlock();
      return { docId: null, blockId: block.id };
    }

    for (const doc of Object.values(docs || {})) {
      if (doc.parentObjectId !== session.objectId) continue;
      const existingBlocks = normalizeDocBlocks(doc.blocks || []);
      const existingIndex = existingBlocks.findIndex((entry) => entry.id === session.blockId);
      if (existingIndex < 0) continue;

      const block = buildBlock();
      const docTitle = block.title || defaultTitle;
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

    const block = buildBlock();
    const docTitle = block.title || defaultTitle;
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
        nodeLinkColor: "white",
      },
    );

    return { docId: newDocId, blockId: block.id };
  }

  const doc = docs[session.docId];
  if (!doc) {
    const block = buildBlock();
    return { docId: session.docId, blockId: block.id };
  }

  const existingBlocks = normalizeDocBlocks(doc.blocks || []);
  const blockIndex = existingBlocks.findIndex((entry) => entry.id === session.blockId);
  const block = buildBlock();
  const docTitle = block.title || defaultTitle;
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
