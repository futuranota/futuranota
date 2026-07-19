import { daysBetween } from "../data.jsx";
import {
  applyAutoZoomForQueue,
  applyTacticalRangeOverride,
  resolveTacticalGridBaseBounds,
  clampTacticalRangeMs,
  minSpanMsForRulerEdges,
  maxSpanMsForDifferentDayFolders,
  applyAllPairStretchesOnRail,
  buildStretchUnitsWithToday,
  applyTacticalLoupePct,
  applyTacticalLoupeSegment,
} from "./tacticalTimelineRange.js";
import {
  resolveNodeAnchorDate,
  sameCalendarDay,
  startOfCalendarDay,
  parseDate,
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
  resolveLinkedNodeScheduleDate,
  resolveTimelineTimeGap,
  formatTimelineTimeGapPlain,
  formatTimelineTimeGapLabel,
  formatSameDayPairLabel,
  formatNowUntilScheduleLabel,
  isSameDayScheduleCountdownActive,
} from "./docSchedule.js";
import {
  resolveQueuedDocTimelineDate,
  buildChildMarkersForDoc,
  isFolderTimelineCompleted,
} from "./timelineDocSnapshot.js";
import {
  collectFolderLinkedDateMarkers,
  resolveCampaignFolderTimelineDate,
} from "./campaignTimelineRail.js";
import { resolveCampaignSourceMicroLabel } from "./campaignDocSource.js";
import { buildGuestInheritanceProjections } from "./timelineInheritance.js";

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
 * Thermometer (`todayPct` / `nowPct`) tracks wall-clock now (day+hour+minute).
 * @param {Date[]} markerDates
 * @param {Date} today
 * @param {{ rangeOverride?: { startMs?: number | null, endMs?: number | null } | null, queueDocCount?: number, now?: Date | null }} [options]
 */
