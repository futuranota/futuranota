import { daysBetween } from "../data.jsx";
import {
  applyAutoZoomForQueue,
  applyTacticalRangeOverride,
  resolveTacticalGridBaseBounds,
  clampTacticalRangeMs,
  minSpanMsForRulerEdges,
  maxSpanMsForDifferentDayFolders,
  resolveTacticalLoupe,
  applyTacticalLoupePct,
  applyTacticalLoupeSegment,
} from "./tacticalTimelineRange.js";
import {
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
  resolveDocScheduleDate,
  resolveExplicitDocScheduleDate,
  resolveTimelineTimeGap,
  formatTimelineTimeGapPlain,
  formatTimelineTimeGapLabel,
  formatSameDayPairLabel,
} from "./docSchedule.js";
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
  const baseStart = start;
  const baseEnd = end;
  ({ start, end } = applyTacticalRangeOverride(start, end, rangeOverride));
  // Never let an override collapse different-day folders (≥1d) on the rail.
  const folderDates = markerDates.filter(Boolean);
  const clampedOverride = clampTacticalRangeMs(start.getTime(), end.getTime(), {
    minSpanMs: minSpanMsForRulerEdges(folderDates),
    maxSpanMs: maxSpanMsForDifferentDayFolders(folderDates),
  });
  if (clampedOverride) {
    start = startOfCalendarDay(new Date(clampedOverride.startMs));
    end = startOfCalendarDay(new Date(clampedOverride.endMs));
  }

  const normalized = markerDates.filter(Boolean).map((d) => startOfCalendarDay(d));
  const todayDay = startOfCalendarDay(today);
  const monthStart = startOfCalendarMonth(today);
  const monthEnd = endOfCalendarMonth(today);

  const total = end.getTime() - start.getTime() || 86400000;
  // Full datetime so same-day docs with different hours/minutes can separate on the rail.
  const pct = (d) => {
    if (!d) return 0;
    const ts = d instanceof Date ? d.getTime() : startOfCalendarDay(d).getTime();
    return Math.min(100, Math.max(0, ((ts - start.getTime()) / total) * 100));
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
    baseStart,
    baseEnd,
    pct,
    todayPct: pct(todayDay),
    today: todayDay,
    spanDays,
    monthStart,
    monthEnd,
    markers,
    /** Folder/doc anchors only — used to stop stretch at ruler extremes. */
    folderMarkers: normalized,
    ticks: buildGridTicks(start, end, pct, spanDays),
  };
}

/**
 * Label between two anchor dates (matches canvas ConnLabel / computeEdgeTemporalLabel).
 * Same calendar day → "same day" (+ minutes when available).
 * @param {Date} fromDate
 * @param {Date} toDate
 */
export function formatTimelineSpanLabel(fromDate, toDate) {
  return formatTimelineTimeGapPlain(resolveTimelineTimeGap(fromDate, toDate));
}

export { formatTimelineTimeGapLabel, resolveTimelineTimeGap };

/**
 * Schedule status relative to today — timeline tracks time, not just day gaps.
 * @param {Date} date
 * @param {Date} today
 * @param {{ completed?: boolean }} [options]
 * @returns {{ kind: 'completed' | 'past-due' | 'today' | 'pending', daysFromToday: number, absDays: number }}
 */
export function resolveTimelineScheduleStatus(date, today, options = {}) {
  const day = startOfCalendarDay(date);
  const todayDay = startOfCalendarDay(today);
  const daysFromToday = daysBetween(todayDay, day);
  if (options.completed) {
    return { kind: "completed", daysFromToday, absDays: Math.abs(daysFromToday) };
  }
  if (daysFromToday < 0) {
    return { kind: "past-due", daysFromToday, absDays: -daysFromToday };
  }
  if (daysFromToday === 0) {
    return { kind: "today", daysFromToday, absDays: 0 };
  }
  return { kind: "pending", daysFromToday, absDays: daysFromToday };
}

/**
 * @param {{ kind: string, absDays: number }} status
 * @param {(key: string, vars?: object) => string} t
 * @param {{ gapDays?: number | null }} [options] inter-folder day gap (optional)
 */
