/**
 * Resolve schedule date from node and fetch calendar events for that day/range.
 * Replace fetchEventsForNode mock body with GET /api/events?date=YYYY-MM-DD.
 */
import { getEventsForDate } from "../data/eventCalendarMock.js";
import {
  formatForecastUiDate,
  resolveForecastTargetDate,
} from "./forecastSearch.js";
import { formatScheduleLabelFromIso } from "./nodeAnchor.js";

export const EVENT_MESSAGES = {
  noNode: "Select a node to search events",
  noDate: "No schedule date on selected node",
  empty: "No events for this date",
};

/**
 * @param {object|null} node
 */
export function resolveScheduleDate(node) {
  return resolveForecastTargetDate(node);
}

/**
 * @param {object|null} node
 * @param {Date} [baseToday]
 */
export async function fetchEventsForNode(node, baseToday = new Date()) {
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

  const events = getEventsForDate(date, baseToday);
  const uiDate = formatForecastUiDate(date);
  const sourceLabel = resolvedFrom === "schedule"
    ? (formatScheduleLabelFromIso(scheduleIso) || `schedule: ${uiDate}`)
    : resolvedFrom === "date"
      ? `date: ${uiDate}`
      : `created: ${uiDate}`;

  if (!events.length) {
    return {
      status: "empty",
      message: EVENT_MESSAGES.empty,
      uiDate,
      sourceLabel,
      targetDate: date,
      scheduleIso,
      resolvedFrom,
      node,
    };
  }

  return {
    status: "success",
    uiDate,
    sourceLabel,
    targetDate: date,
    scheduleIso,
    resolvedFrom,
    node,
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
