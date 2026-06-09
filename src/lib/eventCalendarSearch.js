/**
 * Resolve schedule date from node and fetch calendar events for that day/range.
 * Replace fetchEventsForNode mock body with GET /api/events?from=&to=.
 */
import { getEventsInRange } from "../data/eventCalendarMock.js";
import {
  formatForecastUiDate,
  resolveForecastTargetDate,
} from "./forecastSearch.js";
import { formatScheduleLabelFromIso } from "./nodeAnchor.js";
import { startOfCalendarDay } from "../temporal.js";

export const EVENT_CALENDAR_RANGE_OPTIONS = [
  { id: "week", label: "7d", days: 7 },
  { id: "half", label: "15d", days: 15 },
  { id: "month", label: "31d", days: 31 },
];

/** @type {Record<string, { id: string, label: string, days: number }>} */
export const EVENT_CALENDAR_RANGES = Object.fromEntries(
  EVENT_CALENDAR_RANGE_OPTIONS.map((o) => [o.id, o]),
);

export const EVENT_MESSAGES = {
  noNode: "Select a node to search events",
  noDate: "No schedule date on selected node",
  empty: "No events for this range",
};

/**
 * @param {Date|null|undefined} anchorDate
 * @param {string} [rangeId]
 */
export function resolveEventCalendarRangeEnd(anchorDate, rangeId = "week") {
  const start = startOfCalendarDay(anchorDate);
  const rangeDays = EVENT_CALENDAR_RANGES[rangeId]?.days ?? 7;
  const end = new Date(start);
  end.setDate(end.getDate() + rangeDays);
  return {
    start,
    end: startOfCalendarDay(end),
    rangeId: EVENT_CALENDAR_RANGES[rangeId] ? rangeId : "week",
    rangeDays,
  };
}

export function formatEventCalendarRangeLabel(start, end) {
  if (!start || !end) return "";
  return `${formatForecastUiDate(start)} → ${formatForecastUiDate(end)}`;
}

/**
 * @param {object|null} node
 */
export function resolveScheduleDate(node) {
  return resolveForecastTargetDate(node);
}

function buildRangeMeta(targetDate, rangeId) {
  const { start, end, rangeDays } = resolveEventCalendarRangeEnd(targetDate, rangeId);
  const option = EVENT_CALENDAR_RANGES[rangeId] || EVENT_CALENDAR_RANGES.week;
  return {
    rangeId: option.id,
    rangeDays,
    rangeStart: start,
    rangeEnd: end,
    rangeLabel: formatEventCalendarRangeLabel(start, end),
    rangeShortLabel: option.label,
  };
}

/**
 * @param {object|null} node
 * @param {Date} [baseToday]
 * @param {string} [rangeId]
 */
export async function fetchEventsForNode(node, baseToday = new Date(), rangeId = "week") {
  void baseToday;

  if (!node) {
    return {
      status: "noNode",
      message: EVENT_MESSAGES.noNode,
    };
  }

  const { date, resolvedFrom, scheduleIso } = resolveScheduleDate(node);
  if (!date) {
    return {
      status: "noDate",
      message: EVENT_MESSAGES.noDate,
      node,
    };
  }

  await new Promise((r) => setTimeout(r, 400));

  const rangeMeta = buildRangeMeta(date, rangeId);
  const events = getEventsInRange(date, rangeMeta.rangeDays);
  const uiDate = formatForecastUiDate(date);
  const sourceLabel = resolvedFrom === "schedule"
    ? (formatScheduleLabelFromIso(scheduleIso) || `schedule: ${uiDate}`)
    : resolvedFrom === "date"
      ? `date: ${uiDate}`
      : `created: ${uiDate}`;

  const baseFields = {
    uiDate,
    sourceLabel,
    targetDate: date,
    scheduleIso,
    resolvedFrom,
    node,
    ...rangeMeta,
  };

  if (!events.length) {
    return {
      status: "empty",
      message: EVENT_MESSAGES.empty,
      ...baseFields,
    };
  }

  return {
    status: "success",
    ...baseFields,
    event: events[0],
    events,
  };
}

/**
 * @param {object} fetchResult
 */
export function buildEventNodePayload(fetchResult) {
  const event = fetchResult.event;
  return {
    kind: "calendar-event",
    scheduleLabel: fetchResult.sourceLabel,
    scheduleIso: fetchResult.scheduleIso || null,
    resolvedFrom: fetchResult.resolvedFrom,
    uiDate: fetchResult.uiDate,
    rangeId: fetchResult.rangeId || null,
    rangeDays: fetchResult.rangeDays ?? null,
    rangeLabel: fetchResult.rangeLabel || null,
    eventId: event?.id || null,
    title: event?.title || null,
    summary: event?.summary || null,
    date: event?.date || null,
    dateEnd: event?.dateEnd || null,
    source: event?.source || null,
    type: event?.type || null,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} fetchResult
 */
export function buildEventNodeTitle(fetchResult) {
  const title = fetchResult.event?.title;
  return title ? `Event · ${title}` : `Event · ${fetchResult.uiDate || "—"}`;
}

/**
 * @param {unknown} content
 * @returns {object|null}
 */
export function parseCalendarEventNodeContent(content) {
  if (content == null || content === "") return null;

  let parsed = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || parsed.kind !== "calendar-event") {
    return null;
  }

  return parsed;
}

/**
 * @param {object|null|undefined} payload
 */
export function calendarEventPayloadToResult(payload) {
  if (!payload) return null;

  return {
    uiDate: payload.uiDate || "",
    rangeLabel: payload.rangeLabel || null,
    sourceLabel: payload.scheduleLabel || "",
    event: {
      id: payload.eventId || null,
      title: payload.title || "",
      summary: payload.summary || "",
      date: payload.date || "",
      dateEnd: payload.dateEnd || null,
      source: payload.source || "",
      type: payload.type || "",
    },
  };
}
