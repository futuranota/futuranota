/**
 * Resolve schedule date from node and fetch calendar events for that day/range.
 */
import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";
import { getEventsInRange } from "../data/eventCalendarMock.js";
import {
  formatForecastUiDate,
  resolveForecastTargetDate,
} from "./forecastSearch.js";
import { formatScheduleLabelFromIso } from "./nodeAnchor.js";
import { startOfCalendarDay } from "../temporal.js";
import { buildEventCalendarScopeBrief } from "./eventCalendarScopeBrief.js";

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

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {string} [country]
 */
async function fetchEventsFromApi(start, end, country) {
  const params = new URLSearchParams({
    from: toIsoDate(start),
    to: toIsoDate(end),
  });
  if (country) params.set("country", country);

  const payload = await apiClient(`${API_ROUTES.events}?${params}`);
  return Array.isArray(payload?.events) ? payload.events : [];
}

/**
 * @param {object|null} node
 * @param {Date} [baseToday]
 * @param {string} [rangeId]
 * @param {'en'|'es'} [locale]
 */
export async function fetchEventsForNode(node, baseToday = new Date(), rangeId = "week", locale = "en") {
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
  let events = [];

  try {
    events = await fetchEventsFromApi(
      rangeMeta.rangeStart,
      rangeMeta.rangeEnd,
      typeof node?.country === "string" ? node.country : undefined,
    );
  } catch {
    events = getEventsInRange(date, rangeMeta.rangeDays);
  }

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
    const emptyResult = {
      status: "empty",
      message: EVENT_MESSAGES.empty,
      ...baseFields,
      events: [],
    };
    return {
      ...emptyResult,
      scopeBrief: buildEventCalendarScopeBrief(emptyResult, { locale }),
    };
  }

  const successResult = {
    status: "success",
    ...baseFields,
    event: events[0],
    events,
  };

  return {
    ...successResult,
    scopeBrief: buildEventCalendarScopeBrief(successResult, { locale }),
  };
}

/**
 * @param {object} fetchResult
 */
export function buildEventNodePayload(fetchResult, options = {}) {
  const event = fetchResult.event;
  const locale = options.locale === "es" ? "es" : "en";
  const integrationBrief = buildEventCalendarScopeBrief(fetchResult, {
    locale,
    omitIntro: true,
  });
  return {
    kind: "calendar-event",
    scheduleLabel: fetchResult.sourceLabel,
    scheduleIso: fetchResult.scheduleIso || null,
    resolvedFrom: fetchResult.resolvedFrom,
    uiDate: fetchResult.uiDate,
    rangeId: fetchResult.rangeId || null,
    rangeDays: fetchResult.rangeDays ?? null,
    rangeLabel: fetchResult.rangeLabel || null,
    rangeEnd: fetchResult.rangeEnd || null,
    targetDate: fetchResult.targetDate || null,
    events: Array.isArray(fetchResult.events) ? fetchResult.events : [],
    scopeHeadline: integrationBrief.headline || null,
    scopeBrief: integrationBrief.body || null,
    displayModel: integrationBrief.displayModel || null,
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
 * @param {unknown} content
 * @returns {boolean}
 */
export function isCalendarEventNodeContent(content) {
  return Boolean(parseCalendarEventNodeContent(content));
}

/**
 * @param {object|null|undefined} payload
 */
export function calendarEventPayloadToResult(payload) {
  if (!payload) return null;

  const hasScopeBrief = typeof payload.scopeBrief === "string" && payload.scopeBrief.trim();
  const hasEvent = Boolean(payload.title || payload.date);
  const hasDisplayModel = payload.displayModel
    && Array.isArray(payload.displayModel.sections)
    && payload.displayModel.sections.length > 0;

  if (!hasScopeBrief && !hasEvent && !hasDisplayModel) return null;

  return {
    uiDate: payload.uiDate || "",
    rangeLabel: payload.rangeLabel || null,
    sourceLabel: payload.scheduleLabel || "",
    displayModel: payload.displayModel || null,
    scopeBrief: hasScopeBrief
      ? { headline: payload.scopeHeadline || "", body: payload.scopeBrief.trim() }
      : null,
    event: hasEvent
      ? {
          id: payload.eventId || null,
          title: payload.title || "",
          summary: payload.summary || "",
          date: payload.date || "",
          dateEnd: payload.dateEnd || null,
          source: payload.source || "",
          type: payload.type || "",
        }
      : null,
  };
}