export function buildTacticalDisplayGrid(markerDates, today, options = {}) {
  const { rangeOverride = null, queueDocCount = 0 } = options;
  const now = options.now instanceof Date && !Number.isNaN(options.now.getTime())
    ? options.now
    : (today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date());
  let { start, end } = resolveTacticalGridBaseBounds(markerDates, today, { queueDocCount });
  ({ start, end } = applyAutoZoomForQueue(start, end, markerDates, queueDocCount));
  const baseStart = start;
  const baseEnd = end;
  ({ start, end } = applyTacticalRangeOverride(start, end, rangeOverride));
  // Keep a pure 24h today pie intact — the 3-day stretch floor would
  // squash hour:minute and put 10pm on top of 9:43pm.
  const folderDates = markerDates.filter(Boolean);
  const spanMs = end.getTime() - start.getTime();
  const isDayClockPie = spanMs > 0 && spanMs <= 86400000 + 1000;
  // Sticker pan on the 24h pie must keep continuous hours — skip the 3-day floor.
  if (!isDayClockPie) {
    const clampedOverride = clampTacticalRangeMs(start.getTime(), end.getTime(), {
      minSpanMs: minSpanMsForRulerEdges(folderDates),
      maxSpanMs: maxSpanMsForDifferentDayFolders(folderDates),
    });
    if (clampedOverride) {
      start = startOfCalendarDay(new Date(clampedOverride.startMs));
      end = startOfCalendarDay(new Date(clampedOverride.endMs));
    }
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
  const nowPct = pct(now);

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
    /** Wall-clock position — thermometer time tracker. */
    todayPct: nowPct,
    nowPct,
    now,
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
 * Hide dimension fill from span start → now; only now → end stays colored.
 * @param {ReturnType<typeof buildDimensionSegmentBetweenColumns>} segment
 * @param {ReturnType<typeof buildTacticalDisplayGrid>} grid
 * @param {Date} today
 */
export function clipDocDimensionSegmentFromToday(segment, grid, today) {
  if (!segment || !grid) return null;

  const now = grid.now instanceof Date ? grid.now : today;
  const nowTs = now instanceof Date ? now.getTime() : startOfCalendarDay(today).getTime();
  if (nowTs < grid.start.getTime() || nowTs > grid.end.getTime()) {
    return segment;
  }

  const todayPct = grid.nowPct ?? grid.todayPct;
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
    return {
      nodeGroups: [],
      segments: [],
      todayLeftPct: null,
      todayPairNextDate: null,
    };
  }

  const pairStretches = options.pairStretches || [];
  const now = options.now instanceof Date
    ? options.now
    : (grid.now instanceof Date ? grid.now : new Date());
  const nowPctRaw = grid.nowPct ?? grid.todayPct ?? grid.pct(now);

  // Clock layout, inject today into stretch chain, then pair-stretch left→right.
  const laidOut = assignColumnLeftPcts(columns, grid, null, { now });
  const { units, todayIdx } = buildStretchUnitsWithToday(laidOut, now, nowPctRaw);
  applyAllPairStretchesOnRail(units, pairStretches);

  const todayUnit = todayIdx >= 0 ? units[todayIdx] : null;
  const todayLeftPct = todayUnit ? todayUnit.leftPct : nowPctRaw;
  const todayPairNext = todayIdx >= 0 && todayIdx < units.length - 1
    ? units[todayIdx + 1]
    : null;
  const nodeGroups = units.filter((u) => !u.isToday);

  const wireSegments = (options.segments || []).map((seg) =>
    applyTacticalLoupeSegment(seg, null),
  );
  const gapSegments = buildAdjacentDayGapSegments(columns, grid, {
    today: grid.today || null,
    now,
    loupe: null,
  }).map((seg, idx) => {
    if (idx + 1 >= nodeGroups.length) return seg;
    const prev = nodeGroups[idx];
    const next = nodeGroups[idx + 1];
    const leftPct = Math.min(prev.leftPct, next.leftPct);
    const widthPct = Math.max(Math.abs(next.leftPct - prev.leftPct), 0.5);
    return { ...seg, leftPct, widthPct };
  });
  const nowGap = buildNowToNextGapSegment(nodeGroups, grid, {
    now,
    loupe: null,
    todayLeftPct,
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
    ...(nowGap ? [nowGap] : []),
    ...gapSegments,
    ...wireSegments,
  ];

  return {
    nodeGroups,
    segments,
    todayLeftPct,
    todayPairNextDate: todayPairNext?.date || null,
    todayStretchable: Boolean(todayPairNext),
  };
}

/**
 * Gap from thermometer (now) → next upcoming scheduled column.
 * Live countdown; A↔B gaps stay on adjacent segments.
 * @param {Array<{ date: Date, leftPct: number, columnKey: string }>} nodeGroups
 * @param {ReturnType<typeof buildTacticalDisplayGrid>} grid
 * @param {{ now?: Date, loupe?: object | null }} [options]
 */
export function buildNowToNextGapSegment(nodeGroups, grid, options = {}) {
  if (!nodeGroups?.length || !grid) return null;
  const now = options.now instanceof Date
    ? options.now
    : (grid.now instanceof Date ? grid.now : new Date());
  const loupe = options.loupe || null;
  const upcomingIdx = nodeGroups.findIndex((g) => g?.date && g.date.getTime() > now.getTime());
  if (upcomingIdx < 0) return null;
  const upcoming = nodeGroups[upcomingIdx];
  const pairNext = nodeGroups[upcomingIdx + 1];

  // When A↔B same-day sched is already in live countdown (now ≥ A−1m),
  // that pair owns the remaining-time label — don't also show "today in Xm".
  if (
    pairNext?.date
    && isSameDayScheduleCountdownActive(upcoming.date, pairNext.date, now)
  ) {
    return null;
  }

  const nowPctRaw = Number.isFinite(options.todayLeftPct)
    ? options.todayLeftPct
    : (grid.nowPct ?? grid.todayPct ?? grid.pct(now));
  const nowPct = applyTacticalLoupePct(nowPctRaw, loupe);
  let nextPct = Number(upcoming.leftPct) || 0;
  if (nextPct <= nowPct) {
    nextPct = Math.min(98, nowPct + NOW_TO_NEXT_MIN_GAP_PCT);
  }

  const sameDay = sameCalendarDay(now, upcoming.date);
  const pairMeta = formatNowUntilScheduleLabel({
    target: upcoming.date,
    now,
    hasExplicitTime: sameDay,
  });
  if (!pairMeta) return null;

  return {
    key: `now-gap-${upcoming.columnKey}`,
    leftPct: nowPct,
    widthPct: Math.max(nextPct - nowPct, 0.4),
    isDocDimension: false,
    isAdjacentGap: true,
    isNowGap: true,
    isSameDayGap: sameDay,
    fromDate: now,
    toDate: upcoming.date,
    scheduleKind: pairMeta.statusKind || (sameDay ? "today" : "pending"),
    timeGap: resolveTimelineTimeGap(now, upcoming.date),
    pairHeadline: pairMeta.headline,
    pairDetail: pairMeta.detail,
    label: pairMeta.singleLine,
    remainingMinutes: pairMeta.remainingMinutes,
    schedule: null,
    gapDays: sameDay ? 0 : resolveTimelineTimeGap(now, upcoming.date).days,
    gapMinutes: pairMeta.remainingMinutes,
  };
}

/**
 * Visible time metrics between consecutive columns (day gaps + same-day sched).
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
      isLiveCountdown: Boolean(pairMeta?.isLiveCountdown),
      schedule,
      gapDays: timeGap.days,
      gapMinutes: pairMeta?.remainingMinutes ?? timeGap.minutes,
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

/**
 * Object-row (folder rail) columns on the single shared ruler.
 * Folders that share a calendar day collapse into ONE column: they stack
 * vertically (oldest Created on top = priority, newest below) and the day
 * label (Today / Jul 17) renders once under the stack.
 * Date markers, agent sets, and other non-folder markers keep the regular
 * one-column-per-unit layout.
 * @param {Array<{ nodeId: string, date: Date, docId?: string, dataType?: string }>} markers
 * @param {Record<string, object>} docsById
 */
export function buildObjectRowFolderColumns(markers, docsById = {}) {
  const folderMarkers = markers.filter((m) => m.dataType === "document" && m.docId);
  const otherMarkers = markers.filter((m) => !(m.dataType === "document" && m.docId));

  const createdMs = (marker) => {
    const fromCreated = parseDate(docsById[marker.docId]?.createdAt);
    if (fromCreated) return fromCreated.getTime();
    return marker.date instanceof Date ? marker.date.getTime() : 0;
  };

  /** @type {Map<number, typeof folderMarkers>} */
  const byDay = new Map();
  for (const marker of folderMarkers) {
    const dayMs = startOfCalendarDay(marker.date).getTime();
    if (!byDay.has(dayMs)) byDay.set(dayMs, []);
    byDay.get(dayMs).push(marker);
  }

  const folderColumns = [...byDay.entries()].map(([dayMs, group]) => {
    // Oldest created first → renders at the top of the vertical stack.
    group.sort((a, b) => {
      const dt = createdMs(a) - createdMs(b);
      if (dt !== 0) return dt;
      return String(a.docId || "").localeCompare(String(b.docId || ""));
    });
    const anchor = group[0];
    return {
      columnKey: `folder-day-${dayMs}-${group.map((m) => m.nodeId).join("_")}`,
      date: anchor.date,
      items: group,
    };
  });

  const otherColumns = buildTimelineColumns(otherMarkers);

  return [...folderColumns, ...otherColumns].sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime();
    if (dt !== 0) return dt;
    return String(a.columnKey).localeCompare(String(b.columnKey));
  });
}

