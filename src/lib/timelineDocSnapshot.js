import { resolveNodeAnchorDate, startOfCalendarDay, parseDate } from "../temporal.js";
import { listChildCanvasNodeIdsForDoc } from "./timelineGraph.js";

function isDocumentNode(node) {
  return node?.canvasKind === "document" || node?.dataType === "document";
}

function resolveDocTimelineDateLocal(
  docId,
  canvasNodes,
  wireAnchors,
  docsById,
  meta,
) {
  const canvasNode = canvasNodes.find(
    (n) => (n.docId || n.noteId) === docId && isDocumentNode(n),
  );
  if (canvasNode) {
    const wired = wireAnchors.get(canvasNode.id);
    if (wired) return wired;
    const direct = resolveNodeAnchorDate(canvasNode, meta);
    if (direct) return startOfCalendarDay(direct);
  }
  const doc = docsById[docId];
  if (doc?.launchAt) {
    const d = parseDate(doc.launchAt);
    if (d) return startOfCalendarDay(d);
  }
  if (doc?.createdAt) {
    const d = parseDate(doc.createdAt);
    if (d) return startOfCalendarDay(d);
  }
  return null;
}

function childSnapshotKey(entityId, canvasNodeId) {
  return entityId || canvasNodeId || "";
}

function minDateMsFromNodes(nodeIds, canvasNodes, wireAnchors, meta) {
  let minMs = null;
  for (const nodeId of nodeIds || []) {
    const node = canvasNodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const entity = node.noteId ? meta.nodeEntitiesById?.[node.noteId] : null;
    const raw = wireAnchors.get(nodeId) || resolveNodeAnchorDate(entity || node, meta);
    if (!raw) continue;
    const ms = startOfCalendarDay(raw).getTime();
    if (minMs == null || ms < minMs) minMs = ms;
  }
  return minMs;
}

function minChildDateMs(children = []) {
  const values = children
    .map((child) => child?.dateMs)
    .filter((ms) => Number.isFinite(ms));
  return values.length ? Math.min(...values) : null;
}

/**
 * Capture doc anchor date + macronodo children for timeline persistence (survives canvas removal).
 * @param {string} docId
 * @param {object} ctx
 */
export function captureTimelineDocSnapshot(
  docId,
  {
    canvasNodes = [],
    wireAnchors = new Map(),
    docsById = {},
    nodeEntitiesById = {},
    preferredCanvasNodeIds = [],
  } = {},
) {
  const meta = { nodeEntitiesById, docsById };
  let anchorDate = resolveDocTimelineDateLocal(docId, canvasNodes, wireAnchors, docsById, meta);
  if (!anchorDate && preferredCanvasNodeIds.length) {
    const preferredMs = minDateMsFromNodes(
      preferredCanvasNodeIds,
      canvasNodes,
      wireAnchors,
      meta,
    );
    if (preferredMs != null) anchorDate = new Date(preferredMs);
  }
  /** @type {{ key: string, entityId: string | null, canvasNodeId: string | null, dataType: string, dateMs: number }[]} */
  const children = [];

  for (const nodeId of listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById)) {
    const node = canvasNodes.find((n) => n.id === nodeId);
    const entity = node?.noteId ? nodeEntitiesById[node.noteId] : null;
    const raw = wireAnchors.get(nodeId) || resolveNodeAnchorDate(entity || node, meta);
    if (!raw) continue;
    const entityId = node?.noteId || null;
    children.push({
      key: childSnapshotKey(entityId, nodeId),
      entityId,
      canvasNodeId: nodeId,
      dataType: node?.dataType || entity?.dataType || "text",
      dateMs: startOfCalendarDay(raw).getTime(),
    });
  }

  let anchorDateMs = anchorDate ? startOfCalendarDay(anchorDate).getTime() : null;
  if (anchorDateMs == null) {
    anchorDateMs = minChildDateMs(children);
  }

  return {
    anchorDateMs,
    objectId: docsById[docId]?.parentObjectId || null,
    children,
  };
}

/**
 * Resolve doc anchor date preferring live canvas, then snapshot, then doc metadata.
 */
export function resolveQueuedDocTimelineDate(
  docId,
  canvasNodes,
  wireAnchors,
  docsById,
  meta,
  snapshot,
) {
  const live = resolveDocTimelineDateLocal(docId, canvasNodes, wireAnchors, docsById, meta);
  if (live) return live;
  if (snapshot?.anchorDateMs) return new Date(snapshot.anchorDateMs);
  const childMs = minChildDateMs(snapshot?.children || []);
  if (childMs != null) return new Date(childMs);
  return null;
}

/**
 * Build child markers for an expanded doc: live canvas nodes + snapshot fallbacks.
 */
export function buildChildMarkersForDoc(
  docId,
  {
    canvasNodes = [],
    wireAnchors = new Map(),
    nodeEntitiesById = {},
    docsById = {},
    nodeById,
    trackItemsById,
    snapshot = null,
    excludedKeys = [],
  } = {},
) {
  const meta = { nodeEntitiesById, docsById };
  const excluded = new Set(excludedKeys);
  /** @type {Map<string, object>} */
  const markersByKey = new Map();

  for (const nodeId of listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById)) {
    const node = nodeById.get(nodeId);
    const item = trackItemsById.get(nodeId);
    const entityId = node?.noteId || null;
    const key = childSnapshotKey(entityId, nodeId);
    if (excluded.has(key)) continue;
    const raw = wireAnchors.get(nodeId) || resolveNodeAnchorDate(item || node, meta);
    if (!raw) continue;
    markersByKey.set(key, {
      nodeId,
      date: startOfCalendarDay(raw),
      docId,
      dataType: node?.dataType || item?.dataType || "text",
      entityId,
      childKey: key,
    });
  }

  for (const child of snapshot?.children || []) {
    const key = child.key || childSnapshotKey(child.entityId, child.canvasNodeId);
    if (!key || excluded.has(key) || markersByKey.has(key)) continue;
    markersByKey.set(key, {
      nodeId: child.canvasNodeId || `snapshot-${key}`,
      date: new Date(child.dateMs),
      docId,
      dataType: child.dataType || "text",
      entityId: child.entityId || null,
      childKey: key,
      snapshot: true,
    });
  }

  return [...markersByKey.values()];
}
