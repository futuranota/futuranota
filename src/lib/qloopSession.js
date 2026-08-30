import {
  createDocBlock,
  createQLoopEntry,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  qloopEntryHasContent,
  resolveDocBlocks,
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

/** @param {import("./docBlocks.js").DocBlock[]} existingBlocks @param {QLoopSession} session */
function findQLoopBlockIndex(existingBlocks, session) {
  const directIndex = existingBlocks.findIndex((entry) => entry.id === session.blockId);
  if (directIndex >= 0) return directIndex;

  const qloopIndexes = existingBlocks
    .map((block, index) => (block.type === DOC_BLOCK_TYPES.QLOOP_SEQUENCE ? index : -1))
    .filter((index) => index >= 0);

  // Dedicated library doc or body round-trip with regenerated block id — update the sole slot.
  if (qloopIndexes.length === 1) return qloopIndexes[0];
  return -1;
}

/** @param {QLoopSession} session @param {import("./docBlocks.js").DocBlock|null} [existingBlock] */
function buildQLoopBlock(session, existingBlock = null) {
  return createDocBlock(DOC_BLOCK_TYPES.QLOOP_SEQUENCE, {
    id: existingBlock?.id || session.blockId,
    title: String(session.title ?? "").trim(),
    queries: session.queries,
    saved: true,
  });
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
  const buildBlock = (existingBlock = null) => buildQLoopBlock(session, existingBlock);

  if (!session.docId) {
    if (!session.objectId) {
      const block = buildBlock();
      return { docId: null, blockId: block.id };
    }

    for (const doc of Object.values(docs || {})) {
      if (doc.parentObjectId !== session.objectId) continue;
      const existingBlocks = resolveDocBlocks(doc);
      const existingIndex = findQLoopBlockIndex(existingBlocks, session);
      if (existingIndex < 0) continue;

      const existingBlock = existingBlocks[existingIndex];
      const block = buildBlock(existingBlock);
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

  const existingBlocks = resolveDocBlocks(doc);
  const blockIndex = findQLoopBlockIndex(existingBlocks, session);
  const existingBlock = blockIndex >= 0 ? existingBlocks[blockIndex] : null;
  const block = buildBlock(existingBlock);
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
