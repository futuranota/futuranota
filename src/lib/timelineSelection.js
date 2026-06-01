import { normalizeDocBlocks } from "./docBlocks.js";
import { findH1BlockIndex, getH1IndexForTextBlock } from "./docNodeSync.js";
import { isKnowledgeDoc } from "./templateDoc.js";

/**
 * Canvas selection + timeline doc queue helpers.
 * All visible canvas nodes are selectable; queue entries need a resolvable doc id.
 */

export function resolveParentDocIdForCanvasNode(
  node,
  nodeEntitiesById = {},
  docsById = {},
) {
  if (!node) return null;
  if (node.parentDocId && docsById[node.parentDocId]) return node.parentDocId;
  if (node.canvasKind === "document" && (node.docId || node.noteId)) {
    const id = node.docId || node.noteId;
    return docsById[id] ? id : null;
  }
  if (node.noteId && nodeEntitiesById[node.noteId]) {
    const parentDocId = nodeEntitiesById[node.noteId].parentDocId;
    if (parentDocId && docsById[parentDocId]) return parentDocId;
  }
  return null;
}

/** H1 block id (or meta launch sentinel) to scroll when opening the parent doc from a canvas child. */
export function resolveHeadlineBlockIdForCanvasNode(
  node,
  nodeEntitiesById = {},
  docsById = {},
) {
  if (!node) return null;
  const docId = resolveParentDocIdForCanvasNode(node, nodeEntitiesById, docsById);
  if (!docId) return null;
  if (node.canvasKind === "launch") return "__doc_meta_launch__";
  if (!node.noteId) return null;

  const entity = nodeEntitiesById[node.noteId];
  const blockId = entity?.sourceBlockId;
  if (!blockId) return null;

  const doc = docsById[docId];
  const blocks = normalizeDocBlocks(doc?.blocks || []);
  const h1Index = findH1BlockIndex(blocks, blockId);
  if (h1Index >= 0) return blocks[h1Index].id;

  const textIndex = blocks.findIndex((b) => b.id === blockId);
  if (textIndex >= 0) {
    const h1FromText = getH1IndexForTextBlock(blocks, textIndex);
    if (h1FromText >= 0) return blocks[h1FromText].id;
  }
  return blockId;
}

/** Any visible canvas node can be clicked and selected. */
export function isTimelineSelectableCanvasNode(node, _nodeEntitiesById = {}) {
  return Boolean(node && !node.hidden);
}

/** Append doc to queue in selection order (1, 2, 3…); same doc is not duplicated. */
export function pushDocToTimelineQueue(queue, docId) {
  if (!docId) return queue;
  if (queue.includes(docId)) return queue;
  return [...queue, docId];
}

/**
 * One sidebar card per unique doc.
 * - Select off: badge always 1 (single pick).
 * - Select on: badge = count of selected canvas nodes for that doc (+1 per node).
 * @returns {{ docId: string, queueIndex: number, focusBlockId: string|null }[]}
 */
export function buildTimelineQueueEntries(
  canvasSelection = [],
  canvasNodes = [],
  nodeEntitiesById = {},
  docsById = {},
  { selectCounterMode = false } = {},
) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const docOrder = [];
  const byDocId = new Map();

  for (const canvasNodeId of canvasSelection) {
    const node = nodeById.get(canvasNodeId);
    if (!isTimelineSelectableCanvasNode(node, nodeEntitiesById)) continue;
    const docId = resolveParentDocIdForCanvasNode(node, nodeEntitiesById, docsById);
    if (!docId) continue;
    const doc = docsById[docId];
    if (isKnowledgeDoc(doc)) continue;
    if (!byDocId.has(docId)) {
      docOrder.push(docId);
      byDocId.set(docId, {
        nodeCount: 0,
        focusBlockId: resolveHeadlineBlockIdForCanvasNode(node, nodeEntitiesById, docsById),
      });
    }
    byDocId.get(docId).nodeCount += 1;
  }

  return docOrder.map((docId) => {
    const meta = byDocId.get(docId);
    return {
      docId,
      queueIndex: selectCounterMode ? meta.nodeCount : 1,
      focusBlockId: meta.focusBlockId,
    };
  });
}

/**
 * Unique doc ids for timeline queue in canvas selection order.
 */
export function buildTimelineDocQueue(
  selection = [],
  canvasNodes = [],
  nodeEntitiesById = {},
  docsById = {},
) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  let queue = [];

  for (const canvasId of selection) {
    const node = nodeById.get(canvasId);
    if (!isTimelineSelectableCanvasNode(node, nodeEntitiesById)) continue;
    const docId = resolveParentDocIdForCanvasNode(node, nodeEntitiesById, docsById);
    if (!docId) continue;
    queue = pushDocToTimelineQueue(queue, docId);
  }

  return queue;
}

/** True if a document already has an entry on any timeline. */
export function docIdExistsOnTimeline(docId, timelines = {}) {
  if (!docId) return false;
  for (const tl of Object.values(timelines)) {
    for (const entry of tl.entries || []) {
      if (entry.itemType === "doc" && entry.itemId === docId) return true;
    }
  }
  return false;
}

export function filterSelectableCanvasNodeIds(
  nodeIds = [],
  canvasNodes = [],
  nodeEntitiesById = {},
) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  return nodeIds.filter((id) => {
    const node = nodeById.get(id);
    return isTimelineSelectableCanvasNode(node, nodeEntitiesById);
  });
}
