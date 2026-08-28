import {
  createMoodboardColumn,
  DOC_BLOCK_TYPES,
  MOODBOARD_NOTES_BODY_MAX,
  MOODBOARD_NOTES_TITLE_DEFAULT,
  MOODBOARD_RECIPES,
  MOODBOARD_STICKY_TITLE_MAX,
} from "./docBlocks.js";
import { buildEventCalendarScopeBrief } from "./eventCalendarScopeBrief.js";
import { calendarEventPayloadToResult } from "./eventCalendarSearch.js";
import { parseNodeWritingBody, serializeNodeWritingBody } from "./nodeInlineContent.js";

/**
 * @typedef {{ scope: "node", target: object, nodeId: string, parentDocId: string|null, docTitle: string }}
 *   | {{ scope: "doc", target: object, nodeId: string, parentDocId: string, docTitle: string }}
 *   MoodboardCalendarFillPlan
 */

/**
 * @param {unknown} column
 */
export function isMoodboardStickyEmpty(column) {
  if (!column || column.recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY) return false;
  const text = String(column.stickyText ?? "").trim();
  if (text) return false;
  const title = String(column.stickyTitle ?? "").trim();
  return !title || title === MOODBOARD_NOTES_TITLE_DEFAULT;
}

/**
 * @param {unknown} blocks
 * @returns {{ blockId: string, colIndex: number } | null}
 */
export function findMoodboardStickyTarget(blocks) {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    const blockType = block?.type;
    if (
      !block?.id
      || (blockType !== DOC_BLOCK_TYPES.MOODBOARD && blockType !== "moodboard")
    ) {
      continue;
    }
    const columns = Array.isArray(block.columns) ? block.columns : [];
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      if (isMoodboardStickyEmpty(columns[colIndex])) {
        return { blockId: String(block.id), colIndex };
      }
    }
  }
  return null;
}

/**
 * @param {unknown} blocks
 * @param {{ blockId: string, colIndex: number }} target
 * @param {{ stickyTitle?: string, stickyText?: string }} content
 */
export function fillMoodboardStickyColumn(blocks, target, content) {
  if (!Array.isArray(blocks) || !target?.blockId) return null;
  const stickyTitle = String(content?.stickyTitle ?? "").slice(0, MOODBOARD_STICKY_TITLE_MAX);
  const stickyText = String(content?.stickyText ?? "").slice(0, MOODBOARD_NOTES_BODY_MAX);
  if (!stickyText.trim()) return null;

  let changed = false;
  const next = blocks.map((block) => {
    if (!block || block.id !== target.blockId) return block;
    const blockType = block.type;
    if (blockType !== DOC_BLOCK_TYPES.MOODBOARD && blockType !== "moodboard") return block;
    const columns = Array.isArray(block.columns) ? block.columns : [];
    const nextColumns = columns.map((col, colIndex) => {
      if (colIndex !== target.colIndex) return col;
      if (!isMoodboardStickyEmpty(col)) return col;
      changed = true;
      return createMoodboardColumn(MOODBOARD_RECIPES.MEDIUM_STICKY, {
        images: col.images,
        stickyTitle,
        stickyText,
        infoLabel: col.infoLabel,
        noteStyle: col.noteStyle,
      });
    });
    return changed ? { ...block, columns: nextColumns } : block;
  });
  return changed ? next : null;
}

/**
 * @param {unknown} blocks
 * @param {string} stickyText
 */
export function moodboardHasStickyText(blocks, stickyText) {
  const needle = String(stickyText ?? "").trim();
  if (!needle) return false;
  if (!Array.isArray(blocks)) return false;
  for (const block of blocks) {
    const blockType = block?.type;
    if (blockType !== DOC_BLOCK_TYPES.MOODBOARD && blockType !== "moodboard") continue;
    const columns = Array.isArray(block?.columns) ? block.columns : [];
    for (const col of columns) {
      if (col?.recipe !== MOODBOARD_RECIPES.MEDIUM_STICKY) continue;
      if (String(col.stickyText ?? "").trim() === needle) return true;
    }
  }
  return false;
}

/**
 * @param {object|null|undefined} source fetch result or calendar-event payload
 * @param {{ locale?: 'en'|'es' }} [options]
 */
