import {
  buildWireAnchorMap,
  resolveNodeAnchorDate,
  startOfCalendarDay,
} from "../temporal.js";
import {
  CONNECTION_KIND_CROSS_FAMILY_DOC,
  CONNECTION_KIND_CROSS_FAMILY_DATE,
  buildClassifiedConnections,
  indexCrossFamilyDocPairs,
} from "./timelineGraph.js";
import { resolvePrimarySecondarySides } from "./timelinePrimary.js";

/**
 * @param {object} node
 * @param {Map<string, Date>} wireAnchors
 * @param {{ nodeEntitiesById?: Record<string, object>, docsById?: Record<string, object> }} meta
 */
export function resolveTimelineAnchor(node, wireAnchors, meta = {}) {
  if (!node) return null;
  const wired = wireAnchors.get(node.id);
  if (wired) return wired;
  const direct = resolveNodeAnchorDate(node, meta);
  return direct ? startOfCalendarDay(direct) : null;
}

/**
 * @param {object} node
 * @param {Map<string, Date>} wireAnchors
 * @param {{ nodeEntitiesById?: Record<string, object>, docsById?: Record<string, object> }} meta
 */
export function nodeHasTimelineAnchor(node, wireAnchors, meta = {}) {
  return Boolean(resolveTimelineAnchor(node, wireAnchors, meta));
}

/**
 * Cross-family inherit: secondary adopts primary timeline anchor (not creation order).
 * @param {string|null} [primaryTimelineObjectId]
 */
export function inheritAnchorFromConnection(
  anchors,
  classified,
  nodeById,
  meta = {},
  primaryTimelineObjectId = null,
) {
  if (
    classified.kind !== CONNECTION_KIND_CROSS_FAMILY_DOC
    && classified.kind !== CONNECTION_KIND_CROSS_FAMILY_DATE
  ) {
    return anchors;
  }

  const from = nodeById.get(classified.from);
  const to = nodeById.get(classified.to);
  if (!from || !to) return anchors;

  const { primarySide, secondarySide } = resolvePrimarySecondarySides(
    classified.fromObjectId,
    classified.toObjectId,
    primaryTimelineObjectId,
  );

  if (primarySide && secondarySide) {
    const primaryNode = primarySide === "from" ? from : to;
    const secondaryNode = secondarySide === "from" ? from : to;
    const primaryAnchor = resolveTimelineAnchor(primaryNode, anchors, meta);
    if (primaryAnchor) {
      anchors.set(secondaryNode.id, primaryAnchor);
    }
    return anchors;
  }

  const fromHas = nodeHasTimelineAnchor(from, anchors, meta);
  const toHas = nodeHasTimelineAnchor(to, anchors, meta);
  if (fromHas && !toHas) {
    const da = resolveTimelineAnchor(from, anchors, meta);
    if (da) anchors.set(to.id, da);
  } else if (toHas && !fromHas) {
    const db = resolveTimelineAnchor(to, anchors, meta);
    if (db) anchors.set(from.id, db);
  }
  return anchors;
}

/**
 * @param {object[]} nodes
 * @param {object[]} connections
 * @param {{ nodeEntitiesById?: Record<string, object>, docsById?: Record<string, object> }} meta
 * @param {{ inheritObjMode?: boolean, primaryTimelineObjectId?: string|null }} [options]
 * @returns {import('../types/timelineTactical.js').TacticalWireAnchorResult}
 */
export function buildTacticalWireAnchorMap(nodes, connections, meta = {}, options = {}) {
  const { inheritObjMode = false, primaryTimelineObjectId = null } = options;
  const classifiedConnections = buildClassifiedConnections(
    connections,
    nodes,
    meta.docsById,
    meta.nodeEntitiesById,
    meta.objectsById || {},
  );
  const { keys: crossFamilyDocPairKeys } = indexCrossFamilyDocPairs(classifiedConnections);

  let anchors = buildWireAnchorMap(nodes, connections, meta);

  if (inheritObjMode) {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    for (const c of classifiedConnections) {
      if (
        c.kind !== CONNECTION_KIND_CROSS_FAMILY_DOC
        && c.kind !== CONNECTION_KIND_CROSS_FAMILY_DATE
      ) continue;
      inheritAnchorFromConnection(anchors, c, nodeById, meta, primaryTimelineObjectId);
    }
  }

  return {
    anchors,
    classifiedConnections,
    crossFamilyDocPairKeys,
    primaryTimelineObjectId: primaryTimelineObjectId || null,
  };
}

/**
 * Sort node ids by effective timeline anchor (past → future, ascending time).
 * @param {string[]} nodeIds
 * @param {Map<string, object>} nodeById
 * @param {Map<string, Date>} wireAnchors
 * @param {{ nodeEntitiesById?: Record<string, object>, docsById?: Record<string, object> }} meta
 */
export function sortNodeIdsByTimelineAnchor(nodeIds, nodeById, wireAnchors, meta = {}) {
  return [...nodeIds].sort((a, b) => {
    const na = nodeById.get(a);
    const nb = nodeById.get(b);
    const ta = resolveTimelineAnchor(na, wireAnchors, meta)?.getTime() || 0;
    const tb = resolveTimelineAnchor(nb, wireAnchors, meta)?.getTime() || 0;
    if (ta !== tb) return ta - tb;
    return a.localeCompare(b);
  });
}
