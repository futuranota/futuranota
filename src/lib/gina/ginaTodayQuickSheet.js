/**
 * Today Quick Sheet — partition today's timed docs into progress sections.
 * Scope: same calendar day as `now` only (not yesterday / tomorrow).
 */

import { DOC_WORK_STATUS, resolveDocWorkStatus } from "../docWorkStatus.js";
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
 * Summarize today's overlaps for Gina copy.
 * Picks the document that overlaps the most other non-completed docs today.
 * @param {object[]} docs
 * @param {Date} [now]
 * @returns {{
 *   hasOverlap: boolean,
 *   topConflict: { id: string | null, title: string, overlapCount: number } | null,
 * }}
 */
export function summarizeTodayOverlaps(docs, now = new Date()) {
  const list = filterDocsAnchoredToday(docs, now).filter((d) => !isCompleted(d));
  /** @type {Map<string, { id: string | null, title: string, count: number }>} */
  const counts = new Map();
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (!intervalsOverlap(list[i], list[j])) continue;
      for (const d of [list[i], list[j]]) {
        const key = String(d.id || d.title || "");
        if (!key) continue;
        const cur = counts.get(key) || {
          id: d.id || null,
          title: String(d.title || "documento"),
          count: 0,
        };
        cur.count += 1;
        counts.set(key, cur);
      }
    }
  }
  let top = null;
  for (const row of counts.values()) {
    if (!top || row.count > top.count) top = row;
  }
  return {
    hasOverlap: Boolean(top && top.count > 0),
    topConflict: top
      ? { id: top.id, title: top.title, overlapCount: top.count }
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
