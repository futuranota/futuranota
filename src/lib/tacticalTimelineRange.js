import { startOfCalendarDay } from "../temporal.js";

export const TACTICAL_AUTO_ZOOM_MIN_DOCS = 4;
export const TACTICAL_MIN_MARKER_GAP_PCT = 8;
const MS_PER_DAY = 86400000;
const GRID_PAD_DAYS = 2;

function startOfCalendarMonth(date) {
  return startOfCalendarDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfCalendarMonth(date) {
  return startOfCalendarDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/**
 * @param {number} clientX
 * @param {HTMLElement} plotEl
 */
export function pctFromClientX(clientX, plotEl) {
  const rect = plotEl.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const x = clientX - rect.left;
  return Math.min(100, Math.max(0, (x / rect.width) * 100));
}

/**
 * @param {number} pct 0–100
 * @param {{ start: Date, end: Date }} grid
 */
export function dateFromPctOnGrid(pct, grid) {
  const total = grid.end.getTime() - grid.start.getTime() || MS_PER_DAY;
  const ts = grid.start.getTime() + (pct / 100) * total;
  return startOfCalendarDay(new Date(ts));
}

/**
 * Base calendar bounds before manual override / auto zoom padding.
 * @param {Date[]} markerDates
 * @param {Date} today
 */
export function resolveTacticalGridBaseBounds(markerDates, today) {
  const monthStart = startOfCalendarMonth(today);
  const monthEnd = endOfCalendarMonth(today);
  let start = monthStart;
  let end = monthEnd;

  const normalized = markerDates.filter(Boolean).map((d) => startOfCalendarDay(d));
  const todayDay = startOfCalendarDay(today);
  const anchorTs = normalized.map((d) => d.getTime());

  if (anchorTs.length > 0) {
    const minTs = Math.min(...anchorTs, todayDay.getTime());
    const maxTs = Math.max(...anchorTs, todayDay.getTime());
    if (minTs < monthStart.getTime()) {
      start = startOfCalendarDay(new Date(minTs - GRID_PAD_DAYS * MS_PER_DAY));
    }
    if (maxTs > monthEnd.getTime()) {
      end = startOfCalendarDay(new Date(maxTs + GRID_PAD_DAYS * MS_PER_DAY));
    }
  }

  return { start, end };
}

/**
 * Widen span when many queued docs produce crowded markers.
 * @param {Date} start
 * @param {Date} end
 * @param {Date[]} markerDates
 * @param {number} queueDocCount
 */
export function applyAutoZoomForQueue(start, end, markerDates, queueDocCount) {
  if (queueDocCount < TACTICAL_AUTO_ZOOM_MIN_DOCS) {
    return { start, end };
  }

  const sorted = [...markerDates]
    .filter(Boolean)
    .map((d) => startOfCalendarDay(d))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length < 2) return { start, end };

  let nextStart = start;
  let nextEnd = end;
  const minGap = TACTICAL_MIN_MARKER_GAP_PCT / 100;

  for (let i = 0; i < 24; i += 1) {
    const span = nextEnd.getTime() - nextStart.getTime() || MS_PER_DAY;
    let crowded = false;
    for (let j = 1; j < sorted.length; j += 1) {
      const gap = (sorted[j].getTime() - sorted[j - 1].getTime()) / span;
      if (gap < minGap) {
        crowded = true;
        break;
      }
    }
    if (!crowded) break;
    const extend = Math.max(MS_PER_DAY * 3, Math.round(span * 0.12));
    nextEnd = startOfCalendarDay(new Date(nextEnd.getTime() + extend));
    nextStart = startOfCalendarDay(new Date(nextStart.getTime() - Math.round(extend * 0.25)));
  }

  return { start: nextStart, end: nextEnd };
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ startMs?: number | null, endMs?: number | null } | null} rangeOverride
 */
export function applyTacticalRangeOverride(start, end, rangeOverride) {
  if (!rangeOverride) return { start, end };

  const nextStart = rangeOverride.startMs != null
    ? startOfCalendarDay(new Date(rangeOverride.startMs))
    : start;
  const nextEnd = rangeOverride.endMs != null
    ? startOfCalendarDay(new Date(rangeOverride.endMs))
    : end;

  if (nextStart.getTime() >= nextEnd.getTime()) {
    return { start, end };
  }

  return { start: nextStart, end: nextEnd };
}

/** Minimum visible span when manually adjusting range. */
export const TACTICAL_MIN_RANGE_SPAN_MS = MS_PER_DAY * 2;

/**
 * Keep anchor date at `pct` on the grid by solving for a new start (fixed end).
 * @param {number} anchorMs
 * @param {number} pct 0–100
 * @param {number} endMs
 */
export function gridStartMsFromAnchorPct(anchorMs, pct, endMs) {
  const p = Math.min(99.5, Math.max(0.5, pct / 100));
  const startMs = (anchorMs - p * endMs) / (1 - p);
  return startOfCalendarDay(new Date(startMs)).getTime();
}

/**
 * Keep anchor date at `pct` on the grid by solving for a new end (fixed start).
 * @param {number} anchorMs
 * @param {number} pct 0–100
 * @param {number} startMs
 */
export function gridEndMsFromAnchorPct(anchorMs, pct, startMs) {
  const p = Math.min(99.5, Math.max(0.5, pct / 100));
  const endMs = (anchorMs - startMs + p * startMs) / p;
  return startOfCalendarDay(new Date(endMs)).getTime();
}

/**
 * @param {number} startMs
 * @param {number} endMs
 */
export function clampTacticalRangeMs(startMs, endMs) {
  if (endMs - startMs < TACTICAL_MIN_RANGE_SPAN_MS) {
    return null;
  }
  return { startMs, endMs };
}
