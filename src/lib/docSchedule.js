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

  if (doc.scheduleStartAt) {
    const d = parseDate(doc.scheduleStartAt);
    if (d) return d;
  }

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
 * Earliest Schedule from linked node entities (anchorAt only — no createdAt).
 * @param {object | null | undefined} doc
 * @param {Record<string, object>} [nodeEntitiesById]
 * @returns {Date | null}
 */
export function resolveLinkedNodeScheduleDate(doc, nodeEntitiesById = {}) {
  if (!doc) return null;
  let earliest = null;
  const consider = (entity) => {
    if (!entity?.anchorAt) return;
    const d = parseDate(entity.anchorAt);
    if (!d) return;
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
  };
  const seen = new Set();
  for (const entityId of doc.nodeIds || []) {
    if (!entityId || seen.has(entityId)) continue;
    seen.add(entityId);
    consider(nodeEntitiesById[entityId]);
  }
  for (const [entityId, entity] of Object.entries(nodeEntitiesById || {})) {
    if (entity?.parentDocId !== doc.id || seen.has(entityId)) continue;
    seen.add(entityId);
    consider(entity);
  }
  return earliest;
}

/**
 * Resolve a document's schedule datetime (day + hour + minute) for timeline / content list.
 * Prefers explicit Schedule fields, then linked node anchors, then createdAt.
 * @param {object | null | undefined} doc
 * @param {Record<string, object>} [nodeEntitiesById]
 * @returns {Date | null}
 */
export function resolveDocScheduleDate(doc, nodeEntitiesById = {}) {
  if (!doc) return null;

  const explicit = resolveExplicitDocScheduleDate(doc);
  if (explicit) return explicit;

  const fromNodes = resolveLinkedNodeScheduleDate(doc, nodeEntitiesById);
  if (fromNodes) return fromNodes;

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
  if (doc.scheduleStartAt && /T\d{2}:\d{2}/.test(String(doc.scheduleStartAt))) return true;
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
 * Same-day A↔B schedule starts live countdown 1 minute before A
 * (now >= A − 1m and now < B). Until then the gap stays fixed (e.g. sched 45m).
 * @param {Date} from
 * @param {Date} to
 * @param {Date} [now]
 */
export function isSameDayScheduleCountdownActive(from, to, now = new Date()) {
  if (!(from instanceof Date) || !(to instanceof Date)) return false;
  if (!sameCalendarDay(from, to)) return false;
  const a = from.getTime() <= to.getTime() ? from : to;
  const b = from.getTime() <= to.getTime() ? to : from;
  const nowMs = now.getTime();
  return nowMs >= a.getTime() - MS_PER_MINUTE && nowMs < b.getTime();
}

/**
 * Same-day pair center label: work window until the next doc schedule.
 * e.g. “next schedule starts in 45m” (fixed until A−1m, then live countdown).
 * @param {{ from: Date, to: Date, now?: Date, hasExplicitTime?: boolean }} args
 * @param {(key: string, vars?: object) => string} [t]
 */
export function formatSameDayPairLabel({ from, to, now = new Date(), hasExplicitTime: _hasExplicitTime = true }, t) {
  const gap = resolveTimelineTimeGap(from, to);
  const day = startOfCalendarDay(from);
  const today = startOfCalendarDay(now);
  const dayDelta = daysBetween(today, day);
  /** @type {'past-due' | 'today' | 'pending'} */
  let statusKind = "pending";
  if (dayDelta < 0) statusKind = "past-due";
  else if (dayDelta === 0) statusKind = "today";

  const useT = typeof t === "function";
  const a = from.getTime() <= to.getTime() ? from : to;
  const b = from.getTime() <= to.getTime() ? to : from;
  const live = statusKind === "today" && isSameDayScheduleCountdownActive(from, to, now);

  let durationPlain = formatDurationMinutesPlain(gap.minutes);
  let remainingMinutes = null;
  if (live) {
    // Same schedule window A→B: stay at full gap until A, then tick down to B.
    const effectiveStart = Math.max(now.getTime(), a.getTime());
    remainingMinutes = Math.max(1, Math.round((b.getTime() - effectiveStart) / MS_PER_MINUTE));
    durationPlain = formatDurationMinutesPlain(remainingMinutes);
  }

  const minutes = live ? remainingMinutes : gap.minutes;
  let headline = useT ? t("timeline.nextSchedule") : "next schedule";
  let detail = minutes >= 1
    ? (useT
      ? t("timeline.startsInDuration", { duration: durationPlain })
      : `starts in ${durationPlain}`)
    : (useT ? t("timeline.startsNow") : "starts now");

  if (statusKind === "past-due" || (statusKind === "today" && b.getTime() < now.getTime())) {
    statusKind = "past-due";
    headline = useT ? t("timeline.nextSchedulePastDue") : "next schedule passed";
    detail = useT ? t("timeline.pastDueParen") : "(past due)";
  } else if (statusKind === "pending") {
    detail = `${detail} ${useT ? t("timeline.pendingParen") : "(pending)"}`;
  }

  const singleLine = `${headline} · ${detail}`;

  return {
    headline,
    detail,
    singleLine,
    statusKind,
    gap,
    remainingMinutes: live ? remainingMinutes : null,
    schedDuration: durationPlain,
    isLiveCountdown: live,
  };
}

/**
 * Live countdown from wall-clock now → next upcoming schedule (thermometer gap).
 * Same-day with clock → minute countdown; other days → pending day label (no fake minutes).
 * @param {{ target: Date, now?: Date, hasExplicitTime?: boolean }} args
 * @param {(key: string, vars?: object) => string} [t]
 */
export function formatNowUntilScheduleLabel({ target, now = new Date(), hasExplicitTime = true }, t) {
  const to = target instanceof Date ? target : parseDate(target);
  if (!to) return null;
  const nowMs = now.getTime();
  const targetMs = to.getTime();
  if (!(targetMs > nowMs)) return null;

  const useT = typeof t === "function";
  const sameDay = sameCalendarDay(now, to);
  const remainingMinutes = Math.max(1, Math.round((targetMs - nowMs) / MS_PER_MINUTE));

  if (sameDay && hasExplicitTime) {
    const duration = formatDurationMinutesPlain(remainingMinutes);
    const headline = useT ? t("timeline.today") : "today";
    const detail = useT
      ? t("timeline.untilReminder", { duration })
      : `in ${duration}`;
    return {
      headline,
      detail,
      singleLine: `${headline} · ${detail}`,
      statusKind: "today",
      remainingMinutes,
      sameDay: true,
    };
  }

  const days = Math.max(1, daysBetween(startOfCalendarDay(now), startOfCalendarDay(to)));
  const headline = useT ? t("timeline.pending") : "Pending";
  const detail = useT
    ? t("timeline.pendingDays", { count: days, s: days === 1 ? "" : "s" })
    : `Pending ${days} day${days === 1 ? "" : "s"}`;
  return {
    headline,
    detail,
    singleLine: detail,
    statusKind: "pending",
    remainingMinutes: sameDay ? remainingMinutes : null,
    sameDay: false,
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
