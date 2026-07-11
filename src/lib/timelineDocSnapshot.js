import { resolveNodeAnchorDate, parseDate } from "../temporal.js";
import { listChildCanvasNodeIdsForDoc } from "./timelineGraph.js";
import { resolveDocScheduleDate, resolveExplicitDocScheduleDate } from "./docSchedule.js";

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
  const doc = docsById[docId];
  // Saved Launch / Schedule wins over canvas createdAt (otherwise schedule edits never move the rail).
  const explicit = resolveExplicitDocScheduleDate(doc);
  if (explicit) return explicit;

  const canvasNode = canvasNodes.find(
    (n) => (n.docId || n.noteId) === docId && isDocumentNode(n),
  );
  if (canvasNode) {
    const wired = wireAnchors.get(canvasNode.id);
    if (wired) return wired;
    const direct = resolveNodeAnchorDate(canvasNode, meta);
    if (direct) return direct;
  }
  return resolveDocScheduleDate(doc, meta?.nodeEntitiesById || {});
}

function childSnapshotKey(entityId, canvasNodeId) {
  return entityId || canvasNodeId || "";
}

/**
 * Resolve a timeline date for a linked file entity (store node), even when it is
 * not placed on the canvas. `resolveNodeAnchorDate` expects canvas-shaped nodes
 * with `noteId`, so we adapt the entity first and fall back to doc dates.
 */
function resolveLinkedFileTimelineDate(entityId, entity, meta = {}) {
  if (!entityId || !entity) return null;
  const adapted = {
    noteId: entityId,
    dataType: entity.dataType,
    content: entity.content,
    anchorAt: entity.anchorAt,
  };
  const direct = resolveNodeAnchorDate(adapted, meta);
  if (direct) return direct;

  const fromEntity = parseDate(entity.createdAt) || parseDate(entity.anchorAt);
  if (fromEntity) return fromEntity;

  const doc = meta.docsById?.[entity.parentDocId];
  return resolveDocScheduleDate(doc, meta.nodeEntitiesById || {});
}

function listLinkedFileEntityIds(docId, docsById = {}, nodeEntitiesById = {}) {
  const linkedEntityIds = new Set(docsById[docId]?.nodeIds || []);
  for (const [entityId, entity] of Object.entries(nodeEntitiesById || {})) {
    if (entity?.parentDocId === docId) linkedEntityIds.add(entityId);
  }
  return linkedEntityIds;
}

function minDateMsFromNodes(nodeIds, canvasNodes, wireAnchors, meta) {
  let minMs = null;
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    const raw = wireAnchors.get(nodeId) || resolveNodeAnchorDate(node, meta);
    if (!raw) continue;
    const ms = raw.getTime();
    if (minMs == null || ms < minMs) minMs = ms;
  }
  return minMs;
}

function minChildDateMs(children = []) {
  let minMs = null;
  for (const child of children) {
    if (child?.dateMs == null) continue;
    if (minMs == null || child.dateMs < minMs) minMs = child.dateMs;
  }
  return minMs;
}

/**
 * Capture doc schedule datetime + macronodo children for timeline persistence.
 * Keeps hour/minute from Schedule (no day truncation).
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
  /** @type {object[]} */
  const children = [];
  const seen = new Set();

  const pushChild = (child) => {
    if (!child?.key || seen.has(child.key)) return;
    seen.add(child.key);
    children.push(child);
  };

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

  for (const nodeId of listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById)) {
    const node = canvasNodes.find((n) => n.id === nodeId);
    const entity = node?.noteId ? nodeEntitiesById[node.noteId] : null;
    const raw = wireAnchors.get(nodeId) || resolveNodeAnchorDate(entity || node, meta);
    if (!raw) continue;
    const entityId = node?.noteId || null;
    pushChild({
      key: childSnapshotKey(entityId, nodeId),
      entityId,
      canvasNodeId: nodeId,
      dataType: node?.dataType || entity?.dataType || "text",
      dateMs: raw.getTime(),
    });
  }

  for (const entityId of listLinkedFileEntityIds(docId, docsById, nodeEntitiesById)) {
    const entity = nodeEntitiesById[entityId];
    if (!entity) continue;
    const raw = resolveLinkedFileTimelineDate(entityId, entity, meta);
    if (!raw) continue;
    pushChild({
      key: childSnapshotKey(entityId, null),
      entityId,
      canvasNodeId: null,
      dataType: entity.dataType || "text",
      dateMs: raw.getTime(),
    });
  }

  let anchorDateMs = anchorDate ? anchorDate.getTime() : null;
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
 * Resolve doc schedule datetime preferring live canvas, then snapshot, then doc metadata.
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
      date: raw,
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

  for (const entityId of listLinkedFileEntityIds(docId, docsById, nodeEntitiesById)) {
    const key = childSnapshotKey(entityId, null);
    if (!key || excluded.has(key) || markersByKey.has(key)) continue;
    const entity = nodeEntitiesById[entityId];
    if (!entity) continue;
    const raw = resolveLinkedFileTimelineDate(entityId, entity, meta);
    if (!raw) continue;
    markersByKey.set(key, {
      nodeId: `entity-${entityId}`,
      date: raw,
      docId,
      dataType: entity.dataType || "text",
      entityId,
      childKey: key,
      fromStore: true,
    });
  }

  return [...markersByKey.values()];
}
