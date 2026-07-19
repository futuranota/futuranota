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
export const TACTICAL_MIN_COLUMN_GAP_PCT = 10;
/**
 * Floor when compressing a pair on the live rail.
 * Must stay ≤ layout packing (`MIN_VISIBLE_GAP_PCT` / today→next nudge) or drags no-op.
 */
export const TACTICAL_PAIR_STRETCH_MIN_GAP_PCT = 1;
/** Local loupe: how far (%) the warp influence reaches from the focused node. */
export const TACTICAL_LOUPE_RADIUS_PCT = 28;
/** Cap how far a middle node can visually travel from its true date position. */
export const TACTICAL_LOUPE_MAX_SHIFT_PCT = 18;
/** Pair stretch (node ↔ next): allow a wider pull so first→second feels usable. */
export const TACTICAL_PAIR_MAX_SHIFT_PCT = 72;
/** Extra soft pull applied to the governing extreme (legacy soft loupe only). */
export const TACTICAL_LOUPE_EXTREME_COUPLE = 0.4;
const MS_PER_DAY = 86400000;
const GRID_PAD_DAYS = 1;

function smoothstep01(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

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
 * Default ruler = today's 24h clock pie (midnight → midnight).
 * Past days extend left; later days extend right (pending N days) without
 * collapsing today's hour:minute scale when content is same-day.
 * @param {Date[]} markerDates
 * @param {Date} today
 * @param {{ queueDocCount?: number }} [options]
 */
export function resolveTacticalGridBaseBounds(markerDates, today, _options = {}) {
  const todayDay = startOfCalendarDay(today);
  const dayEnd = new Date(todayDay.getTime() + MS_PER_DAY);
  const normalized = markerDates.filter(Boolean).map((d) => startOfCalendarDay(d));

  if (normalized.length === 0) {
    return { start: todayDay, end: dayEnd };
  }

  const dayTimes = normalized.map((d) => d.getTime());
  const minDay = Math.min(...dayTimes);
  const maxDay = Math.max(...dayTimes);

  // All markers on today → exact 24h thermometer ruler (9:43pm sits before 10pm).
  if (minDay >= todayDay.getTime() && maxDay < dayEnd.getTime()) {
    return { start: todayDay, end: dayEnd };
  }

  let start = todayDay;
  let end = dayEnd;
  if (minDay < todayDay.getTime()) {
    start = startOfCalendarDay(new Date(minDay));
  }
  if (maxDay >= dayEnd.getTime()) {
    end = startOfCalendarDay(new Date(maxDay + MS_PER_DAY));
  }
  return { start, end };
}

/**
 * Widen span when queued docs produce crowded markers on multi-day rails.
 * Never widen a pure 24h today pie — hour:minute must stay readable vs the thermometer.
 * @param {Date} start
 * @param {Date} end
 * @param {Date[]} markerDates
 * @param {number} [_queueDocCount]
 */
export function applyAutoZoomForQueue(start, end, markerDates, _queueDocCount) {
  const spanMs = end.getTime() - start.getTime();
  if (spanMs > 0 && spanMs <= MS_PER_DAY + 1000) {
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

  // Full datetime — sticker pan on the 24h clock must shift by hours, not snap to midnight.
  const nextStart = rangeOverride.startMs != null
    ? new Date(rangeOverride.startMs)
    : start;
  const nextEnd = rangeOverride.endMs != null
    ? new Date(rangeOverride.endMs)
    : end;

  if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
    return { start, end };
  }
  if (nextStart.getTime() >= nextEnd.getTime()) {
    return { start, end };
  }

  return { start: nextStart, end: nextEnd };
}

/** Minimum visible span when manually stretching range via dots (zoom in / compress). */
export const TACTICAL_MIN_RANGE_SPAN_MS = MS_PER_DAY * 3;
/** Maximum visible span when stretching outward (expand). */
export const TACTICAL_MAX_RANGE_SPAN_MS = MS_PER_DAY * 366;
/** Pad (%) so extreme folders stop at the ruler edges, not past them. */
export const TACTICAL_RULER_EDGE_PAD_PCT = 2;

/**
 * Tightest span where the first/last markers sit on the ruler extremes (pad → 100−pad).
 * Stretching further would push nodes past the ruler — not allowed.
 * @param {Date[]} markerDates
 * @param {number} [padPct]
 */
export function minSpanMsForRulerEdges(markerDates, padPct = TACTICAL_RULER_EDGE_PAD_PCT) {
  const sorted = [...(markerDates || [])]
    .filter(Boolean)
    .map((d) => startOfCalendarDay(d).getTime())
    .sort((a, b) => a - b);
  if (sorted.length < 2) return TACTICAL_MIN_RANGE_SPAN_MS;
  const contentMs = sorted[sorted.length - 1] - sorted[0];
  if (contentMs <= 0) return TACTICAL_MIN_RANGE_SPAN_MS;
  const usable = Math.max(0.5, (100 - 2 * padPct) / 100);
  return Math.max(TACTICAL_MIN_RANGE_SPAN_MS, contentMs / usable);
}

/**
 * Widest span that still keeps folders ≥1 calendar day apart from collapsing.
 * Different-day folders must keep at least `minGapPct` of the rail between them.
 * @param {Date[]} markerDates
 * @param {number} [minGapPct]
 */
export function maxSpanMsForDifferentDayFolders(
  markerDates,
  minGapPct = TACTICAL_MIN_COLUMN_GAP_PCT,
) {
  const unique = [...new Set(
    [...(markerDates || [])]
      .filter(Boolean)
      .map((d) => startOfCalendarDay(d).getTime()),
  )].sort((a, b) => a - b);

  if (unique.length < 2) return TACTICAL_MAX_RANGE_SPAN_MS;

  let minAdjacentDays = Infinity;
  for (let i = 1; i < unique.length; i += 1) {
    const days = (unique[i] - unique[i - 1]) / MS_PER_DAY;
    if (days >= 1 && days < minAdjacentDays) minAdjacentDays = days;
  }
  if (!Number.isFinite(minAdjacentDays)) return TACTICAL_MAX_RANGE_SPAN_MS;

  const gap = Math.max(1, minGapPct) / 100;
  const maxSpanDays = minAdjacentDays / gap;
  return Math.min(
    TACTICAL_MAX_RANGE_SPAN_MS,
    Math.max(TACTICAL_MIN_RANGE_SPAN_MS, maxSpanDays * MS_PER_DAY),
  );
}

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
 * @param {{ minSpanMs?: number, maxSpanMs?: number }} [limits]
 */
export function clampTacticalRangeMs(startMs, endMs, limits = {}) {
  const minSpan = limits.minSpanMs ?? TACTICAL_MIN_RANGE_SPAN_MS;
  const maxSpan = limits.maxSpanMs ?? TACTICAL_MAX_RANGE_SPAN_MS;
  let nextStart = startMs;
  let nextEnd = endMs;
  let span = nextEnd - nextStart;
  if (span < minSpan) {
    // Pin to the edge being dragged so extremes stop at the ruler limit.
    if (limits.pinEdge === "start") {
      nextStart = nextEnd - minSpan;
    } else if (limits.pinEdge === "end") {
      nextEnd = nextStart + minSpan;
    } else {
      return null;
    }
    span = nextEnd - nextStart;
  }
  if (span > maxSpan) {
    if (limits.pinEdge === "start") {
      nextStart = nextEnd - maxSpan;
    } else if (limits.pinEdge === "end") {
      nextEnd = nextStart + maxSpan;
    } else {
      const mid = (nextStart + nextEnd) / 2;
      nextStart = mid - maxSpan / 2;
      nextEnd = mid + maxSpan / 2;
    }
  }
  return {
    startMs: startOfCalendarDay(new Date(nextStart)).getTime(),
    endMs: startOfCalendarDay(new Date(nextEnd)).getTime(),
  };
}

/**
 * Apply one-edge drag against the auto base window.
 * Max compress = extreme folders sit on the ruler edges (both extremes).
 * @param {'start' | 'end'} edge
 * @param {number} startMs
 * @param {number} endMs
 * @param {number} baseStartMs
 * @param {number} baseEndMs
 * @param {number} originStartMs span at pointer-down
 * @param {number} originEndMs
 * @param {Date[]} [markerDates]
 * @returns {{ startMs: number, endMs: number } | null} null = reset override to base
 */
export function resolveTacticalEdgeDrag(
  edge,
  startMs,
  endMs,
  baseStartMs,
  baseEndMs,
  originStartMs,
  originEndMs,
  markerDates = [],
) {
  let nextStart = startMs;
  let nextEnd = endMs;

  if (edge === "start") {
    if (originStartMs < baseStartMs && nextStart > baseStartMs) {
      nextStart = baseStartMs;
    }
  } else if (originEndMs > baseEndMs && nextEnd < baseEndMs) {
    nextEnd = baseEndMs;
  }

  if (nextStart === baseStartMs && nextEnd === baseEndMs) {
    return null;
  }

  const minSpanMs = minSpanMsForRulerEdges(markerDates);
  const maxSpanMs = maxSpanMsForDifferentDayFolders(markerDates);
  return clampTacticalRangeMs(nextStart, nextEnd, {
    minSpanMs,
    maxSpanMs,
    pinEdge: edge === "anchor" ? null : edge,
  });
}

/**
 * Pan so `anchorMs` stays under `pct` (0–100) with the given span (sticker).
 * On a ~24h clock pie, keeps a 24h window and does not snap to calendar days.
 * @param {number} anchorMs
 * @param {number} pct
 * @param {number} spanMs
 * @param {Date[]} markerDates
 */
export function rangeFromAnchorPct(anchorMs, pct, spanMs, markerDates = []) {
  const p = Math.min(0.98, Math.max(0.02, pct / 100));
  const dayClock = spanMs > 0 && spanMs <= MS_PER_DAY + 1000;
  if (dayClock) {
    const span = MS_PER_DAY;
    const startMs = anchorMs - p * span;
    return { startMs, endMs: startMs + span };
  }
  const minSpanMs = minSpanMsForRulerEdges(markerDates);
  const maxSpanMs = maxSpanMsForDifferentDayFolders(markerDates);
  const span = Math.min(maxSpanMs, Math.max(minSpanMs, spanMs));
  const startMs = anchorMs - p * span;
  const endMs = startMs + span;
  return clampTacticalRangeMs(startMs, endMs, { minSpanMs, maxSpanMs });
}

/**
 * Max |delta| so a focus node moving toward a neighbor keeps ≥ minGap after both warp.
 * @param {number} focusPct
 * @param {number} neighborPct
 * @param {number} radiusPct
 * @param {number} minGapPct
 */
function maxLoupeDeltaTowardNeighbor(focusPct, neighborPct, radiusPct, minGapPct) {
  const naturalGap = Math.abs(neighborPct - focusPct);
  if (naturalGap <= 0) return 0;
  const d = naturalGap;
  const w = d >= radiusPct ? 0 : smoothstep01(1 - d / radiusPct);
  const shrinkFactor = Math.max(0.08, 1 - w);
  const room = naturalGap - minGapPct;
  if (room <= 0) return 0;
  return room / shrinkFactor;
}

/**
 * Resolve a stored loupe into warp params for the current grid.
 * Pair mode (default for stretch): focus moves vs its **next** queued neighbor only —
 * node 1↔2, then 2↔3 independently. Does not pan the window or couple to the last node.
 * @param {{ focusMs?: number, targetPct?: number, pairNextMs?: number | null } | null} raw
 * @param {{ pct: (d: Date) => number } | null} grid
 * @param {Date[]} [markerDates]
 */
export function resolveTacticalLoupe(raw, grid, markerDates = []) {
  if (!raw || !grid || raw.focusMs == null) return null;
  const focusDate = new Date(raw.focusMs);
  if (Number.isNaN(focusDate.getTime())) return null;
  const focusMs = focusDate.getTime();
  const focusNaturalPct = grid.pct(focusDate);
  if (!Number.isFinite(focusNaturalPct)) return null;

  const radiusPct = TACTICAL_LOUPE_RADIUS_PCT;
  const minGapPct = TACTICAL_MIN_COLUMN_GAP_PCT;
  let targetPct = Number(raw.targetPct);
  if (!Number.isFinite(targetPct)) return null;
  targetPct = Math.min(100, Math.max(0, targetPct));

  const unique = [...new Map(
    [...(markerDates || [])]
      .filter(Boolean)
      .map((d) => {
        const date = d instanceof Date ? d : new Date(d);
        const ms = date.getTime();
        return [ms, { ms, pct: grid.pct(date) }];
      }),
  ).values()].sort((a, b) => a.pct - b.pct || a.ms - b.ms);

  // Prefer exact ms match; fall back to nearest same calendar day for legacy midnight keys.
  let idx = unique.findIndex((n) => n.ms === focusMs);
  if (idx < 0) {
    const day = startOfCalendarDay(focusDate).getTime();
    idx = unique.findIndex((n) => startOfCalendarDay(new Date(n.ms)).getTime() === day);
  }

  // Pair stretch: explicit next, else chronological neighbor after focus.
  let next = null;
  if (raw.pairNextMs != null) {
    const nextMs = Number(raw.pairNextMs);
    next = unique.find((n) => n.ms === nextMs) || null;
    if (!next && Number.isFinite(nextMs)) {
      const nextDate = new Date(nextMs);
      const nextPct = grid.pct(nextDate);
      if (Number.isFinite(nextPct)) next = { ms: nextMs, pct: nextPct };
    }
  }
  if (!next && idx >= 0 && idx < unique.length - 1) {
    next = unique[idx + 1];
  }

  const pairMode = Boolean(next);
  let maxAbs = pairMode ? TACTICAL_PAIR_MAX_SHIFT_PCT : TACTICAL_LOUPE_MAX_SHIFT_PCT;

  if (pairMode) {
    const towardNext = maxLoupeDeltaTowardNeighbor(
      focusNaturalPct,
      next.pct,
      radiusPct,
      minGapPct,
    );
    // Away from next (expand gap): room to the left edge / previous node.
    let awayMax = Math.max(0, focusNaturalPct - 2);
    if (idx > 0) {
      awayMax = Math.min(
        awayMax,
        maxLoupeDeltaTowardNeighbor(
          focusNaturalPct,
          unique[idx - 1].pct,
          radiusPct,
          minGapPct,
        ),
      );
    }
    // Asymmetric clamp applied after we know delta sign.
    let deltaPct = targetPct - focusNaturalPct;
    if (deltaPct >= 0) {
      // Moving toward next → compress pair gap only.
      const toward = next.pct >= focusNaturalPct ? towardNext : awayMax;
      deltaPct = Math.min(toward, deltaPct);
    } else {
      const away = next.pct >= focusNaturalPct ? awayMax : towardNext;
      deltaPct = Math.max(-away, deltaPct);
    }
    if (Math.abs(deltaPct) < 0.05) return null;
    return {
      focusNaturalPct,
      deltaPct,
      nextNaturalPct: next.pct,
      pairMode: true,
      extremeNaturalPct: null,
      extremeBoostPct: 0,
      radiusPct,
    };
  }

  if (idx > 0) {
    const prev = unique[idx - 1];
    maxAbs = Math.min(
      maxAbs,
      maxLoupeDeltaTowardNeighbor(focusNaturalPct, prev.pct, radiusPct, minGapPct),
    );
  }
  if (idx >= 0 && idx < unique.length - 1) {
    const neighbor = unique[idx + 1];
    maxAbs = Math.min(
      maxAbs,
      maxLoupeDeltaTowardNeighbor(focusNaturalPct, neighbor.pct, radiusPct, minGapPct),
    );
  }

  let deltaPct = targetPct - focusNaturalPct;
  deltaPct = Math.min(maxAbs, Math.max(-maxAbs, deltaPct));
  if (Math.abs(deltaPct) < 0.05) {
    return null;
  }

  const extremeNaturalPct = unique.length
    ? (deltaPct >= 0 ? unique[unique.length - 1].pct : unique[0].pct)
    : focusNaturalPct;
  const extremeBoostPct = deltaPct * TACTICAL_LOUPE_EXTREME_COUPLE;

  return {
    focusNaturalPct,
    deltaPct,
    extremeNaturalPct,
    extremeBoostPct,
    radiusPct,
    pairMode: false,
    nextNaturalPct: null,
  };
}

/** Stable stretch key for the live thermometer (“today”) on a rail. */
export const TACTICAL_TODAY_FOCUS_KEY = "today";

/**
 * Insert today into the stretch chain when it sits among/before schedule nodes.
 * Order: …past → today → upcoming… so today stretches first vs its next node.
 * @param {Array<{ date: Date, leftPct: number, columnKey?: string }>} nodeGroups
 * @param {Date} now
 * @param {number} nowPct
 */
export function buildStretchUnitsWithToday(nodeGroups, now, nowPct) {
  const units = (nodeGroups || []).map((g) => ({ ...g, isToday: false }));
  if (!now || !units.length || !Number.isFinite(nowPct)) {
    return { units, todayIdx: -1 };
  }
  const nowMs = now.getTime();
  let insertAt = units.findIndex((g) => g?.date && g.date.getTime() > nowMs);
  if (insertAt < 0) {
    // All nodes are past — today is last in chain but has no next to stretch against.
    return { units, todayIdx: -1 };
  }
  // If today is already after the last node visually, skip.
  if (insertAt === 0 && nowPct >= units[0].leftPct - 0.01) {
    // still insert so today can pull left before first upcoming
  }
  const todayUnit = {
    columnKey: "__today__",
    date: now,
    leftPct: Math.min(98, Math.max(2, nowPct)),
    isToday: true,
    items: [],
  };
  units.splice(insertAt, 0, todayUnit);
  return { units, todayIdx: insertAt };
}

/** Nearest schedule column before `fromIdx` (skip thermometer). */
function prevScheduleIdx(nodeGroups, fromIdx) {
  for (let i = fromIdx - 1; i >= 0; i -= 1) {
    if (!nodeGroups[i]?.isToday) return i;
  }
  return -1;
}

/**
 * Pair stretch against already-laid-out rail positions (after fan-out / now-push).
 * Focus moves; next OR previous stays pinned; other nodes outside the pair freeze.
 * Supports focusKey === "today" for the thermometer unit.
 * @param {{ focusMs?: number, focusKey?: string | null, targetPct?: number, pairNextMs?: number | null, pairPrevMs?: number | null } | null} raw
 * @param {Array<{ date: Date, leftPct: number, isToday?: boolean }>} nodeGroups
 * @returns {{ focusIdx: number, nextIdx: number, focusLeftPct: number, nextLeftPct: number, deltaPct: number, pinPrev?: boolean } | null}
 */
export function resolvePairStretchOnRail(raw, nodeGroups) {
  if (!raw || !nodeGroups?.length) return null;
  let targetPct = Number(raw.targetPct);
  if (!Number.isFinite(targetPct)) return null;
  targetPct = Math.min(100, Math.max(0, targetPct));

  let focusIdx = -1;
  if (raw.focusKey === TACTICAL_TODAY_FOCUS_KEY) {
    focusIdx = nodeGroups.findIndex((g) => g?.isToday);
  } else if (raw.focusMs != null) {
    const focusMs = Number(raw.focusMs);
    if (!Number.isFinite(focusMs)) return null;
    focusIdx = nodeGroups.findIndex((g) => (
      !g?.isToday && g?.date && g.date.getTime() === focusMs
    ));
    if (focusIdx < 0) {
      const day = startOfCalendarDay(new Date(focusMs)).getTime();
      focusIdx = nodeGroups.findIndex(
        (g) => !g?.isToday && g?.date && startOfCalendarDay(g.date).getTime() === day,
      );
    }
  }
  if (focusIdx < 0) return null;

  const minGap = TACTICAL_PAIR_STRETCH_MIN_GAP_PCT;
  const maxShift = TACTICAL_PAIR_MAX_SHIFT_PCT;
  const focusLeftPct = nodeGroups[focusIdx].leftPct;
  let deltaPct = targetPct - focusLeftPct;

  // Last node (or explicit pairPrev): pin previous, move focus.
  const wantsPrevPin = raw.pairPrevMs != null
    || (raw.pairNextMs == null && focusIdx === nodeGroups.length - 1 && focusIdx > 0);

  if (wantsPrevPin) {
    let prevIdx = prevScheduleIdx(nodeGroups, focusIdx);
    if (raw.pairPrevMs != null) {
      const prevMs = Number(raw.pairPrevMs);
      const found = nodeGroups.findIndex((g) => (
        !g?.isToday && g?.date && g.date.getTime() === prevMs
      ));
      if (found >= 0 && found < focusIdx) prevIdx = found;
    }
    if (prevIdx < 0) return null;
    const prevLeftPct = nodeGroups[prevIdx].leftPct;
    const maxToward = Math.min(
      maxShift,
      Math.max(0, (focusLeftPct - prevLeftPct) - minGap),
    );
    // Launch / trailing node: freer slide toward the right edge.
    const maxAway = Math.min(maxShift, Math.max(0, 98 - focusLeftPct));
    if (deltaPct < 0) deltaPct = Math.max(deltaPct, -maxToward);
    else deltaPct = Math.min(deltaPct, maxAway);
    if (Math.abs(deltaPct) < 0.05) return null;
    return {
      focusIdx,
      nextIdx: prevIdx,
      focusLeftPct,
      nextLeftPct: prevLeftPct,
      deltaPct,
      pinPrev: true,
    };
  }

  if (focusIdx >= nodeGroups.length - 1) return null;

  let nextIdx = focusIdx + 1;
  if (raw.pairNextMs != null) {
    const nextMs = Number(raw.pairNextMs);
    const found = nodeGroups.findIndex((g) => (
      !g?.isToday && g?.date && g.date.getTime() === nextMs
    ));
    if (found > focusIdx) nextIdx = found;
  }
  // Prefer next schedule column (skip thermometer sitting between folder @ today and Launch).
  while (nextIdx < nodeGroups.length && nodeGroups[nextIdx]?.isToday) {
    nextIdx += 1;
  }
  if (nextIdx >= nodeGroups.length) return null;

  const nextLeftPct = nodeGroups[nextIdx].leftPct;
  const prevSched = prevScheduleIdx(nodeGroups, focusIdx);

  if (nextLeftPct >= focusLeftPct) {
    const maxToward = Math.min(
      maxShift,
      Math.max(0, (nextLeftPct - focusLeftPct) - minGap),
    );
    const maxAway = Math.min(
      maxShift,
      prevSched >= 0
        ? Math.max(0, (focusLeftPct - nodeGroups[prevSched].leftPct) - minGap)
        : Math.max(0, focusLeftPct - 2),
    );
    if (deltaPct > 0) deltaPct = Math.min(deltaPct, maxToward);
    else deltaPct = Math.max(deltaPct, -maxAway);
  } else {
    const maxToward = Math.min(
      maxShift,
      Math.max(0, (focusLeftPct - nextLeftPct) - minGap),
    );
    const maxAway = Math.min(maxShift, Math.max(0, 98 - focusLeftPct));
    if (deltaPct < 0) deltaPct = Math.max(deltaPct, -maxToward);
    else deltaPct = Math.min(deltaPct, maxAway);
  }

  if (Math.abs(deltaPct) < 0.05) return null;
  return {
    focusIdx,
    nextIdx,
    focusLeftPct,
    nextLeftPct,
    deltaPct,
    pinPrev: false,
  };
}

/**
 * Mutate nodeGroups[].leftPct for a pair stretch (next or previous pinned).
 * Prior nodes (index < focus) never move when pinning next.
 * @param {Array<{ leftPct: number }>} nodeGroups
 * @param {{ focusIdx: number, nextIdx: number, focusLeftPct: number, nextLeftPct: number, deltaPct: number, pinPrev?: boolean }} stretch
 */
export function applyPairStretchOnRail(nodeGroups, stretch) {
  if (!stretch || !nodeGroups?.length) return nodeGroups;
  const {
    focusIdx,
    nextIdx,
    focusLeftPct,
    nextLeftPct,
    deltaPct,
    pinPrev = false,
  } = stretch;

  if (pinPrev) {
    // Previous stays; only the focus (last / trailing) node slides.
    nodeGroups[focusIdx].leftPct = Math.min(98, Math.max(2, focusLeftPct + deltaPct));
    if (nextIdx >= 0 && nextIdx < nodeGroups.length) {
      nodeGroups[nextIdx].leftPct = nextLeftPct;
    }
    return nodeGroups;
  }

  const span = nextLeftPct - focusLeftPct;
  const newFocus = focusLeftPct + deltaPct;

  for (let i = 0; i < nodeGroups.length; i += 1) {
    // Freeze everything before the focus — stretching #2 must not move #1.
    if (i < focusIdx) continue;
    if (i > nextIdx) continue;
    // Thermometer stays put when stretching folder ↔ Launch across "today".
    if (nodeGroups[i]?.isToday) continue;
    if (i === nextIdx) {
      nodeGroups[i].leftPct = nextLeftPct;
      continue;
    }
    if (i === focusIdx || Math.abs(span) < 0.05) {
      nodeGroups[i].leftPct = Math.min(98, Math.max(2, focusLeftPct + deltaPct));
      continue;
    }
    const t = (nodeGroups[i].leftPct - focusLeftPct) / span;
    nodeGroups[i].leftPct = Math.min(
      98,
      Math.max(2, newFocus + t * (nextLeftPct - newFocus)),
    );
  }
  return nodeGroups;
}

/**
 * Replay committed pair stretches left→right so later drags never move earlier nodes.
 * Today (thermometer) sorts before schedule nodes when present in the chain.
 * @param {Array<{ date: Date, leftPct: number, isToday?: boolean }>} nodeGroups
 * @param {Array<{ focusMs?: number, focusKey?: string, pairNextMs?: number | null, pairPrevMs?: number | null, targetPct: number }>} stretches
 */
export function applyAllPairStretchesOnRail(nodeGroups, stretches) {
  if (!nodeGroups?.length || !stretches?.length) return nodeGroups;
  const indexOf = (spec) => {
    if (spec?.focusKey === TACTICAL_TODAY_FOCUS_KEY) {
      return nodeGroups.findIndex((g) => g?.isToday);
    }
    return nodeGroups.findIndex((g) => (
      !g?.isToday && g?.date && g.date.getTime() === Number(spec.focusMs)
    ));
  };
  const ordered = [...stretches].sort((a, b) => indexOf(a) - indexOf(b));
  for (const spec of ordered) {
    const live = resolvePairStretchOnRail({
      focusMs: spec.focusMs,
      focusKey: spec.focusKey || null,
      pairNextMs: spec.pairNextMs,
      pairPrevMs: spec.pairPrevMs,
      targetPct: spec.targetPct,
    }, nodeGroups);
    if (live) applyPairStretchOnRail(nodeGroups, live);
  }
  return nodeGroups;
}

/**
 * Soft local warp, or pair stretch from grid-natural loupe (legacy / segment path).
 * Prefer {@link resolvePairStretchOnRail} for rail dots after fan-out.
 * @param {number} naturalPct
 * @param {ReturnType<typeof resolveTacticalLoupe>} loupe
 */
export function applyTacticalLoupePct(naturalPct, loupe) {
  if (!loupe || !Number.isFinite(naturalPct)) return naturalPct;
  const {
    focusNaturalPct,
    deltaPct,
    extremeNaturalPct = null,
    extremeBoostPct = 0,
    radiusPct = TACTICAL_LOUPE_RADIUS_PCT,
    pairMode = false,
    nextNaturalPct = null,
  } = loupe;

  if (pairMode && nextNaturalPct != null && Number.isFinite(nextNaturalPct)) {
    const focus = focusNaturalPct;
    const next = nextNaturalPct;
    const lo = Math.min(focus, next);
    const hi = Math.max(focus, next);
    if (naturalPct < lo - 0.05 || naturalPct > hi + 0.05) {
      return naturalPct;
    }
    if (Math.abs(naturalPct - next) <= 0.05) {
      return next;
    }
    const span = next - focus;
    if (Math.abs(span) < 0.05) {
      return Math.min(100, Math.max(0, naturalPct + deltaPct));
    }
    const t = (naturalPct - focus) / span;
    const newFocus = focus + deltaPct;
    return Math.min(100, Math.max(0, newFocus + t * (next - newFocus)));
  }

  let shift = 0;
  const dFocus = Math.abs(naturalPct - focusNaturalPct);
  if (dFocus < radiusPct) {
    shift += deltaPct * smoothstep01(1 - dFocus / radiusPct);
  }
  if (
    extremeNaturalPct != null
    && extremeBoostPct
    && Math.abs(extremeNaturalPct - focusNaturalPct) > 0.5
  ) {
    const r2 = radiusPct * 1.15;
    const dEx = Math.abs(naturalPct - extremeNaturalPct);
    if (dEx < r2) {
      shift += extremeBoostPct * smoothstep01(1 - dEx / r2);
    }
  }
  return Math.min(100, Math.max(0, naturalPct + shift));
}

/**
 * Remap a horizontal segment through the loupe (edges warp independently).
 * @param {{ leftPct: number, widthPct: number }} seg
 * @param {ReturnType<typeof resolveTacticalLoupe>} loupe
 */
export function applyTacticalLoupeSegment(seg, loupe) {
  if (!loupe || !seg) return seg;
  const left = applyTacticalLoupePct(seg.leftPct, loupe);
  const right = applyTacticalLoupePct(seg.leftPct + seg.widthPct, loupe);
  return {
    ...seg,
    leftPct: Math.min(left, right),
    widthPct: Math.max(Math.abs(right - left), 0.5),
  };
}