/** Preferred horizontal gap (%) between same-day docs on multi-day (zoomed-out) rails. */
const SAME_DAY_FANOUT_GAP_PCT = 26;
/** Soft minimum between different-day consecutive columns after fan-out. */
const COLUMN_MIN_GAP_PCT = 10;
/** Absolute floor so chips never stack when cramped on multi-day rails. */
const MIN_VISIBLE_GAP_PCT = 10;
/** On a 24h clock ruler, only nudge if two same-day chips would overlap. */
const SAME_DAY_CLOCK_MIN_GAP_PCT = 2.5;
/**
 * Only when a future schedule sits on/under the thermometer.
 * Do NOT invent a large gap — 9:43pm must stay just before 10:00pm on the 24h pie.
 */
const NOW_TO_NEXT_MIN_GAP_PCT = 1.25;

function isClockDayGrid(grid) {
  // 24h pie, or today+tomorrow pending — keep hour:minute vs thermometer.
  return Number(grid?.spanDays) > 0 && Number(grid.spanDays) <= 2;
}

function preferredGapPct(prevDate, nextDate, clockScale = false) {
  if (sameCalendarDay(prevDate, nextDate)) {
    return clockScale ? SAME_DAY_CLOCK_MIN_GAP_PCT : Math.min(SAME_DAY_FANOUT_GAP_PCT, 22);
  }
  return COLUMN_MIN_GAP_PCT;
}

