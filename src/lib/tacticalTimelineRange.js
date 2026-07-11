import { startOfCalendarDay } from "../temporal.js";

export const TACTICAL_AUTO_ZOOM_MIN_DOCS = 4;
export const TACTICAL_MIN_MARKER_GAP_PCT = 8;
/** Floor for a tight window when a single folder is alone on the rail. */
export const TACTICAL_TIGHT_MIN_SPAN_DAYS = 5;
/**
 * Target horizontal share (%) for the smallest adjacent day-gap between folders.
 * e.g. 2 calendar days apart → window ≈ 2 / 0.20 = 10 days so the gap reads clearly.
 */
export const TACTICAL_TIGHT_TARGET_GAP_PCT = 20;
/** Include "today" in a tight window only if it is near the folder cluster. */
export const TACTICAL_TIGHT_TODAY_REACH_DAYS = 45;
/** Minimum horizontal gap (%) used when estimating crowded auto-zoom. */
export const TACTICAL_MIN_COLUMN_GAP_PCT = 11;
const MS_PER_DAY = 86400000;
const GRID_PAD_DAYS = 1;

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
 * Tight window around folder dates so day gaps stay readable (not month-zoomed-out).
 * Chronology stays true: past stays left of today via grid.pct.
 * @param {Date[]} normalizedDates
 * @param {Date} todayDay
 */
function resolveTightGridBounds(normalizedDates, todayDay) {
  const anchorTs = normalizedDates.map((d) => d.getTime());
  let minTs = Math.min(...anchorTs);
  let maxTs = Math.max(...anchorTs);
  const todayTs = todayDay.getTime();
  const reachMs = TACTICAL_TIGHT_TODAY_REACH_DAYS * MS_PER_DAY;
  const anyPast = anchorTs.some((ts) => ts < todayTs);
  if (
    anyPast
    || (todayTs >= minTs - reachMs && todayTs <= maxTs + reachMs)
  ) {
    minTs = Math.min(minTs, todayTs);
    maxTs = Math.max(maxTs, todayTs);
  }

  const contentSpanDays = Math.max(0, (maxTs - minTs) / MS_PER_DAY);
  const uniqueDays = [...new Set(anchorTs)].sort((a, b) => a - b);

  let minAdjacentDays = Infinity;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const days = (uniqueDays[i] - uniqueDays[i - 1]) / MS_PER_DAY;
    if (days > 0 && days < minAdjacentDays) minAdjacentDays = days;
  }

  // Ideal span so the smallest folder gap occupies ~TARGET% of the rail.
  let idealSpanDays = TACTICAL_TIGHT_MIN_SPAN_DAYS;
  if (Number.isFinite(minAdjacentDays) && uniqueDays.length >= 2) {
    idealSpanDays = Math.ceil(
      minAdjacentDays / (TACTICAL_TIGHT_TARGET_GAP_PCT / 100),
    );
  }

  // Prefer ideal when the cluster already fits inside it (spreads folders on screen).
  const finalSpanDays = contentSpanDays <= idealSpanDays
    ? Math.max(idealSpanDays, contentSpanDays + 2 * GRID_PAD_DAYS)
    : Math.max(contentSpanDays + 2 * GRID_PAD_DAYS, TACTICAL_TIGHT_MIN_SPAN_DAYS);

  const mid = (minTs + maxTs) / 2;
  let start = startOfCalendarDay(new Date(mid - (finalSpanDays * MS_PER_DAY) / 2));
  let end = startOfCalendarDay(new Date(mid + (finalSpanDays * MS_PER_DAY) / 2));

  // Never clip folder/today anchors off the rail.
  if (start.getTime() > minTs - GRID_PAD_DAYS * MS_PER_DAY) {
    start = startOfCalendarDay(new Date(minTs - GRID_PAD_DAYS * MS_PER_DAY));
  }
  if (end.getTime() < maxTs + GRID_PAD_DAYS * MS_PER_DAY) {
    end = startOfCalendarDay(new Date(maxTs + GRID_PAD_DAYS * MS_PER_DAY));
  }

  return { start, end };
}

/**
 * Base calendar bounds before manual override / auto zoom padding.
 * Prefer a gap-aware tight window whenever there are markers so inserting
 * another folder does not snap back to month zoom-out (visual collapse).
 * Empty rail → current month.
 * @param {Date[]} markerDates
 * @param {Date} today
 * @param {{ queueDocCount?: number }} [options]
 */
export function resolveTacticalGridBaseBounds(markerDates, today, options = {}) {
  const monthStart = startOfCalendarMonth(today);
  const monthEnd = endOfCalendarMonth(today);
  const todayDay = startOfCalendarDay(today);
  const normalized = markerDates.filter(Boolean).map((d) => startOfCalendarDay(d));

  if (normalized.length > 0) {
    return resolveTightGridBounds(normalized, todayDay);
  }

  return { start: monthStart, end: monthEnd };
}

/**
 * Widen span when queued docs produce crowded markers.
 * Always available (not only ≥4) so inserting folders keeps readable gaps
 * without snapping to a month floor.
 * @param {Date} start
 * @param {Date} end
 * @param {Date[]} markerDates
 * @param {number} [_queueDocCount]
 */
export function applyAutoZoomForQueue(start, end, markerDates, _queueDocCount) {
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

/** Minimum visible span when manually stretching range via dots (zoom in). */
export const TACTICAL_MIN_RANGE_SPAN_MS = MS_PER_DAY * 3;

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
