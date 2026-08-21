import {
  createDocBlock,
  createStepEntry,
  DOC_BLOCK_TYPES,
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
  normalizeStepEntries,
  stepEntryHasContent,
} from "./docBlocks.js";
import { generateId } from "./ids.js";

/**
 * @param {import("./docBlocks.js").StepEntry[]|unknown} steps
 * @param {string} promptText
 * @returns {{ steps: import("./docBlocks.js").StepEntry[], changed: boolean, stepIndex: number }}
 */
export function appendPromptToStepEntries(steps, promptText) {
  const text = String(promptText ?? "").trim();
  const normalized = normalizeStepEntries(steps);
  if (!text) {
    return { steps: normalized, changed: false, stepIndex: Math.max(0, normalized.length - 1) };
  }

  const last = normalized[normalized.length - 1];
  if (last && !stepEntryHasContent(last)) {
    const next = [...normalized];
    next[next.length - 1] = createStepEntry({
      ...last,
      prompt: text,
      promptSaved: false,
    });
    return { steps: next, changed: true, stepIndex: next.length - 1 };
  }

  const next = [...normalized, createStepEntry({ prompt: text })];
  return { steps: next, changed: true, stepIndex: next.length - 1 };
}

function blocksForDoc(doc) {
  if (Array.isArray(doc?.blocks) && doc.blocks.length) {
    return normalizeDocBlocks(doc.blocks);
  }
  return docBlocksFromBody(doc?.body || doc?.content || "");
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {string} sourceDocumentId
 * @param {string|null} [objectId]
 * @returns {{ docId: string, blockId: string, title: string, steps: import("./docBlocks.js").StepEntry[], sourceDocumentId: string }|null}
 */
export function findStepPlaybookForSourceDocument(docs, sourceDocumentId, objectId = null) {
  const sourceId = String(sourceDocumentId || "").trim();
  if (!sourceId) return null;

  for (const doc of Object.values(docs || {})) {
    if (!doc?.id) continue;
    if (objectId && (doc.parentObjectId ?? null) !== objectId) continue;

    for (const block of blocksForDoc(doc)) {
      if (block.type !== DOC_BLOCK_TYPES.STEP_SEQUENCE) continue;
      // Match by source link even if the block is still a draft (saved: false).
      if (String(block.sourceDocumentId || "").trim() !== sourceId) continue;

      return {
        docId: doc.id,
        blockId: block.id,
        title: String(block.title || doc.title || "").trim(),
        steps: normalizeStepEntries(block.steps),
        sourceDocumentId: sourceId,
      };
    }
  }
  return null;
}

/**
 * @param {Record<string, import("../types/docs.js").Doc>} docs
 * @param {string} docId
 * @param {string} blockId
 * @returns {import("./stepsLibrary.js").StepPlaybookRef|null}
 */
export function buildStepPlaybookRefFromDoc(docs, docId, blockId) {
  const id = String(docId || "").trim();
  const bid = String(blockId || "").trim();
  if (!id || !bid) return null;
  const doc = docs?.[id];
  if (!doc) return null;

  const block = blocksForDoc(doc).find(
    (entry) => entry.id === bid && entry.type === DOC_BLOCK_TYPES.STEP_SEQUENCE,
  );
  if (!block) return null;

  const steps = normalizeStepEntries(block.steps);
  const title = String(block.title || doc.title || "").trim() || "Step by step";

  return {
    id: `${doc.id}:${block.id}`,
    docId: doc.id,
    blockId: block.id,
    title,
    preview: "",
    stepCount: steps.length,
    objectId: doc.parentObjectId ?? null,
    docKind: "standard",
    category: String(doc.category ?? "").trim(),
    steps,
    sourceDocumentId: String(block.sourceDocumentId || "").trim() || undefined,
  };
}

/**
 * Append captured `--prompt--` text into a Step by step playbook for this document.
 * Creates a new playbook doc when none exists for `sourceDocumentId`.
 *
 * @param {object} input
 * @param {string} input.promptText
 * @param {string} input.sourceDocumentId
 * @param {string} input.documentTitle
 * @param {string} input.objectId
 * @param {Record<string, import("../types/docs.js").Doc>} input.docs
 * @param {Record<string, { name?: string }>} [input.objects]
 * @param {(title: string, parentObjectId: string|null, dataProperties: unknown[], tags: string[], initialContent: string, createdAt: string|null, initialBlocks: unknown[]|null, campaignMeta: object) => string|null} input.addDoc
 * @param {(id: string, patch: object) => void} input.updateDoc
 * @returns {{ ok: boolean, docId: string|null, blockId: string|null, stepIndex: number, created: boolean, reason?: string }}
 */
export function appendCapturedTextToStepPlaybook({
  promptText,
  sourceDocumentId,
  documentTitle,
  objectId,
  docs,
  objects = {},
  addDoc,
  updateDoc,
}) {
  const text = String(promptText ?? "").trim();
  const sourceId = String(sourceDocumentId || "").trim();
  const companyId = String(objectId || "").trim();
  if (!text) return { ok: false, docId: null, blockId: null, stepIndex: 0, created: false, reason: "empty" };
  if (!sourceId) return { ok: false, docId: null, blockId: null, stepIndex: 0, created: false, reason: "no_source" };
  if (!companyId) return { ok: false, docId: null, blockId: null, stepIndex: 0, created: false, reason: "no_company" };

  const title = String(documentTitle || "").trim() || "Step by step";
  const existing = findStepPlaybookForSourceDocument(docs, sourceId, companyId);

  if (existing) {
    const appended = appendPromptToStepEntries(existing.steps, text);
    if (!appended.changed) {
      return {
        ok: false,
        docId: existing.docId,
        blockId: existing.blockId,
        stepIndex: appended.stepIndex,
        created: false,
        reason: "unchanged",
      };
    }

    const doc = docs[existing.docId];
    const existingBlocks = blocksForDoc(doc);
    const blockIndex = existingBlocks.findIndex((block) => block.id === existing.blockId);
    const nextBlock = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
      id: existing.blockId,
      title: existing.title || title,
      steps: appended.steps,
      saved: true,
      sourceDocumentId: sourceId,
    });
    const nextBlocks = blockIndex >= 0
      ? existingBlocks.map((block, index) => (index === blockIndex ? nextBlock : block))
      : [...existingBlocks, nextBlock];

    updateDoc(existing.docId, {
      blocks: nextBlocks,
      body: docBlocksToBody(nextBlocks),
      content: docBlocksToBody(nextBlocks),
    });

    return {
      ok: true,
      docId: existing.docId,
      blockId: existing.blockId,
      stepIndex: appended.stepIndex,
      created: false,
    };
  }

  const blockId = generateId("BLK");
  const block = createDocBlock(DOC_BLOCK_TYPES.STEP_SEQUENCE, {
    id: blockId,
    title,
    steps: [createStepEntry({ prompt: text })],
    saved: true,
    sourceDocumentId: sourceId,
  });

  const parentObject = objects[companyId];
  const tags = parentObject?.name ? [parentObject.name] : [];
  const newDocId = addDoc(
    title,
    companyId,
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

  if (!newDocId) {
    return { ok: false, docId: null, blockId, stepIndex: 0, created: false, reason: "create_failed" };
  }

  return {
    ok: true,
    docId: newDocId,
    blockId,
    stepIndex: 0,
    created: true,
  };
}
