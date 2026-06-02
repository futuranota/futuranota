import { parseDate, resolveNodeAnchorDate, startOfCalendarDay } from "../temporal.js";
import { resolveObjectStroke, softColorFromStroke } from "./objectColors.js";
import { buildTimelineChains } from "./timelineChains.js";
import { listChildCanvasNodeIdsForDoc } from "./timelineGraph.js";

function isDocumentNode(node, item) {
  const n = node || item;
  return n?.canvasKind === "document" || n?.dataType === "document";
}

/**
 * Group markers into chronological columns (same calendar day → vertical stack).
 * @param {Array<{ nodeId: string, date: Date, docId?: string, virtual?: boolean, dataType?: string }>} markers
 */
export function buildTimelineColumns(markers) {
  const sorted = [...markers].sort((a, b) => a.date.getTime() - b.date.getTime());
  /** @type {Map<number, { columnKey: string, date: Date, items: object[] }>} */
  const byDay = new Map();

  for (const marker of sorted) {
    const dayTs = marker.date.getTime();
    const existing = byDay.get(dayTs);
    if (existing) {
      existing.items.push(marker);
      continue;
    }
    byDay.set(dayTs, {
      columnKey: String(dayTs),
      date: marker.date,
      items: [marker],
    });
  }

  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * @param {string} docId
 */
export function resolveDocTimelineDate(
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

/**
 * Build per-object timeline rows (docs first; optional child drill-down rows).
 * @param {Object} params
 */
export function buildTacticalObjectRows(params) {
  const {
    canvasNodes = [],
    connections = [],
    docsById = {},
    nodeEntitiesById = {},
    objectsById = {},
    objectTimelineTitles = {},
    timelineDocQueue = [],
    expandedDocIds = [],
    today = new Date(),
    filterObjectId = null,
    inheritObjMode = false,
    primaryTimelineObjectId = null,
  } = params;

  const tactical = buildTimelineChains({
    canvasNodes,
    connections,
    docsById,
    nodeEntitiesById,
    objectsById,
    objectTimelineTitles,
    today,
    filterObjectId,
    inheritObjMode,
    primaryTimelineObjectId,
  });

  const { chains, wireAnchors, trackItemsById } = tactical;
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const meta = { nodeEntitiesById, docsById, objectsById };

  const objectIds = [];
  const seenObj = new Set();
  const addObjectId = (objectId) => {
    if (!objectId || seenObj.has(objectId)) return;
    if (filterObjectId && objectId !== filterObjectId) return;
    seenObj.add(objectId);
    objectIds.push(objectId);
  };

  for (const docId of timelineDocQueue) {
    addObjectId(docsById[docId]?.parentObjectId);
  }
  for (const ch of chains) addObjectId(ch.objectId);

  const chainByObjectId = new Map();
  for (const ch of chains) {
    if (!chainByObjectId.has(ch.objectId)) chainByObjectId.set(ch.objectId, ch);
  }

  /** @type {object[]} */
  const displayRows = [];

  for (const objectId of objectIds) {
    const chain = chainByObjectId.get(objectId);
    const obj = objectsById[objectId];
    const objectName = (objectTimelineTitles[objectId] || "").trim() || obj?.name || "Object";
    const objectColor = chain?.objectColor || resolveObjectStroke(obj);
    const colorSoft = chain?.colorSoft || softColorFromStroke(objectColor);
    const isPrimary = Boolean(primaryTimelineObjectId && objectId === primaryTimelineObjectId);

    /** @type {Map<string, { nodeId: string, date: Date, docId?: string, virtual?: boolean, dataType?: string }>} */
    const markerByKey = new Map();

    if (chain) {
      for (const { nodeId, date } of chain.anchors) {
        const item = trackItemsById.get(nodeId);
        const node = nodeById.get(nodeId);
        if (!isDocumentNode(node, item)) continue;
        const docId = node?.docId || node?.noteId || item?.docId;
        markerByKey.set(nodeId, {
          nodeId,
          date: wireAnchors.get(nodeId) || date,
          docId,
          dataType: "document",
        });
      }
    }

    for (const docId of timelineDocQueue) {
      if (docsById[docId]?.parentObjectId !== objectId) continue;
      const canvasDoc = canvasNodes.find(
        (n) => (n.docId || n.noteId) === docId && isDocumentNode(n),
      );
      if (canvasDoc && markerByKey.has(canvasDoc.id)) continue;
      const date = resolveDocTimelineDate(docId, canvasNodes, wireAnchors, docsById, meta);
      if (!date) continue;
      const key = canvasDoc?.id || `virtual-${docId}`;
      markerByKey.set(key, {
        nodeId: canvasDoc?.id || key,
        date,
        docId,
        virtual: !canvasDoc,
        dataType: "document",
      });
    }

    const docMarkers = [...markerByKey.values()];
    const columns = buildTimelineColumns(docMarkers);

    displayRows.push({
      id: `object-${objectId}`,
      rowKind: "object",
      objectId,
      objectName,
      label: objectName,
      objectColor,
      colorSoft,
      isCorpus: chain?.isCorpus || obj?.role === "corpus",
      isPrimary,
      isInheritLayer: Boolean(inheritObjMode && chain?.hasCrossObjectLink && !isPrimary),
      hasCrossLink: Boolean(chain?.hasCrossObjectLink),
      columns,
      chain,
    });

    for (const docId of expandedDocIds) {
      if (docsById[docId]?.parentObjectId !== objectId) continue;
      const childMarkers = [];
      for (const nodeId of listChildCanvasNodeIdsForDoc(docId, canvasNodes, nodeEntitiesById)) {
        const node = nodeById.get(nodeId);
        const item = trackItemsById.get(nodeId);
        const raw = wireAnchors.get(nodeId) || resolveNodeAnchorDate(item || node, meta);
        if (!raw) continue;
        childMarkers.push({
          nodeId,
          date: startOfCalendarDay(raw),
          docId,
          dataType: node?.dataType || item?.dataType || "text",
        });
      }
      if (!childMarkers.length) continue;
      displayRows.push({
        id: `children-${docId}`,
        rowKind: "children",
        objectId,
        parentDocId: docId,
        objectName: (docsById[docId]?.title || "Document").trim(),
        label: (docsById[docId]?.title || "Document").trim(),
        objectColor,
        colorSoft,
        columns: buildTimelineColumns(childMarkers),
      });
    }
  }

  const primaryRows = displayRows.filter((r) => r.rowKind === "object" && !r.isInheritLayer);
  const inheritRows = displayRows.filter((r) => r.rowKind === "object" && r.isInheritLayer);
  const childRows = displayRows.filter((r) => r.rowKind === "children");
  const orderedRows = [...primaryRows, ...inheritRows, ...childRows];

  return {
    ...tactical,
    displayRows: orderedRows,
  };
}
