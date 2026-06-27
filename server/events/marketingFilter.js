import { seasonFromMonth } from "./marketingCalendar.js";

/** Keywords that signal ecommerce / marketing relevance in holiday titles. */
const MARKETING_KEYWORDS = [
  "new year",
  "valentine",
  "easter",
  "good friday",
  "mother",
  "father",
  "independence",
  "labor",
  "labour",
  "memorial",
  "thanksgiving",
  "black friday",
  "cyber monday",
  "christmas",
  "boxing",
  "halloween",
  "single",
  "11.11",
  "shopping",
  "consumer",
  "prime day",
  "back to school",
  "st. patrick",
  "patrick",
  "cinco de mayo",
  "presidents",
  "martin luther",
  "columbus",
  "veterans",
  "women",
  "earth",
];

const NOISE_KEYWORDS = [
  "saint ",
  "st ",
  " feast ",
  "observance of",
  "day off",
  "bank holiday",
  "autonomous",
  "regional",
  "local ",
];

/**
 * @param {import("./normalize.js").CalendarEvent} event
 */
export function isMarketingRelevantHoliday(event) {
  const title = (event.title || "").trim().toLowerCase();
  const summary = (event.summary || "").trim().toLowerCase();
  const blob = `${title} ${summary}`;
  if (!title) return false;

  if (NOISE_KEYWORDS.some((kw) => blob.includes(kw))) {
    return MARKETING_KEYWORDS.some((kw) => blob.includes(kw));
  }

  if (MARKETING_KEYWORDS.some((kw) => blob.includes(kw))) return true;

  const type = (event.type || "").toLowerCase();
  if (type.includes("national") || type.includes("federal") || type.includes("public")) {
    return true;
  }

  return false;
}

/**
 * @param {import("./normalize.js").CalendarEvent[]} events
 */
export function filterMarketingEvents(events) {
  return events.filter((event) => {
    if (event.source === "Futura marketing calendar") return true;
    if (event.source === "Calendarific") return isMarketingRelevantHoliday(event);
    return false;
  }).map((event) => ({
    ...event,
    season: event.season || seasonFromMonth(Number((event.date || "").slice(5, 7))),
  }));
}
