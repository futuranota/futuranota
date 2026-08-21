import {
  createDocBlock,
  createStepEntry,
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  normalizeDocBlocks,
  stepEntryHasContent,
} from "./docBlocks.js";
import { generateId } from "./ids.js";

/**
 * @typedef {Object} StepPlaybookSession
 * @property {string|null} objectId
 * @property {string|null} docId
 * @property {string} blockId
 * @property {string} title
 * @property {import("./docBlocks.js").StepEntry[]} steps
 * @property {boolean} saved
 * @property {number} [initialStepIndex]
 * @property {string|null} [sourceDocumentId]
 */

/**
 * @param {string|null} objectId
 * @returns {StepPlaybookSession}
 */
export function createBlankStepPlaybookSession(objectId = null) {
  return {
    objectId,
    docId: null,
    blockId: generateId("BLK"),
    title: "",
    steps: [createStepEntry()],
    saved: false,
    initialStepIndex: 0,
    sourceDocumentId: null,
  };
}

/**
 * @param {import("./stepsLibrary.js").StepPlaybookRef} playbook
 * @param {{ initialStepIndex?: number, saved?: boolean }} [options]
 * @returns {StepPlaybookSession}
 */
export function stepPlaybookSessionFromRef(playbook, options = {}) {
  const initialStepIndex = Math.max(0, Number(options.initialStepIndex) || 0);
  const saved = options.saved != null ? Boolean(options.saved) : true;
  const sourceDocumentId = String(playbook.sourceDocumentId || "").trim() || null;
  return {
    objectId: playbook.objectId ?? null,
    docId: playbook.docId,
    blockId: playbook.blockId,
    title: playbook.title === "Step by step" ? "" : (playbook.title || ""),
    steps: (playbook.steps || []).map((step) => ({
      ...step,
      blocks: step.blocks ? [...step.blocks] : [],
    })),
    saved,
    initialStepIndex,
    sourceDocumentId,
  };
}

/** @param {Partial<StepPlaybookSession>|null|undefined} session */
export function stepPlaybookSessionHasContent(session) {
  if (!session) return false;
  if (String(session.title ?? "").trim()) return true;
  return (session.steps || []).some(stepEntryHasContent);
}

/**
 * @param {StepPlaybookSession} session
 * @param {Object} deps
 * @param {(title: string, parentObjectId: string|null, dataProperties: unknown[], tags: string[], initialContent: string, createdAt: string|null, initialBlocks: unknown[]|null, campaignMeta: object) => string|null} deps.addDoc
 * @param {(id: string, patch: object) => void} deps.updateDoc
 * @param {Record<string, import("../types/docs.js").Doc>} deps.docs
 * @param {Record<string, { name?: string }>} deps.objects
 * @param {string} deps.defaultTitle
 * @returns {{ docId: string|null, blockId: string }}
 */
export function persistStepPlaybookSession(session, {
  addDoc,
  updateDoc,
  docs,
  objects,
  defaultTitle,
}) {
  /** Preserve capture link from session, else keep whatever the doc block already has. */
  const resolveSourceDocumentId = (existingBlock = null) => {
    const fromSession = String(session.sourceDocumentId || "").trim();
    if (fromSession) return fromSession;
    const fromBlock = String(existingBlock?.sourceDocumentId || "").trim();
    return fromBlock || null;
  };

  const buildBlock = (existingBlock = null) => {
    const sourceDocumentId = resolveSourceDocumentId(existingBlock);
    return createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      id: session.blockId,
      title: String(session.title ?? "").trim(),
      steps: session.steps,
      saved: true,
      ...(sourceDocumentId ? { sourceDocumentId } : {}),
    });
  };

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
        nodeLinkColor: "dark",
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
