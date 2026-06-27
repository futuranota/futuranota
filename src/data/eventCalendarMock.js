/**
 * Mock marketing-season events when /api/events is unavailable.
 */
import { startOfCalendarDay } from "../temporal.js";

/** @typedef {{ id: string, title: string, summary: string, date: string, dateEnd?: string|null, source: string, type: string, season?: string }} CalendarEvent */

/** @type {{ offsetStart: number, event: Omit<CalendarEvent, "date"|"dateEnd"> }[]} */
const MARKETING_EVENT_TEMPLATES = [
  {
    offsetStart: 14,
    event: {
      id: "evt-valentines",
      title: "Valentine's Day",
      summary: "Gift and companion-product drop window.",
      source: "Futura marketing calendar",
      type: "retail",
      season: "winter",
    },
  },
  {
    offsetStart: 45,
    event: {
      id: "evt-mothers-day",
      title: "Mother's Day",
      summary: "Short ship window for gift-led companion SKUs.",
      source: "Futura marketing calendar",
      type: "retail",
      season: "spring",
    },
  },
  {
    offsetStart: 120,
    event: {
      id: "evt-back-to-school",
      title: "Back to School",
      summary: "Late-summer retail push for supplies and companions.",
      source: "Futura marketing calendar",
      type: "seasonal",
      season: "summer",
    },
  },
  {
    offsetStart: 200,
    event: {
      id: "evt-black-friday",
      title: "Black Friday",
      summary: "Peak discount window for bundles and attach rate.",
      source: "Futura marketing calendar",
      type: "retail",
      season: "fall",
    },
  },
  {
    offsetStart: 230,
    event: {
      id: "evt-christmas",
      title: "Christmas",
      summary: "Peak gifting season — ship deadlines matter.",
      source: "Futura marketing calendar",
      type: "holiday",
      season: "winter",
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

/**
 * Marketing moments whose date falls inside [anchor, anchor + rangeDays].
 * @param {Date|null|undefined} anchorDate
 * @param {number} rangeDays
 * @returns {CalendarEvent[]}
 */
export function getEventsInRange(anchorDate, rangeDays = 7) {
  const anchor = startOfCalendarDay(anchorDate);
  if (!anchor) return [];

  const yearStart = new Date(anchor.getFullYear(), 0, 1, 12);
  const rangeStart = anchor;
  const rangeEnd = addDays(anchor, rangeDays);
  const results = [];

  MARKETING_EVENT_TEMPLATES.forEach((template) => {
    const eventDate = addDays(yearStart, template.offsetStart);
    if (eventDate < rangeStart || eventDate > rangeEnd) return;
    results.push({
      ...template.event,
      date: toIsoDate(eventDate),
      dateEnd: null,
    });
  });

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * @deprecated Use getEventsInRange(anchor, 0) for single-day overlap.
 */
export function getEventsForDate(targetDate, _baseToday = new Date()) {
  return getEventsInRange(targetDate, 0);
}
