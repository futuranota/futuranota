/**
 * @typedef {{ id: string, title: string, summary: string, date: string, dateEnd?: string|null, source: string, type: string, rank?: number }} CalendarEvent
 */

/**
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function isoToDateOnly(iso) {
  if (!iso || typeof iso !== "string") return "";
  return iso.slice(0, 10);
}

/**
 * @param {CalendarEvent[]} events
 * @returns {CalendarEvent[]}
 */
export function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.date}|${(event.title || "").trim().toLowerCase()}`;
    if (!event.date || !event.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {CalendarEvent[]} events
 * @returns {CalendarEvent[]}
 */
export function sortEventsByDate(events) {
  return [...events].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.rank ?? 0) - (a.rank ?? 0);
  });
}

/**
 * @param {string} fromIso YYYY-MM-DD
 * @param {string} toIso YYYY-MM-DD
 * @param {CalendarEvent[]} events
 */
export function filterEventsInRange(fromIso, toIso, events) {
  return events.filter((event) => {
    const start = event.date;
    const end = event.dateEnd || event.date;
    if (!start) return false;
    return start <= toIso && end >= fromIso;
  });
}

/**
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {{ year: number, month: number }[]}
 */
export function monthsOverlappingRange(fromIso, toIso) {
  const start = new Date(`${fromIso}T12:00:00`);
  const end = new Date(`${toIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}
