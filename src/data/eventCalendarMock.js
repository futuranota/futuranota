/**
 * Mock calendar events keyed by schedule date.
 * Replace getEventsForDate with GET /api/events?date=YYYY-MM-DD when backend exists.
 */
import { daysBetween } from "../data.jsx";
import { startOfCalendarDay } from "../temporal.js";

/** @typedef {{ id: string, title: string, summary: string, date: string, dateEnd?: string|null, source: string, type: string }} CalendarEvent */

/** @type {{ dayOffset: number, dayEndOffset?: number, event: Omit<CalendarEvent, "date"|"dateEnd"> }[]} */
const EVENT_TEMPLATES = [
  {
    dayOffset: 0,
    event: {
      id: "evt-launch-brief",
      title: "Product launch briefing",
      summary: "Internal sync on launch timeline, messaging, and press embargo.",
      source: "Campaign calendar",
      type: "internal",
    },
  },
  {
    dayOffset: 3,
    event: {
      id: "evt-media-window",
      title: "Media preview window",
      summary: "Invited outlets receive embargoed assets and talking points.",
      source: "PR schedule",
      type: "media",
    },
  },
  {
    dayOffset: 7,
    dayEndOffset: 9,
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

/**
 * @param {Date|null|undefined} targetDate
 * @param {Date} [baseToday]
 * @returns {CalendarEvent[]}
 */
export function getEventsForDate(targetDate, baseToday = new Date()) {
  const target = startOfCalendarDay(targetDate);
  const base = startOfCalendarDay(baseToday);
  if (!target || !base) return [];

  const diff = daysBetween(base, target);
  const results = [];

  EVENT_TEMPLATES.forEach((template) => {
    const startDiff = template.dayOffset;
    const endDiff = template.dayEndOffset ?? template.dayOffset;
    if (diff < startDiff || diff > endDiff) return;

    const eventDate = new Date(base);
    eventDate.setDate(eventDate.getDate() + startDiff);

    let eventDateEnd = null;
    if (template.dayEndOffset != null && template.dayEndOffset !== template.dayOffset) {
      eventDateEnd = new Date(base);
      eventDateEnd.setDate(eventDateEnd.getDate() + template.dayEndOffset);
    }

    results.push({
      ...template.event,
      date: toIsoDate(eventDate),
      dateEnd: eventDateEnd ? toIsoDate(eventDateEnd) : null,
    });
  });

  return results;
}
