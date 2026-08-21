import {
  createDocBlock,
  createStepEntry,
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  docBlocksToBody,
  getStepPlaybookPreview,
  normalizeDocBlocks,
  normalizeStepEntries,
  removeBlockAt,
  stepEntryHasContent,
} from "./docBlocks.js";
import { isDedicatedStepPlaybookDoc, resolveDocKind } from "./templateDoc.js";

const PREVIEW_MAX = 120;

/**
 * @typedef {Object} StepPlaybookRef
 * @property {string} id
 * @property {string} docId
 * @property {string} blockId
 * @property {string} title
 * @property {string} preview
 * @property {number} stepCount
 * @property {string|null} objectId
 * @property {string} docKind
 * @property {string} category
 * @property {import("./docBlocks.js").StepEntry[]} steps
 * @property {string} [sourceDocumentId]
 */

function truncate(text, max) {
  const value = String(text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function playbookTitleFrom(block, doc, steps) {
  const blockTitle = String(block?.title ?? "").trim();
  if (blockTitle) return blockTitle;
  const docTitle = String(doc.title ?? "").trim();
  if (docTitle) return docTitle;
  const first = steps.map(getStepPlaybookPreview).find(Boolean);
  return first ? truncate(first, 60) : "Step by step";
}

function stepPlaybookHasContent(steps) {
  return steps.some(stepEntryHasContent);
}

function blocksForDoc(doc) {
  if (Array.isArray(doc?.blocks) && doc.blocks.length) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc?.body || doc?.content || "");
}

/**
 * Blocks for a new step-by-step document (wizard open, not saved yet).
 * @returns {import("./docBlocks.js").DocBlock[]}
 */
export function createNewStepPlaybookBlocks() {
  return [
    createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      title: "",
      steps: [createStepEntry()],
      saved: false,
    }),
  ];
}

/**
 * Collect saved step_sequence playbooks from workspace docs.
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {{ objectId?: string|null }} [options]
 * @returns {StepPlaybookRef[]}
 */
export function collectSavedStepPlaybooks(docs, { objectId = null } = {}) {
  /** @type {StepPlaybookRef[]} */
  const playbooks = [];

  for (const doc of Object.values(docs || {})) {
    if (!doc?.id) continue;

    const parentObjectId = doc.parentObjectId ?? null;
    if (objectId && parentObjectId !== objectId) {
      continue;
    }

    const blocks = blocksForDoc(doc);

    blocks.forEach((block) => {
      if (block.type !== DOC_BLOCK_TYPES.STEP_SEQUENCE) return;
      if (!block.saved) return;

      const steps = normalizeStepEntries(Array.isArray(block.steps) ? block.steps : []);
      const title = playbookTitleFrom(block, doc, steps);
      const hasSteps = stepPlaybookHasContent(steps);
      const hasTitle = Boolean(String(block?.title ?? "").trim() || String(doc.title ?? "").trim());
      // Saved guides with a title should appear even before step body is filled.
      if (!hasSteps && !hasTitle) return;

      const firstPreview = steps.map(getStepPlaybookPreview).find(Boolean) ?? "";

      playbooks.push({
        id: `${doc.id}:${block.id}`,
        docId: doc.id,
        blockId: block.id,
        title,
        preview: truncate(firstPreview, PREVIEW_MAX),
        stepCount: steps.length,
        objectId: parentObjectId,
        docKind: resolveDocKind(doc) || "standard",
        category: String(doc.category ?? "").trim(),
        steps,
      });
    });
  }

  return playbooks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/**
 * @param {StepPlaybookRef[]} playbooks
 * @param {string} query
 * @returns {StepPlaybookRef[]}
 */
export function filterStepPlaybooks(playbooks, query) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return playbooks;

  return playbooks.filter((playbook) => {
    if (playbook.title.toLowerCase().includes(normalized)) return true;
    if (playbook.preview.toLowerCase().includes(normalized)) return true;
    if (playbook.category.toLowerCase().includes(normalized)) return true;
    return playbook.steps.some((step) => getStepPlaybookPreview(step).toLowerCase().includes(normalized));
  });
}

/**
 * Remove a saved step playbook from its backing document.
 * @param {StepPlaybookRef} playbook
 * @param {import("../types/docs.js").Doc} doc
 * @param {(id: string, patch: object) => void} updateDoc
 * @param {(id: string) => void} deleteDoc
 * @returns {{ docRemoved: boolean }}
 */
export function removeStepPlaybookFromDoc(playbook, doc, updateDoc, deleteDoc) {
  if (!playbook?.docId || !doc?.id) return { docRemoved: false };

  const blocks = blocksForDoc(doc);
  const blockIndex = blocks.findIndex((block) => block.id === playbook.blockId);
  if (blockIndex < 0) return { docRemoved: false };

  const isDedicatedDoc = isDedicatedStepPlaybookDoc(doc);

  if (isDedicatedDoc) {
    deleteDoc(doc.id);
    return { docRemoved: true };
  }

  let nextBlocks = removeBlockAt(blocks, blockIndex);
  if (!nextBlocks.length) {
    nextBlocks = [createDocBlock(DOC_BLOCK_TYPES.TEXT, { text: "" })];
  }

  updateDoc(doc.id, {
    blocks: nextBlocks,
    body: docBlocksToBody(nextBlocks),
    content: docBlocksToBody(nextBlocks),
  });

  return { docRemoved: false };
}
