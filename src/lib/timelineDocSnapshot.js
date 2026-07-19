import { resolveNodeAnchorDate, parseDate } from "../temporal.js";
import { listChildCanvasNodeIdsForDoc } from "./timelineGraph.js";
import {
  clampTimelineLaunchNotBeforeToday,
  resolveCampaignFolderTimelineDate,
} from "./campaignTimelineRail.js";
import {
  resolveDocScheduleDate,
  resolveExplicitDocScheduleDate,
  resolveLinkedNodeScheduleDate,
} from "./docSchedule.js";

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
  // Campaign folders: parent chip = today (Launch is a separate rail marker).
  const campaignDate = resolveCampaignFolderTimelineDate(
    doc,
    meta?.nodeEntitiesById || {},
    meta?.today instanceof Date ? meta.today : new Date(),
  );
  if (campaignDate) return campaignDate;

  // Priority: Launch/block Schedule → linked node Schedule → canvas → createdAt.
  const explicit = resolveExplicitDocScheduleDate(doc);
  if (explicit) return explicit;

  const fromNodes = resolveLinkedNodeScheduleDate(doc, meta?.nodeEntitiesById || {});
  if (fromNodes) return fromNodes;

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
 * Resolve a timeline date for a folder child entity (store node).
 * Regular task folders prefer Schedule (`anchorAt` / date content).
 * Campaign children use their own launchAt (then createdAt).
 */
function resolveLinkedFileTimelineDate(entityId, entity, meta = {}) {
  if (!entityId || !entity) return null;
  const parentDoc = entity.parentDocId
    ? meta.docsById?.[entity.parentDocId]
    : null;
  if (parentDoc?.campaignActive && entity.dataType !== "date") {
    const launch = parseDate(entity.launchAt);
    const today = meta?.today instanceof Date ? meta.today : new Date();
    // Expand child follows Launch, but never left of today.
    if (launch) return clampTimelineLaunchNotBeforeToday(launch, today);
    return null;
  }
  const fromAnchor = parseDate(entity.anchorAt);
  if (fromAnchor) return fromAnchor;
  if (entity.dataType === "date") {
    const raw = entity.content && typeof entity.content === "object"
      ? entity.content.date
      : entity.content;
    return parseDate(raw);
  }
  // Still a member of a folder — Created is enough to place the expand chip.
  if (entity.parentDocId) {
    return parseDate(entity.createdAt) || null;
  }
  return null;
}

function listLinkedFileEntityIds(docId, docsById = {}, nodeEntitiesById = {}) {
  const linkedEntityIds = new Set(docsById[docId]?.nodeIds || []);
  for (const [entityId, entity] of Object.entries(nodeEntitiesById || {})) {
    if (entity?.parentDocId === docId) linkedEntityIds.add(entityId);
  }
  return linkedEntityIds;
}

/** True when the entity still belongs to this folder (panel membership). */
function entityBelongsToDoc(entityId, docId, docsById = {}, nodeEntitiesById = {}) {
  if (!entityId || !docId) return false;
  const entity = nodeEntitiesById[entityId];
  if (!entity) return false;
  if (entity.parentDocId === docId) return true;
  return (docsById[docId]?.nodeIds || []).includes(entityId);
}

/**
 * Timeline-only: parent folder reads as Completed when it has ≥1 linked child
 * nodes and every one is marked completed. Empty folders stay date-driven.
 * @param {string} docId
 * @param {Record<string, object>} [docsById]
 * @param {Record<string, object>} [nodeEntitiesById]
 */
