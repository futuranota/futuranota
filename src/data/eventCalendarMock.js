/**
 * Mock calendar events keyed by schedule date.
 * Replace getEventsInRange with GET /api/events?from=&to= when backend exists.
 */
import { startOfCalendarDay } from "../temporal.js";

/** @typedef {{ id: string, title: string, summary: string, date: string, dateEnd?: string|null, source: string, type: string }} CalendarEvent */

/** @type {{ offsetStart: number, offsetEnd?: number, event: Omit<CalendarEvent, "date"|"dateEnd"> }[]} */
const EVENT_TEMPLATES = [
  {
    offsetStart: 0,
    event: {
      id: "evt-launch-brief",
      title: "Product launch briefing",
      summary: "Internal sync on launch timeline, messaging, and press embargo.",
      source: "Campaign calendar",
      type: "internal",
    },
  },
  {
    offsetStart: 3,
    event: {
      id: "evt-media-window",
      title: "Media preview window",
      summary: "Invited outlets receive embargoed assets and talking points.",
      source: "PR schedule",
      type: "media",
    },
  },
  {
    offsetStart: 7,
    offsetEnd: 9,
    event: {
      id: "evt-industry-summit",
      title: "Industry summit",
      summary: "Keynote slot and partner meetings across a three-day window.",
      source: "Events DB",
      type: "conference",
    },
  },
];

function toIsoDate(date) {
  const day = startOfCalendarDay(date);
  if (!day) return "";
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfCalendarDay(next);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();
}

function buildEventFromTemplate(anchor, template) {
  const offsetEnd = template.offsetEnd ?? template.offsetStart;
  const eventStart = addDays(anchor, template.offsetStart);
  const eventEnd = addDays(anchor, offsetEnd);
  return {
    ...template.event,
    date: toIsoDate(eventStart),
    dateEnd: offsetEnd !== template.offsetStart ? toIsoDate(eventEnd) : null,
  };
}

/**
 * Events whose window overlaps [anchor, anchor + rangeDays].
 * @param {Date|null|undefined} anchorDate
 * @param {number} rangeDays
 * @returns {CalendarEvent[]}
 */
export function getEventsInRange(anchorDate, rangeDays = 7) {
  const anchor = startOfCalendarDay(anchorDate);
  if (!anchor) return [];

  const rangeStart = anchor;
  const rangeEnd = addDays(anchor, rangeDays);
  const results = [];

  EVENT_TEMPLATES.forEach((template) => {
    const offsetEnd = template.offsetEnd ?? template.offsetStart;
    const eventStart = addDays(anchor, template.offsetStart);
    const eventEnd = addDays(anchor, offsetEnd);
    if (!rangesOverlap(eventStart, eventEnd, rangeStart, rangeEnd)) return;
    results.push(buildEventFromTemplate(anchor, template));
  });

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * @deprecated Use getEventsInRange(anchor, 0) for single-day overlap.
 */
export function getEventsForDate(targetDate, _baseToday = new Date()) {
  return getEventsInRange(targetDate, 0);
}
