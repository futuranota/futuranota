import { parseDate, startOfCalendarDay } from "../temporal.js";
import { isTacticalDocumentNode } from "./timelineGraph.js";

/** Canvas nodes may use noteId (App canvas) or nodeId (persisted canvas store). */
export function resolveCanvasEntityId(node) {
  if (!node) return null;
  return node.noteId || node.nodeId || null;
}

/**
 * Merge file queues in order; de-dupe while preserving first-seen order.
 * @param {string[][]} queues
 * @returns {string[]}
 */
export function mergeTimelineFileQueues(...queues) {
  const out = [];
  const seen = new Set();
  for (const queue of queues) {
    if (!Array.isArray(queue)) continue;
    for (const id of queue) {
      const key = String(id || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/**
 * Drop stale entity ids from the doc-wire queue after hydrate/delete.
 * @param {string[]} queue
 * @param {string[]|Set<string>|Record<string, unknown>} nodeIds
 * @returns {string[]}
 */
export function filterTimelineFileQueueToExistingNodes(queue, nodeIds = []) {
  if (!Array.isArray(queue)) return [];
  const nodeSet = nodeIds instanceof Set
    ? nodeIds
    : new Set(
      Array.isArray(nodeIds)
        ? nodeIds
        : Object.keys(nodeIds || {}),
    );
  return queue.filter((id) => nodeSet.has(id));
}

/**
 * Canvas TEXT / file chip (macronodo) — not a folder card, date, or launch.
 * Inserting these must queue the file, not the parent folder.
 */
export function isTimelineFileCanvasNode(node, nodeEntitiesById = {}) {
  if (!node || node.hidden) return false;
  if (isTacticalDocumentNode(node)) return false;
  if (node.dataType === "date" || node.canvasKind === "launch") return false;
  if (node.canvasKind === "agent" || node.dataType === "agent") return false;
  const entityId = resolveCanvasEntityId(node);
  if (!entityId) return false;
  const entity = nodeEntitiesById[entityId];
  return Boolean(entity?.parentDocId || node.parentDocId);
}

export function pushFileToTimelineQueue(queue, entityId) {
  if (!entityId) return queue;
  if (queue.includes(entityId)) return queue;
  return [...queue, entityId];
}

/** Union doc-wire removal ledger (× on rail — survives hydrate). */
export function mergeTimelineExcludedFileIds(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const id of list) {
      const key = String(id || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function addToTimelineExcludedFileIds(excluded, entityId) {
  if (!entityId) return Array.isArray(excluded) ? excluded : [];
  const prev = Array.isArray(excluded) ? excluded : [];
  if (prev.includes(entityId)) return prev;
  return [...prev, entityId];
}

export function removeFromTimelineExcludedFileIds(excluded, entityId) {
  if (!entityId) return Array.isArray(excluded) ? excluded : [];
  return (Array.isArray(excluded) ? excluded : []).filter((id) => id !== entityId);
}

/** Drop files the user removed from the doc-wire rail (does not delete the document). */
export function filterTimelineFileQueue(queue, excludedFileIds = []) {
  if (!Array.isArray(queue)) return [];
  const drop = new Set(
    (Array.isArray(excludedFileIds) ? excludedFileIds : []).filter(Boolean),
  );
  if (!drop.size) return queue;
  return queue.filter((id) => !drop.has(id));
}

/**
 * Pick one doc-wire queue on hydrate — never union stale remote/local copies.
 * Prefers live (in-memory) → localStorage → Supabase payload when non-empty.
 */
export function pickTimelineFileQueueOnHydrate(...queues) {
  for (const queue of queues) {
    if (Array.isArray(queue) && queue.length > 0) return [...queue];
  }
  for (const queue of queues) {
    if (Array.isArray(queue)) return [...queue];
  }
  return [];
}

/**
 * Resolve doc-wire queue after hydrate: one source + removal ledger + existing nodes.
 */
export function resolveTimelineFileQueueOnHydrate({
  liveQueue = [],
  localQueue = [],
  remoteQueue = [],
  liveExcluded = [],
  localExcluded = [],
  remoteExcluded = [],
  nodeIds = [],
} = {}) {
  const excluded = mergeTimelineExcludedFileIds(liveExcluded, localExcluded, remoteExcluded);
  const preferred = pickTimelineFileQueueOnHydrate(liveQueue, localQueue, remoteQueue);
  const withoutRemoved = filterTimelineFileQueue(preferred, excluded);
  return {
    timelineFileQueue: filterTimelineFileQueueToExistingNodes(withoutRemoved, nodeIds),
    timelineExcludedFileIds: excluded,
  };
}

/**
 * Display date for a file on the rail.
 * Real schedule (`anchorAt`) when present; otherwise today (no commitment).
 * @returns {{ date: Date, unscheduled: boolean } | null}
 */
export function resolveFileRailDisplayDate(entity, today = new Date()) {
  if (!entity) return null;
  const scheduled = parseDate(entity.anchorAt);
  if (scheduled) return { date: scheduled, unscheduled: false };
  const day = startOfCalendarDay(today instanceof Date ? today : new Date());
  return { date: day, unscheduled: true };
}
