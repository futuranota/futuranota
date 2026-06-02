import {
  noteToTrackItem,
  resolveNodeAnchorDate,
  startOfCalendarDay,
} from "../temporal.js";
import { buildTacticalWireAnchorMap, sortNodeIdsByTimelineAnchor } from "./timelineAnchors.js";
import {
  resolveObjectStroke,
  softColorFromStroke,
  isCorpusColor,
  resolveCanvasNodeObjectId,
} from "./objectColors.js";

/**
 * @typedef {Object} TimelineChainAnchor
 * @property {string} nodeId
 * @property {Date} date
 */

/**
 * @typedef {Object} TimelineChainRow
 * @property {string} id
 * @property {string} objectId
 * @property {string} objectColor
 * @property {string} colorSoft
 * @property {boolean} isCorpus
 * @property {string} label
 * @property {string[]} nodeIds
 * @property {TimelineChainAnchor[]} anchors
 * @property {string[]} linkedChainIds
 * @property {boolean} hasCrossObjectLink
 */

/**
 * @typedef {Object} TimelineGrid
 * @property {Date} start
 * @property {Date} end
 * @property {Date[]} markers
 * @property {(d: Date) => number} pct
 * @property {number} todayPct
 */

function canvasNodeToTrackItem(node, nodeEntitiesById) {
  const base = {
    id: node.id,
    noteId: node.noteId,
    docId: node.docId,
    canvasKind: node.canvasKind,
    objectId: node.objectId || null,
  };
  if (node.noteId && nodeEntitiesById[node.noteId]) {
    const source = nodeEntitiesById[node.noteId];
    return noteToTrackItem({
      ...base,
      title: source.sourceQuery || source.title || node.title,
      dataType: source.dataType || node.dataType || "text",
      content: source.content ?? node.content ?? "",
      anchorAt: source.anchorAt ?? node.anchorAt ?? null,
    });
  }
  return noteToTrackItem({
    ...base,
    title: node.title,
    dataType: node.dataType || "text",
    content: node.content ?? "",
    anchorAt: node.anchorAt ?? null,
  });
}

