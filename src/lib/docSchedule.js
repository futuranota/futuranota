import { daysBetween } from "../data.jsx";
import { parseDate, sameCalendarDay, startOfCalendarDay } from "../temporal.js";
import { isoFromAnchorFields } from "./nodeAnchor.js";

const MS_PER_MINUTE = 60000;

/**
 * Explicit document schedule only (Launch / block Schedule) — no createdAt fallback.
 * Used so timeline placement follows saved schedule over stale canvas dates.
 * @param {object | null | undefined} doc
 * @returns {Date | null}
 */
export function resolveExplicitDocScheduleDate(doc) {
  if (!doc) return null;

  if (doc.launchAt) {
    const d = parseDate(doc.launchAt);
    if (d) return d;
  }

  for (const block of doc.blocks || []) {
    const date = String(block?.anchorDate || "").trim();
    if (!date) continue;
    if (block.anchorFromNode === false) continue;
    const iso = isoFromAnchorFields(date, block.anchorTime || "");
    if (!iso) continue;
    const d = parseDate(iso);
    if (d) return d;
  }

  return null;
}

/**
 * Resolve a document's schedule datetime (day + hour + minute) for timeline / content list.
 * Prefers explicit Schedule fields, then launchAt, then linked node anchors, then createdAt.
 * @param {object | null | undefined} doc
 * @param {Record<string, object>} [nodeEntitiesById]
 * @returns {Date | null}
 */
export function resolveDocScheduleDate(doc, nodeEntitiesById = {}) {
  if (!doc) return null;

  const explicit = resolveExplicitDocScheduleDate(doc);
  if (explicit) return explicit;

  for (const entityId of doc.nodeIds || []) {
    const entity = nodeEntitiesById[entityId];
    if (!entity?.anchorAt) continue;
    const d = parseDate(entity.anchorAt);
    if (d) return d;
  }

  if (doc.createdAt) {
    const d = parseDate(doc.createdAt);
    if (d) return d;
  }

  return null;
}

/**
 * True when the schedule carries an explicit clock time (not date-only).
 * @param {object | null | undefined} doc
 * @param {Record<string, object>} [nodeEntitiesById]
 */
export function docScheduleHasExplicitTime(doc, nodeEntitiesById = {}) {
  if (!doc) return false;
  if (doc.launchAt && /T\d{2}:\d{2}/.test(String(doc.launchAt))) return true;
  for (const block of doc.blocks || []) {
    if (String(block?.anchorDate || "").trim() && String(block?.anchorTime || "").trim()) {
      return true;
    }
  }
  for (const entityId of doc.nodeIds || []) {
    const entity = nodeEntitiesById[entityId];
    if (entity?.anchorAt && /T\d{2}:\d{2}/.test(String(entity.anchorAt))) return true;
  }
  return false;
}

/**
 * Chronological gap between two schedule datetimes.
 * @param {Date} fromDate
 * @param {Date} toDate
 * @returns {{
 *   kind: 'same-day' | 'days',
 *   minutes: number,
 *   hours: number,
 *   days: number,
 *   absMs: number,
 * }}
 */
export function resolveTimelineTimeGap(fromDate, toDate) {
  const a = fromDate instanceof Date ? fromDate : parseDate(fromDate);
  const b = toDate instanceof Date ? toDate : parseDate(toDate);
  if (!a || !b) {
    return { kind: "days", minutes: 0, hours: 0, days: 0, absMs: 0 };
  }
  const absMs = Math.abs(b.getTime() - a.getTime());
  const minutes = Math.round(absMs / MS_PER_MINUTE);
  const hours = Math.floor(minutes / 60);
  if (sameCalendarDay(a, b)) {
    return { kind: "same-day", minutes, hours, days: 0, absMs };
  }
  const days = Math.abs(daysBetween(startOfCalendarDay(a), startOfCalendarDay(b)));
  return { kind: "days", minutes, hours, days, absMs };
}

/**
 * Plain duration fragment: "45m" | "2h" | "2h 10m"
 * @param {number} minutes
 */
export function formatDurationMinutesPlain(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 1) return "0m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Plain fallback label (no i18n): "same day · 45m" | "2d".
 * @param {ReturnType<typeof resolveTimelineTimeGap>} gap
 */
export function formatTimelineTimeGapPlain(gap) {
  if (!gap) return "";
  if (gap.kind === "same-day") {
    if (gap.minutes < 1) return "same day";
    return `same day · ${formatDurationMinutesPlain(gap.minutes)}`;
  }
  if (gap.days > 0) return `${gap.days}d`;
  return formatDurationMinutesPlain(Math.max(1, gap.minutes));
}

/**
 * i18n label for a chronological gap (legacy compact form).
 * @param {ReturnType<typeof resolveTimelineTimeGap>} gap
 * @param {(key: string, vars?: object) => string} t
 */
export function formatTimelineTimeGapLabel(gap, t) {
  if (!gap || typeof t !== "function") return formatTimelineTimeGapPlain(gap);
  if (gap.kind === "same-day") {
    if (gap.minutes < 1) return t("timeline.sameDay");
    if (gap.minutes < 60) {
      return t("timeline.sameDayMinutes", { count: gap.minutes });
    }
    const h = gap.hours;
    const m = gap.minutes % 60;
    if (m > 0) return t("timeline.sameDayHoursMinutes", { hours: h, minutes: m });
    return t("timeline.sameDayHours", { count: h });
  }
  if (gap.days > 0) {
    return t("timeline.gapDays", { count: gap.days, s: gap.days === 1 ? "" : "s" });
  }
  return formatTimelineTimeGapPlain(gap);
}

