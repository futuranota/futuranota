import {
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  getStepPlaybookPreview,
  normalizeDocBlocks,
  normalizeStepEntries,
  stepEntryHasContent,
} from "./docBlocks.js";
import { resolveDocKind } from "./templateDoc.js";

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
 * Collect saved step_sequence playbooks from workspace docs.
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {{ objectId?: string|null, crossObject?: boolean }} [options]
 * @returns {StepPlaybookRef[]}
 */
export function collectSavedStepPlaybooks(docs, { objectId = null, crossObject = false } = {}) {
  /** @type {StepPlaybookRef[]} */
  const playbooks = [];

  for (const doc of Object.values(docs || {})) {
    if (!doc?.id) continue;

    const parentObjectId = doc.parentObjectId ?? null;
    if (objectId && !crossObject && parentObjectId !== objectId) {
      continue;
    }

    const blocks = blocksForDoc(doc);

    blocks.forEach((block) => {
      if (block.type !== DOC_BLOCK_TYPES.STEP_SEQUENCE) return;
      if (!block.saved) return;

      const steps = normalizeStepEntries(Array.isArray(block.steps) ? block.steps : []);
      if (!stepPlaybookHasContent(steps)) return;

      const firstPreview = steps.map(getStepPlaybookPreview).find(Boolean) ?? "";

      playbooks.push({
        id: `${doc.id}:${block.id}`,
        docId: doc.id,
        blockId: block.id,
        title: playbookTitleFrom(block, doc, steps),
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
