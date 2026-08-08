/**
 * Today Quick Sheet — partition today's timed docs into progress sections.
 * Scope: same calendar day as `now` only (not yesterday / tomorrow).
 */

import { DOC_WORK_STATUS, resolveDocWorkStatus } from "../docWorkStatus.js";
import { formatClock12h } from "../clockFormat.js";
import { isMarkablePassedSlot, isPassedSlot } from "./ginaScheduleRecovery.js";

function dayKey(value) {
  const d = value instanceof Date ? value : (value ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a, b) {
  const ka = dayKey(a);
  const kb = dayKey(b);
  return Boolean(ka && kb && ka === kb);
}

function isCompleted(doc) {
  const status = resolveDocWorkStatus(doc);
  return status === DOC_WORK_STATUS.COMPLETED || doc?.completed === true;
}

function isPastDueStatus(doc) {
  const status = resolveDocWorkStatus(doc);
  return status === DOC_WORK_STATUS.PAST_DUE || Boolean(doc?.isPastDue);
}

function sortByAnchor(docs) {
  return (Array.isArray(docs) ? docs : [])
    .slice()
    .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")));
}

/**
 * Keep only docs anchored on the same calendar day as `now`.
 * @param {object[]} docs
 * @param {Date} [now]
 */
export function filterDocsAnchoredToday(docs, now = new Date()) {
  const clock = now instanceof Date ? now : new Date();
  return (Array.isArray(docs) ? docs : []).filter((d) => {
    const at = d?.anchorAt || d?.startedAt;
    return at && sameDay(at, clock);
  });
}

/**
 * Two intervals overlap (same day assumed by caller).
 * @param {object} a
 * @param {object} b
 */
export function intervalsOverlap(a, b) {
  const a0 = a?.anchorAt ? new Date(a.anchorAt).getTime() : NaN;
  const a1 = a?.anchorFinishAt ? new Date(a.anchorFinishAt).getTime() : NaN;
  const b0 = b?.anchorAt ? new Date(b.anchorAt).getTime() : NaN;
  const b1 = b?.anchorFinishAt ? new Date(b.anchorFinishAt).getTime() : NaN;
  if (![a0, a1, b0, b1].every((n) => Number.isFinite(n))) return false;
  return a0 < b1 && b0 < a1;
}

/**
 * @param {object[]} docs today-scoped (may include other days — filtered)
 * @param {Date} [now]
 * @returns {boolean}
 */
export function todayHasScheduleOverlap(docs, now = new Date()) {
  const list = filterDocsAnchoredToday(docs, now).filter((d) => !isCompleted(d));
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (intervalsOverlap(list[i], list[j])) return true;
    }
  }
  return false;
}

/**
 * Chip kind for urgency rows.
 * @param {object} doc
 * @returns {"past_due" | "status_unassigned"}
 */
export function urgencyChipKind(doc) {
  if (isPastDueStatus(doc)) return "past_due";
  return "status_unassigned";
}

/**
 * Partition today's docs into Quick sheet sections.
 * @param {object[]} docs
 * @param {Date} [now]
 * @returns {{
 *   completed: object[],
 *   urgency: object[],
 *   pending: object[],
 *   hasOverlap: boolean,
 *   isCleanDay: boolean,
 *   firstPending: object | null,
 * }}
 */
export function buildTodayQuickSheetSections(docs, now = new Date()) {
  const clock = now instanceof Date ? now : new Date();
  const todayDocs = filterDocsAnchoredToday(docs, clock);

  /** @type {object[]} */
  const completed = [];
  /** @type {object[]} */
  const urgency = [];
  /** @type {object[]} */
  const pending = [];

  for (const d of todayDocs) {
    if (isCompleted(d)) {
      completed.push(d);
      continue;
    }
    // Urgency: already past_due, or time window passed (markable / passed)
    if (isPastDueStatus(d) || isPassedSlot(d, clock)) {
      urgency.push({
        ...d,
        urgencyChip: urgencyChipKind(d),
        markable: isMarkablePassedSlot(d, clock),
      });
      continue;
    }
    pending.push(d);
  }

  const completedSorted = sortByAnchor(completed);
  const urgencySorted = sortByAnchor(urgency);
  const pendingSorted = sortByAnchor(pending);
  const hasOverlap = todayHasScheduleOverlap(todayDocs, clock);
  const isCleanDay = completedSorted.length === 0
    && urgencySorted.length === 0
    && !hasOverlap
    && pendingSorted.length > 0;

  return {
    completed: completedSorted,
    urgency: urgencySorted,
    pending: pendingSorted,
    hasOverlap,
    isCleanDay,
    firstPending: pendingSorted[0] || null,
  };
}

/**
 * Map raw docs to light rows for viz (caller may also mapDocRow).
 * @param {object} sections from buildTodayQuickSheetSections
 * @param {(d: object) => object} mapRow
 */
export function mapQuickSheetSections(sections, mapRow) {
  const mapList = (list) => (Array.isArray(list) ? list : []).map((d) => {
    const row = typeof mapRow === "function" ? mapRow(d) : d;
    return {
      ...row,
      anchorAt: d.anchorAt || row.anchorAt || null,
      anchorFinishAt: d.anchorFinishAt || row.anchorFinishAt || null,
      urgencyChip: d.urgencyChip || null,
      markable: Boolean(d.markable),
      struck: Boolean(row.struck || row.completed || d.status === "completed"),
    };
  });
  return {
    completed: mapList(sections.completed),
    urgency: mapList(sections.urgency),
    pending: mapList(sections.pending),
    hasOverlap: Boolean(sections.hasOverlap),
    isCleanDay: Boolean(sections.isCleanDay),
    firstPendingId: sections.firstPending?.id || null,
    firstPendingTitle: sections.firstPending?.title || null,
  };
}