/**
 * When multi-day packing clamps several nodes to ~98%, they stack.
 * Skip aggressive refit on 24h clock grids — true hour positions win.
 * @param {Array<{ date: Date, leftPct: number }>} natural
 * @param {number} start
 * @param {number} end exclusive
 * @param {number} leftFloor
 * @param {number} [rightBound]
 */
function refitColumnRange(natural, start, end, leftFloor, rightBound = 98) {
  const count = end - start;
  if (count <= 0) return;
  const floor = Math.max(2, Math.min(leftFloor, rightBound));
  if (count === 1) {
    natural[start].leftPct = Math.min(rightBound, Math.max(floor, natural[start].leftPct));
    return;
  }

  const idealGaps = [];
  for (let k = start + 1; k < end; k += 1) {
    idealGaps.push(preferredGapPct(natural[k - 1].date, natural[k].date, false));
  }
  const available = Math.max(MIN_VISIBLE_GAP_PCT, rightBound - floor);
  const idealSpan = idealGaps.reduce((sum, g) => sum + g, 0);
  const minSpan = MIN_VISIBLE_GAP_PCT * (count - 1);

  let gaps = idealGaps;
  if (idealSpan > available) {
    if (minSpan >= available) {
      for (let i = 0; i < count; i += 1) {
        natural[start + i].leftPct = floor + (i / (count - 1)) * available;
      }
      return;
    }
    const scale = (available - minSpan) / Math.max(0.001, idealSpan - minSpan);
    gaps = idealGaps.map((g) => (
      MIN_VISIBLE_GAP_PCT + (g - MIN_VISIBLE_GAP_PCT) * scale
    ));
  }

  const span = gaps.reduce((sum, g) => sum + g, 0);
  let preferredFirst = Math.max(floor, Math.min(natural[start].leftPct, rightBound));
  if (preferredFirst + span > rightBound) {
    preferredFirst = Math.max(floor, rightBound - span);
  }

  let x = preferredFirst;
  natural[start].leftPct = x;
  for (let i = 1; i < count; i += 1) {
    x += gaps[i - 1];
    natural[start + i].leftPct = Math.min(rightBound, x);
  }
}

/**
 * Detect clamp-collapse on multi-day rails only.
 * @param {Array<{ date: Date, leftPct: number }>} natural
 * @param {{ pct: (d: Date) => number, nowPct?: number, todayPct?: number, spanDays?: number }} grid
 * @param {object | null} loupe
 * @param {Date | null} now
 */
function ensureVisibleColumnSeparation(natural, grid, loupe, now) {
  if (natural.length < 2) return;
  if (isClockDayGrid(grid)) return;

  const collapsed = natural.some((col, k) => (
    k > 0 && col.leftPct < natural[k - 1].leftPct + MIN_VISIBLE_GAP_PCT - 0.05
  ));
  if (!collapsed) return;

  let packStart = 0;
  let leftFloor = 2;
  if (now) {
    const nowPct = applyTacticalLoupePct(
      grid.nowPct ?? grid.todayPct ?? grid.pct(now),
      loupe,
    );
    const firstFuture = natural.findIndex((c) => c.date.getTime() > now.getTime());
    if (firstFuture > 0) {
      packStart = firstFuture;
      leftFloor = Math.max(
        natural[firstFuture - 1].leftPct + MIN_VISIBLE_GAP_PCT,
        nowPct + NOW_TO_NEXT_MIN_GAP_PCT,
      );
    } else if (firstFuture === 0) {
      leftFloor = nowPct + NOW_TO_NEXT_MIN_GAP_PCT;
    }
  }

  refitColumnRange(natural, packStart, natural.length, leftFloor, 98);
}