export function formatTimelineScheduleStatusLabel(status, t, options = {}) {
  if (!status || typeof t !== "function") return "";
  const gapDays = Number(options.gapDays);
  const hasGap = Number.isFinite(gapDays) && gapDays > 0;
  const gapLabel = hasGap
    ? t("timeline.gapDays", { count: gapDays, s: gapDays === 1 ? "" : "s" })
    : "";

  if (status.kind === "completed") {
    return gapLabel ? `${t("timeline.completed")} · ${gapLabel}` : t("timeline.completed");
  }
  if (status.kind === "past-due") {
    // Prefer explicit gap (folder↔folder); else days overdue from today.
    const dist = hasGap
      ? gapLabel
      : t("timeline.gapDays", {
        count: status.absDays,
        s: status.absDays === 1 ? "" : "s",
      });
    return status.absDays > 0 || hasGap
      ? `${t("timeline.pastDue")} · ${dist}`
      : t("timeline.pastDue");
  }
  if (status.kind === "today") return t("timeline.today");

  const pluralS = status.absDays === 1 ? "" : "s";
  const pending = t("timeline.pendingDays", { count: status.absDays, s: pluralS });
  // Keep inter-folder distance when it differs from "days until".
  if (hasGap && gapDays !== status.absDays) {
    return `${pending} · ${gapLabel}`;
  }
  return pending;
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

function buildDimensionSegmentBetweenColumns(fromCol, toCol, grid, loupe = null) {
  const fromPct = applyTacticalLoupePct(grid.pct(fromCol.date), loupe);
  const toPct = applyTacticalLoupePct(grid.pct(toCol.date), loupe);
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
 * @param {{ loupe?: object | null }} [options]
 */
export function buildRowEndpointSpanSegment(columns, grid, options = {}) {
  if (!columns?.length || !grid) return null;
  const loupe = options.loupe || null;

  if (columns.length === 1) {
    const pct = applyTacticalLoupePct(grid.pct(columns[0].date), loupe);
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
  const segment = buildDimensionSegmentBetweenColumns(first, last, grid, loupe);
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

  const markerDates = options.markerDates || columns.map((c) => c.date);
  const loupe = resolveTacticalLoupe(options.loupe || null, grid, markerDates);
  const nodeGroups = assignColumnLeftPcts(columns, grid, loupe);

  const wireSegments = (options.segments || []).map((seg) =>
    applyTacticalLoupeSegment(seg, loupe),
  );
  const gapSegments = buildAdjacentDayGapSegments(columns, grid, {
    today: grid.today || null,
    loupe,
  }).map((seg, idx) => {
    // Align gap band to fan-out positions (same-day nodes are not on pure grid.pct).
    if (idx + 1 >= nodeGroups.length) return seg;
    const prev = nodeGroups[idx];
    const next = nodeGroups[idx + 1];
    const leftPct = Math.min(prev.leftPct, next.leftPct);
    const widthPct = Math.max(Math.abs(next.leftPct - prev.leftPct), 0.5);
    return { ...seg, leftPct, widthPct };
  });
  const rowSpan = (() => {
    if (nodeGroups.length === 1) {
      return {
        key: `row-endpoint-${nodeGroups[0].columnKey}`,
        leftPct: nodeGroups[0].leftPct,
        widthPct: 0.5,
        label: formatTimelineSpanLabel(nodeGroups[0].date, nodeGroups[0].date),
        isRowEndpointSpan: true,
      };
    }
    if (nodeGroups.length < 2) return null;
    const first = nodeGroups[0];
    const last = nodeGroups[nodeGroups.length - 1];
    const leftPct = Math.min(first.leftPct, last.leftPct);
    const widthPct = Math.max(Math.abs(last.leftPct - first.leftPct), 0.5);
    return {
      key: `row-endpoints-${first.columnKey}-${last.columnKey}`,
      leftPct,
      widthPct,
      label: formatTimelineSpanLabel(first.date, last.date),
      isDocDimension: false,
      isRowEndpointSpan: true,
    };
  })();
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
export function buildAdjacentDayGapSegments(columns, grid, options = {}) {
  if (!columns?.length || columns.length < 2 || !grid) return [];
  const today = options.today || grid.today || null;
  const loupe = options.loupe || null;
  const now = options.now || new Date();

  const segments = [];
  for (let i = 1; i < columns.length; i += 1) {
    const prev = columns[i - 1];
    const next = columns[i];
    const timeGap = resolveTimelineTimeGap(prev.date, next.date);
    const sameDay = timeGap.kind === "same-day";
    const segment = buildDimensionSegmentBetweenColumns(prev, next, grid, loupe);
    const later = prev.date.getTime() <= next.date.getTime() ? next.date : prev.date;
    const schedule = (!sameDay && today)
      ? resolveTimelineScheduleStatus(later, today)
      : null;
    const pairMeta = sameDay
      ? formatSameDayPairLabel({
        from: prev.date,
        to: next.date,
        now,
        hasExplicitTime: timeGap.minutes >= 1,
      })
      : null;
    segments.push({
      ...segment,
      key: `day-gap-${prev.columnKey}-${next.columnKey}`,
      isDocDimension: false,
      isAdjacentGap: true,
      isSameDayGap: sameDay,
      fromDate: prev.date,
      toDate: next.date,
      scheduleKind: pairMeta?.statusKind || schedule?.kind || (sameDay ? "same-day" : null),
      timeGap,
      pairHeadline: pairMeta?.headline || null,
      pairDetail: pairMeta?.detail || null,
      label: pairMeta?.singleLine || formatTimelineTimeGapPlain(timeGap),
      schedule,
      gapDays: timeGap.days,
      gapMinutes: timeGap.minutes,
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
 * One column per scheduled unit (doc / child), chronological by full datetime.
 * Same calendar day → separate nodes (never stacked just for sharing a day).
 * @param {Array<{ nodeId: string, date: Date, docId?: string, virtual?: boolean, dataType?: string }>} markers
 */
export function buildTimelineColumns(markers) {
  const sorted = [...markers].sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime();
    if (dt !== 0) return dt;
    return String(a.nodeId || "").localeCompare(String(b.nodeId || ""));
  });

  return sorted.map((marker, index) => ({
    columnKey: `${marker.nodeId || marker.docId || "m"}-${index}-${marker.date.getTime()}`,
    date: marker.date,
    items: [marker],
  }));
}

/** Minimum horizontal gap (%) between same-day doc nodes — must clear chip + bridge label. */
const SAME_DAY_FANOUT_GAP_PCT = 26;
/** Soft minimum between different-day consecutive columns after fan-out. */
const COLUMN_MIN_GAP_PCT = 10;

/**
 * Keep chronology, but fan out same-day columns so they read as separate nodes
 * with a relevant horizontal distance (chip + "same day / sched" label between).
 * Different-day positions stay on true grid.pct unless a same-day cluster needs room.
 * @param {Array<{ date: Date, columnKey: string }>} columns
 * @param {{ pct: (d: Date) => number }} grid
 * @param {object | null} loupe
 */
function assignColumnLeftPcts(columns, grid, loupe = null) {
  if (!columns?.length) return [];
  const natural = columns.map((col) => ({
    ...col,
    leftPct: applyTacticalLoupePct(grid.pct(col.date), loupe),
  }));

  let i = 0;
  while (i < natural.length) {
    let j = i + 1;
    while (
      j < natural.length
      && sameCalendarDay(natural[i].date, natural[j].date)
    ) {
      j += 1;
    }
    const count = j - i;
    if (count > 1) {
      const dayAnchor = applyTacticalLoupePct(
        grid.pct(startOfCalendarDay(natural[i].date)),
        loupe,
      );
      const gapPct = SAME_DAY_FANOUT_GAP_PCT;
      const prevEdge = i > 0 ? natural[i - 1].leftPct : 0;
      const nextEdge = j < natural.length ? natural[j].leftPct : 100;
      const pad = COLUMN_MIN_GAP_PCT * 0.5;
      const roomLeft = prevEdge + pad;
      const roomRight = nextEdge - pad;
      const available = Math.max(gapPct, roomRight - roomLeft);

      // If neighbors are tight, still keep a readable same-day span.
      let useGap = gapPct;
      if ((count - 1) * gapPct > available && count > 1) {
        useGap = Math.max(16, available / (count - 1));
      }
      const span = (count - 1) * useGap;
      let startPct = dayAnchor - span / 2;
      const minStart = Math.max(2, roomLeft);
      const maxStart = Math.min(98 - span, roomRight - span);
      if (minStart <= maxStart) {
        startPct = Math.max(minStart, Math.min(startPct, maxStart));
      } else {
        // Not enough room between neighbors — still separate same-day nodes.
        startPct = Math.max(2, Math.min(dayAnchor - span / 2, 98 - span));
      }

      for (let k = 0; k < count; k += 1) {
        natural[i + k].leftPct = Math.min(98, Math.max(2, startPct + k * useGap));
      }
    }
    i = j;
  }

  // Final pass: never let consecutive same-day nodes sit on top of each other.
  for (let k = 1; k < natural.length; k += 1) {
    const minGap = sameCalendarDay(natural[k - 1].date, natural[k].date)
      ? Math.min(SAME_DAY_FANOUT_GAP_PCT, 22)
      : COLUMN_MIN_GAP_PCT;
    if (natural[k].leftPct < natural[k - 1].leftPct + minGap) {
      natural[k].leftPct = Math.min(98, natural[k - 1].leftPct + minGap);
    }
  }
  if (natural.length && natural[natural.length - 1].leftPct > 98) {
    const overflow = natural[natural.length - 1].leftPct - 98;
    for (const col of natural) {
      col.leftPct = Math.max(2, col.leftPct - overflow);
    }
  }

  return natural;
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
  const doc = docsById[docId];
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
  const scheduled = resolveDocScheduleDate(doc, meta?.nodeEntitiesById || {});
  if (scheduled) return scheduled;
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
    loupe = null,
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
        const fullDate = (docId ? resolveExplicitDocScheduleDate(docsById[docId]) : null)
          || resolveNodeAnchorDate(node || item, meta)
          || (docId ? resolveDocScheduleDate(docsById[docId], nodeEntitiesById) : null)
          || wireAnchors.get(nodeId)
          || date;
        markerByKey.set(nodeId, {
          nodeId,
          date: fullDate,
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
    row.rail = buildRowTimelineRail(row.columns, displayGrid, {
      segments,
      loupe,
      markerDates: folderMarkerDates.length > 0 ? folderMarkerDates : fallbackMarkerDates,
    });
  }

  return {
    ...tactical,
    grid: displayGrid,
    displayRows: orderedRows,
  };
}
