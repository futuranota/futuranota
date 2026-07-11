import { daysBetween } from "../data.jsx";
import {
  applyAutoZoomForQueue,
  applyTacticalRangeOverride,
  resolveTacticalGridBaseBounds,
} from "./tacticalTimelineRange.js";
import {
  parseDate,
  resolveNodeAnchorDate,
  sameCalendarDay,
  startOfCalendarDay,
} from "../temporal.js";
import { resolveObjectStroke, softColorFromStroke } from "./objectColors.js";
import { buildTimelineChains } from "./timelineChains.js";
import {
  CONNECTION_KIND_CROSS_FAMILY_DOC,
  CONNECTION_KIND_INTRA_FAMILY_DOC,
} from "./timelineGraph.js";
import {
  resolveQueuedDocTimelineDate,
  buildChildMarkersForDoc,
} from "./timelineDocSnapshot.js";

/** Doc↔doc wires that draw the temporal dimension band (any family). */
const DOC_WIRE_DIMENSION_KINDS = new Set([
  CONNECTION_KIND_INTRA_FAMILY_DOC,
  CONNECTION_KIND_CROSS_FAMILY_DOC,
]);

/**
 * First / last calendar day of the month containing `date`.
 */
export function startOfCalendarMonth(date) {
  return startOfCalendarDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfCalendarMonth(date) {
  return startOfCalendarDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

const TACTICAL_GRID_PAD_DAYS = 2;

function buildGridTicks(start, end, pct, spanDays) {
  const ticks = [];
  const step = spanDays > 62 ? 7 : spanDays > 31 ? 3 : 1;
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    const dayOfMonth = cur.getDate();
    ticks.push({
      leftPct: pct(cur),
      major: step === 1 ? dayOfMonth === 1 || dayOfMonth % 5 === 0 : dayOfMonth === 1,
    });
    cur.setDate(cur.getDate() + step);
  }
  return ticks;
}

/**
 * Timeline scale:
 * - Few folders (<4): tight window around markers so 1-day gaps stay readable.
 * - Many folders: month floor / fit-all (zoomed out), then auto-widen if crowded.
 * @param {Date[]} markerDates
 * @param {Date} today
 * @param {{ rangeOverride?: { startMs?: number | null, endMs?: number | null } | null, queueDocCount?: number }} [options]
 */
export function buildTacticalDisplayGrid(markerDates, today, options = {}) {
  const { rangeOverride = null, queueDocCount = 0 } = options;
  let { start, end } = resolveTacticalGridBaseBounds(markerDates, today, { queueDocCount });
  ({ start, end } = applyAutoZoomForQueue(start, end, markerDates, queueDocCount));
  ({ start, end } = applyTacticalRangeOverride(start, end, rangeOverride));

  const normalized = markerDates.filter(Boolean).map((d) => startOfCalendarDay(d));
  const todayDay = startOfCalendarDay(today);
  const monthStart = startOfCalendarMonth(today);
  const monthEnd = endOfCalendarMonth(today);

  const total = end.getTime() - start.getTime() || 86400000;
  const pct = (d) => {
    const day = startOfCalendarDay(d);
    return Math.min(100, Math.max(0, ((day.getTime() - start.getTime()) / total) * 100));
  };
  const spanDays = Math.max(1, Math.round(total / 86400000));

  const markerSet = new Map();
  for (const d of [...normalized, todayDay]) {
    markerSet.set(d.getTime(), d);
  }
  const markers = [...markerSet.values()].sort((a, b) => a - b);

  return {
    start,
    end,
    pct,
    todayPct: pct(today),
    today: todayDay,
    spanDays,
    monthStart,
    monthEnd,
    markers,
    ticks: buildGridTicks(start, end, pct, spanDays),
  };
}

/**
 * Label between two anchor dates (matches canvas ConnLabel / computeEdgeTemporalLabel).
 * @param {Date} fromDate
 * @param {Date} toDate
 */
export function formatTimelineSpanLabel(fromDate, toDate) {
  if (sameCalendarDay(fromDate, toDate)) return "same day";
  return `${Math.abs(daysBetween(fromDate, toDate))}d`;
}

/**
 * Index doc markers across all object rows (for cross-family dimension spans).
 * @param {object[]} orderedRows
 */
function buildMarkerColumnIndexFromRows(orderedRows) {
  /** @type {Map<string, { columnKey: string, date: Date }>} */
  const index = new Map();
  for (const row of orderedRows) {
    if (row.rowKind !== "object") continue;
    for (const col of row.columns || []) {
      for (const item of col.items) {
        if (item.dataType && item.dataType !== "document") continue;
        index.set(item.nodeId, col);
        if (item.docId) {
          index.set(item.docId, col);
          index.set(`virtual-${item.docId}`, col);
        }
      }
    }
  }
  return index;
}

function buildDimensionSegmentBetweenColumns(fromCol, toCol, grid) {
  const fromPct = grid.pct(fromCol.date);
  const toPct = grid.pct(toCol.date);
  const leftPct = Math.min(fromPct, toPct);
  const widthPct = Math.max(Math.abs(toPct - fromPct), 0.5);
  const fromDate = fromCol.date;
  const toDate = toCol.date;
  const start = fromDate.getTime() <= toDate.getTime() ? fromDate : toDate;
  const end = fromDate.getTime() <= toDate.getTime() ? toDate : fromDate;
  return {
    key: `doc-link-${fromCol.columnKey}-${toCol.columnKey}`,
    leftPct,
    widthPct,
    label: formatTimelineSpanLabel(start, end),
    isDocDimension: true,
  };
}

/**
 * Full-row dimension band from first milestone (start) to last (endpoint).
 * Shrinks proportionally when the visible grid is zoomed in.
 * @param {ReturnType<typeof buildTimelineColumns>} columns
 * @param {ReturnType<typeof buildTacticalDisplayGrid>} grid
 */
export function buildRowEndpointSpanSegment(columns, grid) {
  if (!columns?.length || !grid) return null;

  if (columns.length === 1) {
    const pct = grid.pct(columns[0].date);
    return {
      key: `row-endpoint-${columns[0].columnKey}`,
      leftPct: pct,
      widthPct: 0.5,
      label: formatTimelineSpanLabel(columns[0].date, columns[0].date),
      isRowEndpointSpan: true,
    };
  }

  const first = columns[0];
  const last = columns[columns.length - 1];
  const segment = buildDimensionSegmentBetweenColumns(first, last, grid);
  return {
    ...segment,
    key: `row-endpoints-${first.columnKey}-${last.columnKey}`,
    isDocDimension: false,
    isRowEndpointSpan: true,
  };
}

/**
 * Center pct for the "days left" label within the row endpoint span.
 * @param {{ leftPct: number }[]} nodeGroups
 */
export function resolveDaysLeftCenterPct(nodeGroups) {
  if (!nodeGroups.length) return 50;
  const firstPct = nodeGroups[0].leftPct;
  const lastPct = nodeGroups[nodeGroups.length - 1].leftPct;
  return firstPct + (lastPct - firstPct) / 2;
}

/**
 * Hide dimension fill from span start → today; only today → end stays colored.
 * @param {ReturnType<typeof buildDimensionSegmentBetweenColumns>} segment
 * @param {ReturnType<typeof buildTacticalDisplayGrid>} grid
 * @param {Date} today
 */
export function clipDocDimensionSegmentFromToday(segment, grid, today) {
  if (!segment || !grid) return null;

  const todayDay = startOfCalendarDay(today);
  if (todayDay.getTime() < grid.start.getTime() || todayDay.getTime() > grid.end.getTime()) {
    return segment;
  }

  const todayPct = grid.todayPct;
  const segEnd = segment.leftPct + segment.widthPct;
  if (segEnd <= todayPct) return null;
  if (segment.leftPct >= todayPct) return segment;

  return {
    ...segment,
    leftPct: todayPct,
    widthPct: Math.max(segEnd - todayPct, 0.5),
  };
}

/**
 * Every doc↔doc wire on canvas → dimension band on each involved object row
 * (Product↔Content cross-family, same-family, etc.).
 * @param {object[]} orderedRows
 * @param {import('./timelineChains.js').TimelineGrid} grid
 * @param {import('../types/timelineTactical.js').ClassifiedConnection[]} classifiedConnections
 * @param {Date} [today]
 * @returns {Map<string, object[]>}
 */
export function buildDocDimensionSegmentsByRow(
  orderedRows,
  grid,
  classifiedConnections = [],
  today = new Date(),
) {
  /** @type {Map<string, object[]>} */
  const byRowId = new Map();
  for (const row of orderedRows) {
    if (row.rowKind === "object") byRowId.set(row.id, []);
  }

  const markerIndex = buildMarkerColumnIndexFromRows(orderedRows);
  const seenPair = new Set();

  for (const c of classifiedConnections) {
    if (!DOC_WIRE_DIMENSION_KINDS.has(c.kind)) continue;

    const fromCol = markerIndex.get(c.from)
      || (c.fromDocId ? markerIndex.get(c.fromDocId) : null);
    const toCol = markerIndex.get(c.to)
      || (c.toDocId ? markerIndex.get(c.toDocId) : null);
    if (!fromCol || !toCol || fromCol.columnKey === toCol.columnKey) continue;

    const pairKey = [fromCol.columnKey, toCol.columnKey].sort().join("|");
    if (seenPair.has(pairKey)) continue;
    seenPair.add(pairKey);

    const segment = buildDimensionSegmentBetweenColumns(fromCol, toCol, grid);
    const clipped = clipDocDimensionSegmentFromToday(segment, grid, today);
    if (!clipped) continue;

    for (const row of orderedRows) {
      if (row.rowKind !== "object") continue;
      if (row.objectId !== c.fromObjectId && row.objectId !== c.toObjectId) continue;
      const list = byRowId.get(row.id);
      if (list) list.push(clipped);
    }
  }

  return byRowId;
}

/**
 * Proportional rail layout for one row (node groups + doc-wire dimension spans).
 * @param {ReturnType<typeof buildTimelineColumns>} columns
 * @param {import('./timelineChains.js').TimelineGrid | null | undefined} grid
 * @param {{ segments?: object[] }} [options]
 */
/**
 * Parent doc chip → macronodo links for expanded docs (SVG overlay).
 * @param {object[]} orderedRows
 * @param {string[]} expandedDocIds
 * @returns {{ key: string, parentAnchorId: string, childAnchorId: string, objectId: string }[]}
 */
export function buildDocChildLinks(orderedRows, expandedDocIds = []) {
  if (!expandedDocIds.length) return [];

  const expandedSet = new Set(expandedDocIds);
  /** @type {Map<string, { nodeId: string, docId: string, rowId: string, columnKey: string }>} */
  const parentDocAnchors = new Map();

  for (const row of orderedRows) {
    if (row.rowKind !== "object") continue;
    for (const col of row.columns || []) {
      for (const item of col.items) {
        if (item.dataType !== "document" || !item.docId) continue;
        if (!expandedSet.has(item.docId)) continue;
        if (!parentDocAnchors.has(item.docId)) {
          parentDocAnchors.set(item.docId, {
            nodeId: item.nodeId,
            docId: item.docId,
            rowId: row.id,
            columnKey: col.columnKey,
          });
        }
      }
    }
  }

  /** @type {{ key: string, parentAnchorId: string, childAnchorId: string, objectId: string }[]} */
  const links = [];
  for (const row of orderedRows) {
    if (row.rowKind !== "children" || !row.parentDocId) continue;
    if (!expandedSet.has(row.parentDocId)) continue;
    const parent = parentDocAnchors.get(row.parentDocId);
    if (!parent) continue;

    for (const col of row.columns || []) {
      for (const item of col.items) {
        links.push({
          key: `doc-child-${row.parentDocId}-${item.nodeId}`,
          parentAnchorId: `dot-${parent.rowId}-${parent.columnKey}`,
          childAnchorId: `dot-${row.id}-${col.columnKey}`,
          objectId: row.objectId,
        });
      }
    }
  }

  return links;
}

/**
 * Group ordered display rows by objectId for row-group rendering.
 * @param {object[]} orderedRows
 * @returns {{ objectId: string, rows: object[] }[]}
 */
export function groupDisplayRowsByObject(orderedRows) {
  /** @type {Map<string, object[]>} */
  const byObject = new Map();
  for (const row of orderedRows) {
    if (!byObject.has(row.objectId)) byObject.set(row.objectId, []);
    byObject.get(row.objectId).push(row);
  }
  return [...byObject.entries()].map(([objectId, rows]) => ({ objectId, rows }));
}

export function buildRowTimelineRail(columns, grid, options = {}) {
  if (!columns?.length || !grid) {
    return { nodeGroups: [], segments: [] };
  }

  // Always use true grid.pct so chronology matches the ruler (past left of today).
  // Remapping leftPct desyncs folders from todayPct (Jul 8 appearing after Jul 11).
  const nodeGroups = columns.map((col) => ({
    ...col,
    leftPct: grid.pct(col.date),
  }));

  const wireSegments = options.segments || [];
  const gapSegments = buildAdjacentDayGapSegments(columns, grid);
  const rowSpan = buildRowEndpointSpanSegment(columns, grid);
  const segments = [
    ...(rowSpan ? [rowSpan] : []),
    ...gapSegments,
    ...wireSegments,
  ];

  return { nodeGroups, segments };
}

/**
 * Visible time metrics between consecutive different-day columns ("2d", "4d").
 * Same-day columns share a stack — no gap label.
 * @param {ReturnType<typeof buildTimelineColumns>} columns
 * @param {ReturnType<typeof buildTacticalDisplayGrid>} grid
 */
export function buildAdjacentDayGapSegments(columns, grid) {
  if (!columns?.length || columns.length < 2 || !grid) return [];

  const segments = [];
  for (let i = 1; i < columns.length; i += 1) {
    const prev = columns[i - 1];
    const next = columns[i];
    if (sameCalendarDay(prev.date, next.date)) continue;
    const segment = buildDimensionSegmentBetweenColumns(prev, next, grid);
    segments.push({
      ...segment,
      key: `day-gap-${prev.columnKey}-${next.columnKey}`,
      isDocDimension: false,
      isAdjacentGap: true,
    });
  }
  return segments;
}

/**
 * @deprecated Prefer grid.pct only. Identity helper kept for any external callers.
 * @param {Array<{ leftPct: number, date: Date }>} groups
 */
export function spreadDifferentDayColumns(groups) {
  if (!groups?.length) return [];
  return groups.map((g) => ({ ...g, leftPct: Number(g.leftPct) || 0 }));
}

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
    const day = startOfCalendarDay(marker.date);
    const dayTs = day.getTime();
    const existing = byDay.get(dayTs);
    if (existing) {
      existing.items.push(marker);
      continue;
    }
    byDay.set(dayTs, {
      columnKey: String(dayTs),
      date: day,
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
  timelineDocSnapshotsByDocId = {},
  timelineExcludedChildrenByDocId = {},
  timelineAgentSets = [],
  expandedDocIds = [],
    today = new Date(),
    filterObjectId = null,
    inheritObjMode = false,
    primaryTimelineObjectId = null,
    rangeOverride = null,
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

  const { chains, wireAnchors, trackItemsById, classifiedConnections } = tactical;
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
    const snap = timelineDocSnapshotsByDocId[docId];
    addObjectId(docsById[docId]?.parentObjectId || snap?.objectId);
  }
  for (const agentSet of timelineAgentSets) {
    addObjectId(agentSet.objectId);
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
      const snap = timelineDocSnapshotsByDocId[docId];
      const objectIdForDoc = docsById[docId]?.parentObjectId || snap?.objectId;
      if (objectIdForDoc !== objectId) continue;
      const canvasDoc = canvasNodes.find(
        (n) => (n.docId || n.noteId) === docId && isDocumentNode(n),
      );
      if (canvasDoc && markerByKey.has(canvasDoc.id)) continue;
      const date = resolveQueuedDocTimelineDate(
        docId,
        canvasNodes,
        wireAnchors,
        docsById,
        meta,
        snap,
      );
      if (!date) continue;
      const key = canvasDoc?.id || `virtual-${docId}`;
      markerByKey.set(key, {
        nodeId: canvasDoc?.id || key,
        date,
        docId,
        virtual: !canvasDoc,
        dataType: "document",
        queued: true,
      });
    }

    for (const agentSet of timelineAgentSets) {
      if (agentSet.objectId !== objectId) continue;
      const triggerDate = new Date(agentSet.triggerAt);
      if (Number.isNaN(triggerDate.getTime())) continue;
      const key = `agent-set-${agentSet.id}`;
      markerByKey.set(key, {
        nodeId: key,
        date: triggerDate,
        dataType: "agent-set",
        agentSetId: agentSet.id,
        setKey: agentSet.setKey,
        setStatus: agentSet.status,
        setTitle: agentSet.title,
        virtual: true,
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
      const snap = timelineDocSnapshotsByDocId[docId];
      const objectIdForDoc = docsById[docId]?.parentObjectId || snap?.objectId;
      if (objectIdForDoc !== objectId) continue;
      const excluded = timelineExcludedChildrenByDocId[docId] || [];
      const childMarkers = buildChildMarkersForDoc(docId, {
        canvasNodes,
        wireAnchors,
        nodeEntitiesById,
        docsById,
        nodeById,
        trackItemsById,
        snapshot: snap,
        excludedKeys: excluded,
      });
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
  const childRowsByObjectId = new Map();
  for (const row of displayRows.filter((r) => r.rowKind === "children")) {
    if (!childRowsByObjectId.has(row.objectId)) childRowsByObjectId.set(row.objectId, []);
    childRowsByObjectId.get(row.objectId).push(row);
  }

  /** @type {typeof displayRows} */
  const orderedRows = [];
  for (const objectRow of [...primaryRows, ...inheritRows]) {
    orderedRows.push(objectRow);
    orderedRows.push(...(childRowsByObjectId.get(objectRow.objectId) || []));
  }

  // Scale the grid from folder (object-row) dates so child rows don't force month zoom-out.
  const folderMarkerDates = orderedRows
    .filter((row) => row.rowKind === "object")
    .flatMap((row) => (row.columns || []).map((col) => col.date));
  const fallbackMarkerDates = orderedRows.flatMap((row) =>
    (row.columns || []).map((col) => col.date),
  );
  const displayGrid = buildTacticalDisplayGrid(
    folderMarkerDates.length > 0 ? folderMarkerDates : fallbackMarkerDates,
    today,
    {
      rangeOverride,
      queueDocCount: timelineDocQueue.length,
    },
  );

  const dimensionSegmentsByRow = buildDocDimensionSegmentsByRow(
    orderedRows,
    displayGrid,
    classifiedConnections,
    today,
  );

  for (const row of orderedRows) {
    const segments = dimensionSegmentsByRow.get(row.id) || [];
    row.rail = buildRowTimelineRail(row.columns, displayGrid, { segments });
  }

  return {
    ...tactical,
    grid: displayGrid,
    displayRows: orderedRows,
  };
}