export function buildStickyContentFromCalendarSource(source, options = {}) {
  if (!source) return null;

  const locale = options.locale === "es" ? "es" : "en";
  let fetchShape = null;

  if (source.kind === "calendar-event") {
    const pseudo = calendarEventPayloadToResult(source);
    if (!pseudo) return null;
    fetchShape = {
      ...pseudo,
      rangeId: source.rangeId || null,
      rangeDays: source.rangeDays ?? null,
      rangeLabel: source.rangeLabel || null,
      scheduleIso: source.scheduleIso || null,
      events: pseudo.event ? [pseudo.event] : [],
    };
  } else if (source.scopeBrief || Array.isArray(source.events)) {
    fetchShape = source;
  }

  if (!fetchShape) return null;

  let scopeBrief = fetchShape.scopeBrief;
  if (!scopeBrief?.body || scopeBrief.hasData === false) {
    scopeBrief = buildEventCalendarScopeBrief(fetchShape, { locale });
  }
  if (!scopeBrief?.hasData && !String(scopeBrief?.body ?? "").trim()) return null;

  const stickyText = String(scopeBrief.body || "").slice(0, MOODBOARD_NOTES_BODY_MAX);
  if (!stickyText.trim()) return null;

  const firstEvent = fetchShape.event || fetchShape.events?.[0];
  let stickyTitle;
  if (firstEvent?.title) {
    stickyTitle = String(firstEvent.title).slice(0, MOODBOARD_STICKY_TITLE_MAX);
  } else {
    const rangeLabel = fetchShape.rangeLabel || fetchShape.rangeId || "week";
    stickyTitle = `Event calendar · ${rangeLabel}`.slice(0, MOODBOARD_STICKY_TITLE_MAX);
  }

  return { stickyTitle, stickyText };
}

/**
 * @param {object|null|undefined} activeNode
 * @param {object|null|undefined} parentDoc
 * @returns {MoodboardCalendarFillPlan|null}
 */
export function resolveMoodboardCalendarFillPlan(activeNode, parentDoc) {
  if (!activeNode?.id) return null;

  const docTitle = String(
    parentDoc?.title || activeNode.title || activeNode.sourceQuery || "document",
  ).trim() || "document";
  const nodeBlocks = parseNodeWritingBody(activeNode.content).blocks;
  const nodeTarget = findMoodboardStickyTarget(nodeBlocks);
  if (nodeTarget) {
    return {
      scope: "node",
      target: nodeTarget,
      nodeId: String(activeNode.id),
      parentDocId: activeNode.parentDocId || null,
      docTitle,
    };
  }

  const parentDocId = activeNode.parentDocId || parentDoc?.id || null;
  if (!parentDocId) return null;
  const docBlocks = Array.isArray(parentDoc?.blocks) ? parentDoc.blocks : [];
  const docTarget = findMoodboardStickyTarget(docBlocks);
  if (!docTarget) return null;

  return {
    scope: "doc",
    target: docTarget,
    nodeId: String(activeNode.id),
    parentDocId: String(parentDocId),
    docTitle,
  };
}

/**
 * @param {MoodboardCalendarFillPlan} plan
 * @param {object} source fetch result or calendar-event payload
 * @param {{
 *   getNode: (id: string) => object|null|undefined,
 *   updateNode: (id: string, patch: object) => void,
 *   syncNodeToParentDoc?: (nodeId: string, parentDocId: string) => void,
 *   getDoc: (id: string) => object|null|undefined,
 *   updateDoc: (id: string, patch: object) => void,
 *   locale?: 'en'|'es',
 * }} api
 * @returns {boolean}
 */
export function applyMoodboardCalendarFill(plan, source, api) {
  const content = buildStickyContentFromCalendarSource(source, { locale: api.locale });
  if (!plan || !content) return false;

  if (plan.scope === "node") {
    const node = api.getNode(plan.nodeId);
    if (!node) return false;
    const nodeBlocks = parseNodeWritingBody(node.content).blocks;
    if (moodboardHasStickyText(nodeBlocks, content.stickyText)) return true;
    const nextNodeBlocks = fillMoodboardStickyColumn(nodeBlocks, plan.target, content);
    if (!nextNodeBlocks) return false;
    const nextContent = serializeNodeWritingBody({ blocks: nextNodeBlocks });
    api.updateNode(plan.nodeId, { content: nextContent });
    if (plan.parentDocId && api.syncNodeToParentDoc) {
      api.syncNodeToParentDoc(plan.nodeId, plan.parentDocId);
    }
    return true;
  }

  if (plan.scope === "doc" && plan.parentDocId) {
    const parentDoc = api.getDoc(plan.parentDocId);
    const docBlocks = Array.isArray(parentDoc?.blocks) ? parentDoc.blocks : [];
    if (moodboardHasStickyText(docBlocks, content.stickyText)) return true;
    const nextBlocks = fillMoodboardStickyColumn(docBlocks, plan.target, content);
    if (!nextBlocks) return false;
    api.updateDoc(plan.parentDocId, { blocks: nextBlocks });
    return true;
  }

  return false;
}