export function isFolderTimelineCompleted(docId, docsById = {}, nodeEntitiesById = {}) {
  if (!docId) return false;
  const linkedIds = listLinkedFileEntityIds(docId, docsById, nodeEntitiesById);
  if (linkedIds.size === 0) return false;
  for (const entityId of linkedIds) {
    if (!nodeEntitiesById[entityId]?.completed) return false;
  }
  return true;
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

  const parentDoc = docsById[docId];
  const campaignSourceOnly = parentDoc?.campaignActive
    ? (parentDoc.timelineSourceNodeId || null)
    : null;

  for (const nodeId of listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById)) {
    const node = canvasNodes.find((n) => n.id === nodeId);
    const entity = node?.noteId ? nodeEntitiesById[node.noteId] : null;
    const entityId = node?.noteId || null;
    if (campaignSourceOnly && entityId !== campaignSourceOnly) continue;
    // Store entities: Schedule only. Canvas-only nodes may use wire/canvas anchors.
    const raw = (entityId
      ? resolveLinkedFileTimelineDate(entityId, entity, meta)
      : null)
      || wireAnchors.get(nodeId)
      || (!entityId ? resolveNodeAnchorDate(node, meta) : null);
    if (!raw) continue;
    pushChild({
      key: childSnapshotKey(entityId, nodeId),
      entityId,
      canvasNodeId: nodeId,
      dataType: node?.dataType || entity?.dataType || "text",
      dateMs: raw.getTime(),
    });
  }

  for (const entityId of listLinkedFileEntityIds(docId, docsById, nodeEntitiesById)) {
    if (campaignSourceOnly && entityId !== campaignSourceOnly) continue;
    const entity = nodeEntitiesById[entityId];
    if (!entity) continue;
    // Date entities are rail markers, not expand children.
    if (entity.dataType === "date") continue;
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
  const parentDoc = docsById[docId];
  // Campaigns: expand shows only the single queued source file (one at a time).
  const campaignSourceOnly = parentDoc?.campaignActive
    ? (parentDoc.timelineSourceNodeId || null)
    : null;
  /** @type {Map<string, object>} */
  const markersByKey = new Map();

  for (const nodeId of listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById)) {
    const node = nodeById.get(nodeId);
    const item = trackItemsById.get(nodeId);
    const entityId = node?.noteId || null;
    if (campaignSourceOnly && entityId !== campaignSourceOnly) continue;
    const key = childSnapshotKey(entityId, nodeId);
    if (excluded.has(key)) continue;
    const entity = entityId ? nodeEntitiesById[entityId] : null;
    // Prefer live Schedule; never fall back to createdAt for store entities.
    const raw = (entityId
      ? resolveLinkedFileTimelineDate(entityId, entity, meta)
      : null)
      || wireAnchors.get(nodeId)
      || (!entityId ? resolveNodeAnchorDate(item || node, meta) : null);
    if (!raw) continue;
    markersByKey.set(key, {
      nodeId,
      date: raw,
      docId,
      dataType: node?.dataType || item?.dataType || "text",
      entityId,
      childKey: key,
      completed: Boolean(entity?.completed),
      campaignStatus: entity?.campaignStatus || null,
      isTimelineSource: Boolean(
        parentDoc?.campaignActive
        && entityId
        && parentDoc.timelineSourceNodeId === entityId,
      ),
    });
  }

  // Live store entities before snapshot so saved Schedule overrides stale createdAt snapshots.
  for (const entityId of listLinkedFileEntityIds(docId, docsById, nodeEntitiesById)) {
    if (campaignSourceOnly && entityId !== campaignSourceOnly) continue;
    const key = childSnapshotKey(entityId, null);
    if (!key || excluded.has(key) || markersByKey.has(key)) continue;
    const entity = nodeEntitiesById[entityId];
    if (!entity || entity.dataType === "date") continue;
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
      completed: Boolean(entity.completed),
      campaignStatus: entity.campaignStatus || null,
      isTimelineSource: Boolean(
        parentDoc?.campaignActive
        && parentDoc.timelineSourceNodeId === entityId,
      ),
    });
  }

  for (const child of snapshot?.children || []) {
    const key = child.key || childSnapshotKey(child.entityId, child.canvasNodeId);
    if (!key || excluded.has(key) || markersByKey.has(key)) continue;
    if (campaignSourceOnly && child.entityId && child.entityId !== campaignSourceOnly) continue;
    // Never resurrect snapshot chips for deleted / unlinked entities.
    // Orphans with parentDocId=null still exist in the store and previously
    // reappeared via this fallback after left-panel delete / hydrate.
    if (child.entityId) {
      if (!entityBelongsToDoc(child.entityId, docId, docsById, nodeEntitiesById)) continue;
      const entity = nodeEntitiesById[child.entityId];
      const live = resolveLinkedFileTimelineDate(child.entityId, entity, meta);
      if (!live) continue;
      markersByKey.set(key, {
        nodeId: child.canvasNodeId || `entity-${child.entityId}`,
        date: live,
        docId,
        dataType: child.dataType || entity?.dataType || "text",
        entityId: child.entityId,
        childKey: key,
        fromStore: true,
        completed: Boolean(entity?.completed),
      });
      continue;
    }
    // Canvas-only snapshot child (no store entity id).
    if (!child.canvasNodeId || !nodeById?.get?.(child.canvasNodeId)) continue;
    markersByKey.set(key, {
      nodeId: child.canvasNodeId,
      date: new Date(child.dateMs),
      docId,
      dataType: child.dataType || "text",
      entityId: null,
      childKey: key,
      snapshot: true,
      completed: false,
    });
  }

  return [...markersByKey.values()];
}
