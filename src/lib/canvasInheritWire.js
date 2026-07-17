/**
 * Canvas helpers for cross-company (inherit) wire UX.
 */

import { daysBetween } from "../data.jsx";
import {
  parseDate,
  resolveNodeAnchorDate,
  startOfCalendarDay,
} from "../temporal.js";
import {
  isTimelineDateCanvasNode,
  resolveTimelineDateNodeDate,
} from "./campaignTimelineRail.js";
import { formatNowUntilScheduleLabel } from "./docSchedule.js";
import { resolveCanvasNodeObjectId } from "./objectColors.js";
import {
  classifyCanvasConnection,
  isCrossFamilyConnectionKind,
  isTacticalDocumentNode,
} from "./timelineGraph.js";
import { resolveHostGuestSides } from "./timelineInheritance.js";

/** @param {object | null | undefined} node */
export function isCanvasLaunchOrDateNode(node) {
  return Boolean(node && isTimelineDateCanvasNode(node));
}

/** Document/folder card ↔ Launch/date chip (not two docs). */
export function isFolderLaunchNodePair(a, b) {
  if (!a || !b) return false;
  const aDoc = isTacticalDocumentNode(a);
  const bDoc = isTacticalDocumentNode(b);
  const aLaunch = isCanvasLaunchOrDateNode(a);
  const bLaunch = isCanvasLaunchOrDateNode(b);
  return (aDoc && bLaunch) || (aLaunch && bDoc);
}

/**
 * Days-remaining / status label from now → launch (never a fake same-day doc gap).
 * @param {Date} launchDate
 * @param {Date} [now]
 * @returns {string | null}
 */
export function formatLaunchCountdownLabel(launchDate, now = new Date()) {
  if (!(launchDate instanceof Date) || Number.isNaN(launchDate.getTime())) return null;
  const pending = formatNowUntilScheduleLabel({
    target: launchDate,
    now,
    hasExplicitTime: true,
  });
  if (pending?.singleLine) return pending.singleLine;
  const dayDelta = daysBetween(startOfCalendarDay(now), startOfCalendarDay(launchDate));
  if (dayDelta === 0) return "today";
  if (dayDelta < 0) return "Past due";
  return `Pending ${dayDelta} day${dayDelta === 1 ? "" : "s"}`;
}

/**
 * @param {object} node
 * @param {object} [meta]
 * @returns {Date | null}
 */
function resolveLaunchNodeDate(node, meta = {}) {
  if (!node) return null;
  return resolveTimelineDateNodeDate(node)
    || resolveNodeAnchorDate(node, meta)
    || (node.dataType === "date" ? parseDate(node.content) : null);
}

/**
 * True when this document/folder card should show center (top/bottom) ports.
 * @param {object} node
 * @param {object} opts
 */
export function shouldShowCrossFamilyCenterPorts(node, {
  inheritObjMode = false,
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  connectingFromId = null,
  rewiring = null,
  connections = [],
  objectsById = {},
} = {}) {
  if (!inheritObjMode || !node) return false;
  const isDoc = isTacticalDocumentNode(node) || node.dataType === "date" || node.canvasKind === "launch";
  if (!isDoc) return false;

  const myObjectId = resolveCanvasNodeObjectId(node, docsById, nodeEntitiesById);
  if (!myObjectId) return false;

  // In-progress connect already classified as cross-family involving this node.
  if (connectingFromId && connectingFromId !== node.id) {
    const classified = classifyCanvasConnection(
      { id: "draft", from: connectingFromId, to: node.id },
      new Map(canvasNodes.map((n) => [n.id, n])),
      docsById,
      nodeEntitiesById,
      objectsById,
    );
    if (isCrossFamilyConnectionKind(classified.kind)) return true;
  }
  if (connectingFromId === node.id) {
    // Starting from this node — show center ports if another family exists on canvas.
    const hasOtherFamily = canvasNodes.some((n) => {
      if (n.id === node.id || n.hidden) return false;
      if (!(isTacticalDocumentNode(n) || n.dataType === "date" || n.canvasKind === "launch")) return false;
      const oid = resolveCanvasNodeObjectId(n, docsById, nodeEntitiesById);
      return oid && oid !== myObjectId;
    });
    if (hasOtherFamily) return true;
  }

  if (rewiring) {
    const c = connections.find((x) => x.id === rewiring.connId);
    if (c) {
      const classified = classifyCanvasConnection(
        c,
        new Map(canvasNodes.map((n) => [n.id, n])),
        docsById,
        nodeEntitiesById,
        objectsById,
      );
      if (isCrossFamilyConnectionKind(classified.kind)) {
        if (c.from === node.id || c.to === node.id) return true;
      }
    }
  }

  // Idle: show when another company's folder/date is visible on the canvas.
  return canvasNodes.some((n) => {
    if (n.id === node.id || n.hidden) return false;
    if (!(isTacticalDocumentNode(n) || n.dataType === "date" || n.canvasKind === "launch")) return false;
    const oid = resolveCanvasNodeObjectId(n, docsById, nodeEntitiesById);
    return oid && oid !== myObjectId;
  });
}

/**
 * Force cross-family wire direction: from = Corpus authority host, to = guest.
 * @returns {{ from: string, to: string }}
 */
export function normalizeCrossFamilyConnectionEndpoints(
  fromId,
  toId,
  {
    canvasNodes = [],
    docsById = {},
    nodeEntitiesById = {},
    objectsById = {},
    primaryObjectId = null,
  } = {},
) {
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const classified = classifyCanvasConnection(
    { id: "draft", from: fromId, to: toId },
    nodeById,
    docsById,
    nodeEntitiesById,
    objectsById,
  );
  if (!isCrossFamilyConnectionKind(classified.kind) || !primaryObjectId) {
    return { from: fromId, to: toId };
  }
  const sides = resolveHostGuestSides(classified, primaryObjectId);
  if (!sides) return { from: fromId, to: toId };
  return { from: sides.hostNodeId, to: sides.guestNodeId };
}

/**
 * Wire label for canvas connections: suppress inherit day-gaps; folder→Launch uses countdown.
 * Falls back to `computeEdgeTemporalLabel` for normal wires.
 * @returns {string | null}
 */
export function resolveCanvasWireTemporalLabel(
  fromNode,
  toNode,
  today,
  allNodes,
  allConnections,
  blueprints,
  meta,
  computeEdgeTemporalLabel,
) {
  if (!fromNode || !toNode) return null;
  const {
    docsById = {},
    nodeEntitiesById = {},
    objectsById = {},
  } = meta || {};

  const classified = classifyCanvasConnection(
    { id: "label", from: fromNode.id, to: toNode.id },
    new Map((allNodes || []).map((n) => [n.id, n])),
    docsById,
    nodeEntitiesById,
    objectsById,
  );
  if (isCrossFamilyConnectionKind(classified.kind)) {
    return null;
  }

  if (isFolderLaunchNodePair(fromNode, toNode)) {
    const launchNode = isCanvasLaunchOrDateNode(fromNode) ? fromNode : toNode;
    const launchDate = resolveLaunchNodeDate(launchNode, meta);
    if (launchDate) return formatLaunchCountdownLabel(launchDate, today || new Date());
  }

  if (typeof computeEdgeTemporalLabel !== "function") return null;
  return computeEdgeTemporalLabel(
    fromNode,
    toNode,
    today,
    allNodes,
    allConnections,
    blueprints,
    meta,
  );
}
