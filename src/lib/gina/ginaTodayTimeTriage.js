/**
 * Partition today's scheduled docs by wall-clock vs block range.
 * fullyExpired | lateStartActive | future
 */

import { DOC_WORK_STATUS } from "../docWorkStatus.js";
import { formatClock12h } from "../clockFormat.js";

function isCompleted(doc) {
  return Boolean(doc?.completed || doc?.status === DOC_WORK_STATUS.COMPLETED);
}

function startMs(doc) {
  const raw = doc?.anchorAt || doc?.startedAt || null;
  if (!raw) return NaN;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function finishMs(doc) {
  const raw = doc?.anchorFinishAt || doc?.dueAt || null;
  if (!raw) return NaN;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function isNotStartedish(doc) {
  const s = doc?.status;
  return s == null
    || s === DOC_WORK_STATUS.NOT_STARTED
    || s === DOC_WORK_STATUS.FLEXIBLE
    || s === "";
}

/**
 * @param {object[]} docs
 * @param {Date} [now]
 * @returns {{
 *   fullyExpired: object[],
 *   lateStartActive: object[],
 *   future: object[],
 *   actionable: object[],
 * }}
 */
export function partitionTodayByClock(docs, now = new Date()) {
  const clock = now instanceof Date ? now : new Date();
  const nowMs = clock.getTime();
  /** @type {object[]} */
  const fullyExpired = [];
  /** @type {object[]} */
  const lateStartActive = [];
  /** @type {object[]} */
  const future = [];

  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || isCompleted(d)) continue;
    if (d.status === DOC_WORK_STATUS.PAST_DUE) {
      // Already archived — still list under expired for viz if finish passed
      const f = finishMs(d);
      if (Number.isFinite(f) && f < nowMs) fullyExpired.push(d);
      continue;
    }
    const a = startMs(d);
    const f = finishMs(d);
    if (!Number.isFinite(a) && !Number.isFinite(f)) continue;

    if (Number.isFinite(f) && f < nowMs) {
      fullyExpired.push(d);
      continue;
    }
    if (Number.isFinite(a) && a < nowMs && (!Number.isFinite(f) || f >= nowMs) && isNotStartedish(d)) {
      lateStartActive.push(d);
      continue;
    }
    if (Number.isFinite(a) && a >= nowMs) {
      future.push(d);
      continue;
    }
    // In progress during active window, or started with no finish — treat as future/active non-action
    if (Number.isFinite(a) && a < nowMs && Number.isFinite(f) && f >= nowMs) {
      // Active but already in_progress / submitted — skip actionable late-start
      continue;
    }
  }

  const sort = (list) => list.slice().sort((x, y) => String(x.anchorAt || "").localeCompare(String(y.anchorAt || "")));
  const fully = sort(fullyExpired);
  const late = sort(lateStartActive);
  const fut = sort(future);
  return {
    fullyExpired: fully,
    lateStartActive: late,
    future: fut,
    actionable: [...fully.filter((d) => d.status !== DOC_WORK_STATUS.PAST_DUE), ...late],
  };
}

/**
 * Labels like "Sales a las 4:45 PM" for late-start copy.
 * @param {object[]} docs
 * @returns {{ label: string, time: string, title: string, department: string }[]}
 */
export function mapLateStartLabels(docs) {
  return (Array.isArray(docs) ? docs : []).map((d) => {
    const department = String(d.departmentName || d.department || "").trim();
    const title = String(d.title || "documento").trim();
    const time = d.anchorAt ? formatClock12h(new Date(d.anchorAt)) : "";
    const label = department || title;
    return { label, time, title, department, id: d.id || null };
  });
}

/**
 * Free contiguous slot finder on a day (15-min grid), after `fromMs`.
 * @param {Array<{ startMs: number, finishMs: number }>} occupied
 * @param {number} durationMs
 * @param {number} fromMs
 * @param {number} dayEndMs
 * @returns {{ startMs: number, finishMs: number } | null}
 */
export function findFirstFreeSlot(occupied, durationMs, fromMs, dayEndMs) {
  const dur = Math.max(15 * 60 * 1000, Number(durationMs) || 60 * 60 * 1000);
  const step = 15 * 60 * 1000;
  let cursor = Math.ceil(fromMs / step) * step;
  const sorted = (Array.isArray(occupied) ? occupied : [])
    .filter((o) => Number.isFinite(o.startMs) && Number.isFinite(o.finishMs))
    .slice()
    .sort((a, b) => a.startMs - b.startMs);

  while (cursor + dur <= dayEndMs) {
    const end = cursor + dur;
    const hits = sorted.some((o) => cursor < o.finishMs && end > o.startMs);
    if (!hits) return { startMs: cursor, finishMs: end };
    // jump to end of blocking interval
    const blocker = sorted.find((o) => cursor < o.finishMs && end > o.startMs);
    cursor = blocker
      ? Math.ceil(blocker.finishMs / step) * step
      : cursor + step;
  }
  return null;
}

/**
 * Last finish tonight among occupied intervals.
 * @param {Array<{ finishMs: number }>} occupied
 * @param {number} fallbackMs
 */
export function lastOccupiedFinishMs(occupied, fallbackMs) {
  let max = Number.isFinite(fallbackMs) ? fallbackMs : Date.now();
  for (const o of Array.isArray(occupied) ? occupied : []) {
    if (Number.isFinite(o.finishMs) && o.finishMs > max) max = o.finishMs;
  }
  return max;
}