function buildAdjacency(connections, nodeIdSet) {
  const adj = new Map();
  const addEdge = (a, b) => {
    if (!nodeIdSet.has(a) || !nodeIdSet.has(b)) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  for (const c of connections) {
    if (c.from && c.to) addEdge(c.from, c.to);
  }
  return adj;
}

function connectedComponents(nodeIds, adj) {
  const remaining = new Set(nodeIds);
  const components = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    const stack = [start];
    const comp = [];
    remaining.delete(start);
    while (stack.length) {
      const id = stack.pop();
      comp.push(id);
      for (const next of adj.get(id) || []) {
        if (remaining.has(next)) {
          remaining.delete(next);
          stack.push(next);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

export function buildTimelineGrid(anchorDates, today) {
  const dates = [startOfCalendarDay(today)];
  for (const d of anchorDates) {
    if (d) dates.push(startOfCalendarDay(d));
  }

  const padMs = 6 * 86400000;
  const fallbackPad = 14 * 86400000;

  if (dates.length <= 1) {
    const start = new Date(today.getTime() - fallbackPad);
    const end = new Date(today.getTime() + fallbackPad);
    const total = end - start || 1;
    const pct = (d) => ((startOfCalendarDay(d) - start) / total) * 100;
    return {
      start,
      end,
      markers: [],
      pct,
      todayPct: Math.min(100, Math.max(0, pct(today))),
    };
  }

  const sorted = [...dates].sort((a, b) => a - b);
  const minD = sorted[0];
  const maxD = sorted[sorted.length - 1];
  const start = new Date(Math.min(minD.getTime(), today.getTime()) - padMs);
  const end = new Date(Math.max(maxD.getTime(), today.getTime()) + padMs);
  const total = end - start || 1;
  const pct = (d) => ((startOfCalendarDay(d) - start) / total) * 100;

  const markerSet = new Map();
  for (const d of sorted) {
    const key = startOfCalendarDay(d).getTime();
    if (!markerSet.has(key)) markerSet.set(key, startOfCalendarDay(d));
  }
  const markers = [...markerSet.values()].sort((a, b) => a - b);

  return {
    start,
    end,
    markers,
    pct,
    todayPct: Math.min(100, Math.max(0, pct(today))),
  };
}

/**
 * @param {Object} params
 * @returns {{ grid: TimelineGrid, chains: TimelineChainRow[], trackItemsById: Map<string, object>, wireAnchors: Map<string, Date>, emptyObjectTracks: object[], classifiedConnections: import('../types/timelineTactical.js').ClassifiedConnection[], crossFamilyDocPairKeys: Set<string> }}
 */
export function buildTimelineChains({
  canvasNodes = [],
  connections = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  objectTimelineTitles = {},
  today = new Date(),
  filterObjectId = null,
  inheritObjMode = false,
  primaryTimelineObjectId = null,
}) {
  const meta = { nodeEntitiesById, docsById, objectsById };
  const trackItemsById = new Map();
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));

  for (const node of canvasNodes) {
    trackItemsById.set(node.id, canvasNodeToTrackItem(node, nodeEntitiesById));
  }

  const allTrackItems = [...trackItemsById.values()];
  const {
    anchors: wireAnchors,
    classifiedConnections,
    crossFamilyDocPairKeys,
  } = buildTacticalWireAnchorMap(allTrackItems, connections, meta, {
    inheritObjMode,
    primaryTimelineObjectId,
  });

  const anchoredIds = [];
  for (const item of allTrackItems) {
    const d = wireAnchors.get(item.id) || resolveNodeAnchorDate(item, meta);
    if (d) anchoredIds.push(item.id);
  }

  const anchoredSet = new Set(anchoredIds);
  const adj = buildAdjacency(connections, anchoredSet);
  const components = connectedComponents(anchoredIds, adj);

  /** @type {TimelineChainRow[]} */
  const chains = [];

  components.forEach((comp, compIdx) => {
    const byObject = new Map();
    for (const nodeId of comp) {
      const objectId = resolveCanvasNodeObjectId(
        nodeById.get(nodeId),
        docsById,
        nodeEntitiesById,
      );
      if (!objectId) continue;
      if (!byObject.has(objectId)) byObject.set(objectId, []);
      byObject.get(objectId).push(nodeId);
    }

    for (const [objectId, nodeIds] of byObject) {
      if (filterObjectId && objectId !== filterObjectId) continue;

      const sortedIds = sortNodeIdsByTimelineAnchor(nodeIds, nodeById, wireAnchors, meta);

      /** @type {TimelineChainAnchor[]} */
      const anchors = sortedIds.map((nodeId) => ({
        nodeId,
        date: wireAnchors.get(nodeId) || resolveNodeAnchorDate(trackItemsById.get(nodeId), meta),
      }));

      const obj = objectsById[objectId];
      const stroke = resolveObjectStroke(obj);
      const chainId = `chain-${compIdx}-${objectId}`;
      const label =
        (objectTimelineTitles[objectId] || "").trim()
        || obj?.name
        || "Timeline";

      const row = {
        id: chainId,
        objectId,
        objectColor: stroke,
        colorSoft: softColorFromStroke(stroke),
        isCorpus: isCorpusColor(stroke) || obj?.role === "corpus",
        label,
        nodeIds: sortedIds,
        anchors,
        linkedChainIds: [],
        hasCrossObjectLink: false,
      };

      chains.push(row);
    }
  });

  for (const c of connections) {
    if (!anchoredSet.has(c.from) || !anchoredSet.has(c.to)) continue;
    const fromItem = trackItemsById.get(c.from);
    const toItem = trackItemsById.get(c.to);
    const fromNode = canvasNodes.find((n) => n.id === c.from);
    const toNode = canvasNodes.find((n) => n.id === c.to);
    const fromObjectId = resolveCanvasNodeObjectId(fromNode || fromItem, docsById, nodeEntitiesById);
    const toObjectId = resolveCanvasNodeObjectId(toNode || toItem, docsById, nodeEntitiesById);
    if (!fromObjectId || !toObjectId || fromObjectId === toObjectId) continue;

    const fromChain = chains.find(
      (ch) => ch.objectId === fromObjectId && ch.nodeIds.includes(c.from),
    );
    const toChain = chains.find(
      (ch) => ch.objectId === toObjectId && ch.nodeIds.includes(c.to),
    );
    if (!fromChain || !toChain || fromChain.id === toChain.id) continue;

    fromChain.hasCrossObjectLink = true;
    toChain.hasCrossObjectLink = true;
    if (!fromChain.linkedChainIds.includes(toChain.id)) {
      fromChain.linkedChainIds.push(toChain.id);
    }
    if (!toChain.linkedChainIds.includes(fromChain.id)) {
      toChain.linkedChainIds.push(fromChain.id);
    }
  }

  const allAnchorDates = chains.flatMap((ch) => ch.anchors.map((a) => a.date));
  const grid = buildTimelineGrid(allAnchorDates, today);

  const chainObjectIds = new Set(chains.map((c) => c.objectId));
  const emptyObjectTracks = Object.values(objectsById)
    .filter((obj) => {
      if (filterObjectId && obj.id !== filterObjectId) return false;
      return !chainObjectIds.has(obj.id);
    })
    .map((obj) => {
      const stroke = resolveObjectStroke(obj);
      return {
        id: obj.id,
        label: (objectTimelineTitles[obj.id] || "").trim() || obj.name || "Timeline",
        color: { stroke, soft: softColorFromStroke(stroke) },
        isCorpus: isCorpusColor(stroke) || obj?.role === "corpus",
        onEditTitle: null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  chains.sort((a, b) => {
    const ta = a.anchors[0]?.date?.getTime() || 0;
    const tb = b.anchors[0]?.date?.getTime() || 0;
    if (ta !== tb) return ta - tb;
    return a.label.localeCompare(b.label);
  });

  return {
    grid,
    chains,
    trackItemsById,
    wireAnchors,
    emptyObjectTracks,
    classifiedConnections,
    crossFamilyDocPairKeys,
  };
}