/**
 * Same-day pair center label: "same day" + "sched 45m (past due)" / today remaining.
 * @param {{ from: Date, to: Date, now?: Date, hasExplicitTime?: boolean }} args
 * @param {(key: string, vars?: object) => string} [t]
 */
export function formatSameDayPairLabel({ from, to, now = new Date(), hasExplicitTime = true }, t) {
  const gap = resolveTimelineTimeGap(from, to);
  const day = startOfCalendarDay(from);
  const today = startOfCalendarDay(now);
  const dayDelta = daysBetween(today, day);
  /** @type {'past-due' | 'today' | 'pending'} */
  let statusKind = "pending";
  if (dayDelta < 0) statusKind = "past-due";
  else if (dayDelta === 0) statusKind = "today";

  const useT = typeof t === "function";
  const headline = useT ? t("timeline.sameDay") : "same day";
  const durationPlain = formatDurationMinutesPlain(gap.minutes);
  const schedPart = gap.minutes < 1
    ? ""
    : (useT ? t("timeline.schedDuration", { duration: durationPlain }) : `sched ${durationPlain}`);

  let detail = schedPart;
  let remainingMinutes = null;

  if (statusKind === "past-due") {
    const status = useT ? t("timeline.pastDueParen") : "(past due)";
    detail = schedPart ? `${schedPart} ${status}` : status;
  } else if (statusKind === "pending") {
    const status = useT ? t("timeline.pendingParen") : "(pending)";
    detail = schedPart ? `${schedPart} ${status}` : status;
  } else if (statusKind === "today" && hasExplicitTime && gap.minutes >= 1) {
    // Today only: remaining time between the two set timers relative to now.
    const earlier = from.getTime() <= to.getTime() ? from : to;
    const later = from.getTime() <= to.getTime() ? to : from;
    const nowMs = now.getTime();
    if (nowMs < earlier.getTime()) {
      remainingMinutes = Math.max(0, Math.round((earlier.getTime() - nowMs) / MS_PER_MINUTE));
      const until = useT
        ? t("timeline.timeUntil", { duration: formatDurationMinutesPlain(remainingMinutes) })
        : `in ${formatDurationMinutesPlain(remainingMinutes)}`;
      detail = `${schedPart} · ${until}`;
    } else if (nowMs < later.getTime()) {
      remainingMinutes = Math.max(0, Math.round((later.getTime() - nowMs) / MS_PER_MINUTE));
      const left = useT
        ? t("timeline.timeLeft", { duration: formatDurationMinutesPlain(remainingMinutes) })
        : `${formatDurationMinutesPlain(remainingMinutes)} left`;
      detail = `${schedPart} · ${left}`;
    } else {
      const status = useT ? t("timeline.pastDueParen") : "(past due)";
      detail = `${schedPart} ${status}`;
    }
  } else if (statusKind === "today") {
    detail = schedPart;
  }

  const singleLine = detail
    ? `${headline} · ${detail}`
    : headline;

  return {
    headline,
    detail,
    singleLine,
    statusKind,
    gap,
    remainingMinutes,
    schedDuration: durationPlain,
  };
}

/**
 * Sort docs by schedule datetime ascending (undated last).
 * @param {object[]} docs
 * @param {Record<string, object>} [nodeEntitiesById]
 */
export function sortDocsBySchedule(docs, nodeEntitiesById = {}) {
  return [...(docs || [])].sort((a, b) => {
    const da = resolveDocScheduleDate(a, nodeEntitiesById);
    const db = resolveDocScheduleDate(b, nodeEntitiesById);
    if (da && db) {
      const diff = da.getTime() - db.getTime();
      if (diff !== 0) return diff;
    } else if (da && !db) return -1;
    else if (!da && db) return 1;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

/**
 * Group chronologically sorted docs into same-day chains and singles.
 * Inserts day-gap markers between different calendar-day clusters.
 * @param {object[]} docs
 * @param {Record<string, object>} [nodeEntitiesById]
 */
export function groupDocsIntoScheduleClusters(docs, nodeEntitiesById = {}) {
  const sorted = sortDocsBySchedule(docs, nodeEntitiesById);
  /** @type {Array<{ docs: object[], dates: Date[], dayKey: number | null }>} */
  const buckets = [];

  for (const doc of sorted) {
    const date = resolveDocScheduleDate(doc, nodeEntitiesById);
    const dayKey = date ? startOfCalendarDay(date).getTime() : null;
    const last = buckets[buckets.length - 1];
    if (date && last && last.dayKey != null && last.dayKey === dayKey) {
      last.docs.push(doc);
      last.dates.push(date);
      continue;
    }
    buckets.push({
      docs: [doc],
      dates: date ? [date] : [],
      dayKey,
    });
  }

  /** @type {object[]} */
  const out = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const bucket = buckets[i];
    if (i > 0) {
      const prev = buckets[i - 1];
      const prevDate = prev.dates[prev.dates.length - 1] || null;
      const nextDate = bucket.dates[0] || null;
      if (prevDate && nextDate && !sameCalendarDay(prevDate, nextDate)) {
        out.push({
          type: "day-gap",
          gap: resolveTimelineTimeGap(prevDate, nextDate),
          fromDate: prevDate,
          toDate: nextDate,
        });
      }
    }

    if (bucket.docs.length >= 2 && bucket.dayKey != null) {
      out.push({
        type: "same-day-chain",
        docs: bucket.docs,
        dates: bucket.dates,
        dayKey: bucket.dayKey,
      });
    } else {
      out.push({
        type: "single",
        doc: bucket.docs[0],
        date: bucket.dates[0] || null,
      });
    }
  }

  return out;
}