/**
 * Place columns on the rail.
 * On a 24h clock ruler: keep true hour:minute so the thermometer sits before
 * an upcoming schedule (9:43pm before 10:00pm). Same-day fan-out only on
 * zoomed-out multi-day grids where hours would otherwise collapse.
 * @param {Array<{ date: Date, columnKey: string }>} columns
 * @param {{ pct: (d: Date) => number, nowPct?: number, now?: Date, spanDays?: number }} grid
 * @param {object | null} loupe
 * @param {{ now?: Date | null }} [options]
 */
function assignColumnLeftPcts(columns, grid, loupe = null, options = {}) {
  if (!columns?.length) return [];
  const now = options.now instanceof Date
    ? options.now
    : (grid.now instanceof Date ? grid.now : null);
  const clockScale = isClockDayGrid(grid);
  const natural = columns.map((col) => ({
    ...col,
    leftPct: applyTacticalLoupePct(grid.pct(col.date), loupe),
  }));

  if (!clockScale) {
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
        const naturalCenter = natural
          .slice(i, j)
          .reduce((sum, col) => sum + col.leftPct, 0) / count;
        const dayAnchor = naturalCenter;
        const gapPct = SAME_DAY_FANOUT_GAP_PCT;
        const prevEdge = i > 0 ? natural[i - 1].leftPct : 0;
        const nextEdge = j < natural.length ? natural[j].leftPct : 100;
        const pad = COLUMN_MIN_GAP_PCT * 0.5;
        const roomLeft = prevEdge + pad;
        const roomRight = nextEdge - pad;
        const available = Math.max(gapPct, roomRight - roomLeft);

        let useGap = gapPct;
        if ((count - 1) * gapPct > available && count > 1) {
          useGap = Math.max(MIN_VISIBLE_GAP_PCT, available / (count - 1));
        }
        const span = (count - 1) * useGap;
        let startPct = dayAnchor - span / 2;
        const minStart = Math.max(2, roomLeft);
        const maxStart = Math.min(98 - span, roomRight - span);
        if (minStart <= maxStart) {
          startPct = Math.max(minStart, Math.min(startPct, maxStart));
        } else {
          startPct = Math.max(2, Math.min(dayAnchor - span / 2, 98 - span));
        }

        for (let k = 0; k < count; k += 1) {
          natural[i + k].leftPct = Math.min(98, Math.max(2, startPct + k * useGap));
        }
      }
      i = j;
    }
  }

  // Keep chronological order with a small minimum gap (clock scale = tiny).
  for (let k = 1; k < natural.length; k += 1) {
    const minGap = preferredGapPct(natural[k - 1].date, natural[k].date, clockScale);
    if (natural[k].leftPct < natural[k - 1].leftPct + minGap) {
      natural[k].leftPct = natural[k - 1].leftPct + minGap;
    }
  }

  // Thermometer rule: future schedules must sit after now — but keep true clock
  // distance when already correct (do not invent a 16% fake gap).
  if (now) {
    const nowPct = applyTacticalLoupePct(
      grid.nowPct ?? grid.todayPct ?? grid.pct(now),
      loupe,
    );
    for (let k = 0; k < natural.length; k += 1) {
      if (!(natural[k].date.getTime() > now.getTime())) continue;
      if (natural[k].leftPct <= nowPct) {
        natural[k].leftPct = Math.min(98, nowPct + NOW_TO_NEXT_MIN_GAP_PCT);
      }
    }
    for (let k = 1; k < natural.length; k += 1) {
      const minGap = preferredGapPct(natural[k - 1].date, natural[k].date, clockScale);
      if (natural[k].leftPct < natural[k - 1].leftPct + minGap) {
        natural[k].leftPct = Math.min(98, natural[k - 1].leftPct + minGap);
      }
    }
  }

  if (natural.length && natural[natural.length - 1].leftPct > 98) {
    const overflow = natural[natural.length - 1].leftPct - 98;
    for (const col of natural) {
      col.leftPct = Math.max(2, col.leftPct - overflow);
    }
  }

  ensureVisibleColumnSeparation(natural, grid, loupe, now);

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
  timelineDateNodeIds = [],
  expandedDocIds = [],
    today = new Date(),
    filterObjectId = null,
    inheritObjMode = false,
    primaryTimelineObjectId = null,
    rangeOverride = null,
    loupe = null,
    pairStretches = [],
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
  const meta = { nodeEntitiesById, docsById, objectsById, today };
  // Timeline is opt-in: only docs explicitly inserted (queued) render markers.
  const queuedDocIdSet = new Set(timelineDocQueue);

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
  for (const dateNodeId of timelineDateNodeIds) {
    const node = canvasNodes.find((n) => n.id === dateNodeId);
    if (!node?.parentDocId) continue;
    addObjectId(docsById[node.parentDocId]?.parentObjectId);
  }
  // Chains no longer create rows on their own — dragging a folder to the
  // canvas must not surface it on the timeline until "Insert to timeline".

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
        // Canvas presence alone is not enough — the doc must have been inserted.
        if (!docId || !queuedDocIdSet.has(docId)) continue;
        const campaignDate = docId
          ? resolveCampaignFolderTimelineDate(docsById[docId], nodeEntitiesById, today)
          : null;
        const fullDate = campaignDate
          || (docId ? resolveExplicitDocScheduleDate(docsById[docId]) : null)
          || resolveNodeAnchorDate(node || item, meta)
          || (docId ? resolveDocScheduleDate(docsById[docId], nodeEntitiesById) : null)
          || wireAnchors.get(nodeId)
          || date;
        markerByKey.set(nodeId, {
          nodeId,
          date: fullDate,
          docId,
          dataType: "document",
          completed: Boolean(
            docId && isFolderTimelineCompleted(docId, docsById, nodeEntitiesById),
          ),
          sourceMicroLabel: docId
            ? resolveCampaignSourceMicroLabel(docsById[docId], nodeEntitiesById)
            : "",
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
      const date = resolveCampaignFolderTimelineDate(docsById[docId], nodeEntitiesById, today)
        || resolveQueuedDocTimelineDate(
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
        completed: Boolean(
          docId && isFolderTimelineCompleted(docId, docsById, nodeEntitiesById),
        ),
        sourceMicroLabel: resolveCampaignSourceMicroLabel(
          docsById[docId],
          nodeEntitiesById,
        ),
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

    for (const dateMarker of collectFolderLinkedDateMarkers({
      objectId,
      canvasNodes,
      docsById,
      nodeEntitiesById,
      allowedDateNodeIds: timelineDateNodeIds,
      today,
    })) {
      markerByKey.set(dateMarker.nodeId, dateMarker);
    }

    const docMarkers = [...markerByKey.values()];
    // Single shared ruler: same-day folders stack vertically in one column
    // (oldest Created on top = priority), date label renders under the stack.
    const columns = buildObjectRowFolderColumns(docMarkers, docsById);

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

    // Guest projections under this host company. The persisted wire is the
    // source of truth — do not gate on the Obj-Obj toggle, which Select mode
    // turns off (they are mutually exclusive canvas modes).
    if (primaryTimelineObjectId && objectId === primaryTimelineObjectId) {
      const projections = buildGuestInheritanceProjections({
        connections,
        canvasNodes,
        docsById,
        nodeEntitiesById,
        objectsById,
        primaryObjectId: primaryTimelineObjectId,
        timelineDocQueue,
        timelineDateNodeIds,
      });
      const guestsByDoc = new Map();
      for (const marker of projections.guestFolderMarkers) {
        if (!marker.docId) continue;
        if (!guestsByDoc.has(marker.docId)) guestsByDoc.set(marker.docId, []);
        guestsByDoc.get(marker.docId).push(marker);
      }
      for (const marker of projections.guestLaunchMarkers) {
        if (!marker.docId) continue;
        if (!guestsByDoc.has(marker.docId)) guestsByDoc.set(marker.docId, []);
        guestsByDoc.get(marker.docId).push(marker);
      }
      // Stash connector descriptors on the host row for the overlay.
      // Guest rows are pushed after children so expand stays above the guest strip.
      const hostRow = displayRows.find((r) => r.id === `object-${objectId}`);
      if (hostRow) {
        hostRow.inheritanceCrossLinks = projections.crossLinks;
        hostRow._pendingGuestRows = [];
        for (const [guestDocId, markers] of guestsByDoc) {
          const guestDoc = docsById[guestDocId];
          const guestTitle = (guestDoc?.title || guestDoc?.category || "Guest folder").trim();
          const guestObjectId = guestDoc?.parentObjectId || markers[0]?.sourceObjectId || null;
          hostRow._pendingGuestRows.push({
            id: `inherit-${objectId}-${guestDocId}`,
            rowKind: "inherit-guest",
            objectId,
            guestObjectId,
            guestDocId,
            objectName: guestTitle,
            label: guestTitle,
            objectColor,
            colorSoft,
            isCorpus: false,
            isPrimary: false,
            isInheritLayer: true,
            hasCrossLink: true,
            inherited: true,
            hideRuler: true,
            columns: buildTimelineColumns(markers),
            chain: null,
          });
        }
      }
    }

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

    // Host → children → guest strip (canvas-like stack under the same family).
    const hostRowForGuests = displayRows.find((r) => r.id === `object-${objectId}`);
    if (hostRowForGuests?._pendingGuestRows?.length) {
      displayRows.push(...hostRowForGuests._pendingGuestRows);
      delete hostRowForGuests._pendingGuestRows;
    }
  }

  const primaryRows = displayRows.filter((r) => r.rowKind === "object" && !r.inherited);
  const inheritRowsByObjectId = new Map();
  for (const row of displayRows.filter((r) => r.rowKind === "inherit-guest")) {
    if (!inheritRowsByObjectId.has(row.objectId)) inheritRowsByObjectId.set(row.objectId, []);
    inheritRowsByObjectId.get(row.objectId).push(row);
  }
  const childRowsByObjectId = new Map();
  for (const row of displayRows.filter((r) => r.rowKind === "children")) {
    if (!childRowsByObjectId.has(row.objectId)) childRowsByObjectId.set(row.objectId, []);
    childRowsByObjectId.get(row.objectId).push(row);
  }

  /** @type {typeof displayRows} */
  const orderedRows = [];
  for (const objectRow of primaryRows) {
    orderedRows.push(objectRow);
    // Children attach once, to the family's own ruler — never under guest strips.
    const childRows = childRowsByObjectId.get(objectRow.objectId);
    if (childRows) {
      orderedRows.push(...childRows);
      childRowsByObjectId.delete(objectRow.objectId);
    }
    const guestRows = inheritRowsByObjectId.get(objectRow.objectId);
    if (guestRows) {
      orderedRows.push(...guestRows);
      inheritRowsByObjectId.delete(objectRow.objectId);
    }
  }
  for (const leftover of inheritRowsByObjectId.values()) {
    orderedRows.push(...leftover);
  }

  // Scale the grid from folder dates (host + guest chips) so child rows don't
  // force month zoom-out. Guest chips share the host date → same X → straight cord.
  const folderMarkerDates = orderedRows
    .filter((row) => row.rowKind === "object" || row.rowKind === "inherit-guest")
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
      now: today,
    },
  );

  const dimensionSegmentsByRow = buildDocDimensionSegmentsByRow(
    orderedRows,
    displayGrid,
    classifiedConnections,
    today,
  );

  for (const row of orderedRows) {
    const isGuestStrip = row.rowKind === "inherit-guest";
    const segments = isGuestStrip ? [] : (dimensionSegmentsByRow.get(row.id) || []);
    row.rail = buildRowTimelineRail(row.columns, displayGrid, {
      segments,
      // Only this row's stretches — never bleed into folder rails.
      pairStretches: isGuestStrip
        ? []
        : (pairStretches || []).filter(
          (s) => s && String(s.rowId) === String(row.id),
        ),
      markerDates: (row.columns || []).map((col) => col.date).filter(Boolean),
      now: today,
    });
  }

  return {
    ...tactical,
    grid: displayGrid,
    displayRows: orderedRows,
    inheritanceCrossLinks: orderedRows
      .flatMap((r) => r.inheritanceCrossLinks || []),
  };
}