/**
 * Summarize today's overlaps for Gina copy + Dual Timeline.
 * Picks the document that overlaps the most other non-completed docs today.
 * @param {object[]} docs
 * @param {Date} [now]
 * @returns {{
 *   hasOverlap: boolean,
 *   topConflict: {
 *     id: string | null,
 *     title: string,
 *     department: string | null,
 *     anchorAt: string | null,
 *     anchorFinishAt: string | null,
 *     overlapCount: number,
 *     timeLabel: string | null,
 *     displayLabel: string,
 *   } | null,
 *   conflictRails: {
 *     rangeStart: string,
 *     rangeEnd: string,
 *     longBlock: object,
 *     overlappingBlocks: object[],
 *   } | null,
 * }}
 */
export function summarizeTodayOverlaps(docs, now = new Date()) {
  const list = filterDocsAnchoredToday(docs, now).filter((d) => !isCompleted(d));
  /** @type {Map<string, { doc: object, count: number, others: object[] }>} */
  const counts = new Map();

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (!intervalsOverlap(list[i], list[j])) continue;
      for (const [self, other] of [[list[i], list[j]], [list[j], list[i]]]) {
        const key = String(self.id || self.title || "");
        if (!key) continue;
        const cur = counts.get(key) || { doc: self, count: 0, others: [] };
        cur.count += 1;
        if (!cur.others.some((o) => (o.id || o.title) === (other.id || other.title))) {
          cur.others.push(other);
        }
        counts.set(key, cur);
      }
    }
  }

  let topEntry = null;
  for (const row of counts.values()) {
    if (!topEntry || row.count > topEntry.count) topEntry = row;
  }

  if (!topEntry) {
    return { hasOverlap: false, topConflict: null, conflictRails: null };
  }

  const long = topEntry.doc;
  const a0 = long.anchorAt ? new Date(long.anchorAt).getTime() : NaN;
  const a1 = long.anchorFinishAt ? new Date(long.anchorFinishAt).getTime() : NaN;
  let rangeStart = a0;
  let rangeEnd = a1;
  for (const o of topEntry.others) {
    const b0 = o.anchorAt ? new Date(o.anchorAt).getTime() : NaN;
    const b1 = o.anchorFinishAt ? new Date(o.anchorFinishAt).getTime() : NaN;
    if (Number.isFinite(b0)) rangeStart = Number.isFinite(rangeStart) ? Math.min(rangeStart, b0) : b0;
    if (Number.isFinite(b1)) rangeEnd = Number.isFinite(rangeEnd) ? Math.max(rangeEnd, b1) : b1;
  }

  const department = String(long.departmentName || long.department || "").trim() || null;
  const timeLabel = (Number.isFinite(a0) && Number.isFinite(a1))
    ? `${formatClock12h(new Date(a0))} – ${formatClock12h(new Date(a1))}`
    : null;
  const displayLabel = department && timeLabel
    ? `${department} (${timeLabel})`
    : (timeLabel || String(long.title || "documento"));

  const toRailBlock = (d) => ({
    id: d.id || null,
    title: String(d.title || "").trim() || "—",
    department: String(d.departmentName || d.department || "").trim() || null,
    category: String(d.category || "").trim() || null,
    anchorAt: d.anchorAt || null,
    anchorFinishAt: d.anchorFinishAt || null,
    startMs: d.anchorAt ? new Date(d.anchorAt).getTime() : null,
    finishMs: d.anchorFinishAt ? new Date(d.anchorFinishAt).getTime() : null,
    label: String(d.departmentName || d.department || d.title || "—").trim(),
  });

  return {
    hasOverlap: true,
    topConflict: {
      id: long.id || null,
      title: String(long.title || "documento"),
      department,
      anchorAt: long.anchorAt || null,
      anchorFinishAt: long.anchorFinishAt || null,
      overlapCount: topEntry.count,
      timeLabel,
      displayLabel,
    },
    conflictRails: Number.isFinite(rangeStart) && Number.isFinite(rangeEnd)
      ? {
        rangeStart: new Date(rangeStart).toISOString(),
        rangeEnd: new Date(rangeEnd).toISOString(),
        longBlock: toRailBlock(long),
        overlappingBlocks: topEntry.others
          .map(toRailBlock)
          .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || ""))),
      }
      : null,
  };
}

/**
 * Flatten quick sheet into chronological rows (by anchorAt), preserving section tags.
 * @param {{ completed?: object[], urgency?: object[], pending?: object[] } | null | undefined} quickSheet
 * @returns {object[]}
 */
export function flattenTodayQuickSheetRows(quickSheet) {
  if (!quickSheet || typeof quickSheet !== "object") return [];
  const completed = (Array.isArray(quickSheet.completed) ? quickSheet.completed : []).map((d) => ({
    ...d,
    sheetSection: "completed",
    struck: true,
    completed: true,
    status: d.status || "completed",
  }));
  const urgency = (Array.isArray(quickSheet.urgency) ? quickSheet.urgency : []).map((d) => ({
    ...d,
    sheetSection: "urgency",
  }));
  const pending = (Array.isArray(quickSheet.pending) ? quickSheet.pending : []).map((d) => ({
    ...d,
    sheetSection: "pending",
  }));
  return [...completed, ...urgency, ...pending].sort((a, b) => (
    String(a.anchorAt || "").localeCompare(String(b.anchorAt || ""))
  ));
}
