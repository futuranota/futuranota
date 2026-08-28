import { formatForecastUiDate } from "./forecastSearch.js";
import { EVENT_CALENDAR_RANGES } from "./eventCalendarSearch.js";
import { startOfCalendarDay } from "../temporal.js";
import { translate } from "../i18n/useI18n.js";
import { beautifyCalendarDate, beautifyCalendarEventName } from "./calendarEventFormat.js";

/** @typedef {{ id?: string, title?: string, summary?: string, date?: string, dateEnd?: string|null, source?: string, type?: string, rank?: number, season?: string }} CalendarEvent */

/** @typedef {'winter'|'spring'|'summer'|'fall'} MarketingSeason */

const SEASON_ORDER = /** @type {MarketingSeason[]} */ (["winter", "spring", "summer", "fall"]);

/**
 * @param {string|null|undefined} iso
 */
function isoToDate(iso) {
  if (!iso || typeof iso !== "string") return null;
  const d = startOfCalendarDay(new Date(`${iso.slice(0, 10)}T12:00:00`));
  return Number.isNaN(d?.getTime()) ? null : d;
}

/**
 * @param {string|null|undefined} iso
 */
function formatIsoUi(iso) {
  return formatForecastUiDate(isoToDate(iso));
}

/**
 * @param {CalendarEvent} event
 */
function eventEndIso(event) {
  return event.dateEnd || event.date || "";
}

/**
 * @param {CalendarEvent} event
 * @param {string} scheduleIso
 * @param {string} rangeEndIso
 */
function eventOverlapsScope(event, scheduleIso, rangeEndIso) {
  const start = event.date || "";
  const end = eventEndIso(event);
  if (!start || !end) return false;
  return start <= rangeEndIso && end >= scheduleIso;
}

/**
 * @param {CalendarEvent} event
 * @param {'en'|'es'} locale
 */
function formatEventWhen(event, locale) {
  const start = formatIsoUi(event.date);
  const end = formatIsoUi(event.dateEnd);
  if (!start) return "";
  if (end && end !== start) {
    return locale === "es" ? `${start} a ${end}` : `${start} to ${end}`;
  }
  return start;
}

/**
 * @param {Date|null|undefined} date
 */
function toIsoDateFromDate(date) {
  const d = startOfCalendarDay(date);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * @param {number} month 1-12
 * @returns {MarketingSeason}
 */
function seasonFromMonth(month) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

/**
 * @param {CalendarEvent} event
 * @returns {MarketingSeason}
 */
function resolveEventSeason(event) {
  if (event.season && SEASON_ORDER.includes(/** @type {MarketingSeason} */ (event.season))) {
    return /** @type {MarketingSeason} */ (event.season);
  }
  const month = Number((event.date || "").slice(5, 7));
  return seasonFromMonth(Number.isFinite(month) ? month : 1);
}

/**
 * @param {CalendarEvent[]} scoped
 * @param {'en'|'es'} locale
 */
function buildSeasonGroupedSections(scoped, locale) {
  /** @type {Map<MarketingSeason, CalendarEvent[]>} */
  const bySeason = new Map();
  scoped.forEach((event) => {
    const season = resolveEventSeason(event);
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push(event);
  });

  const seasons = [...bySeason.keys()].sort((a, b) => {
    const aDate = bySeason.get(a)?.[0]?.date || "";
    const bDate = bySeason.get(b)?.[0]?.date || "";
    return aDate.localeCompare(bDate);
  });

  return seasons.map((season) => ({
    season: translate(
      `eventCalendar.season${season.charAt(0).toUpperCase()}${season.slice(1)}`,
      locale,
    ),
    events: [...(bySeason.get(season) || [])]
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((event) => ({
        name: beautifyCalendarEventName((event.title || "").trim() || "—"),
        date: beautifyCalendarDate(formatEventWhen(event, locale)),
      })),
  })).filter((section) => section.events.length > 0);
}

/**
 * @param {CalendarEvent[]} scoped
 * @param {'en'|'es'} locale
 */
function buildSeasonGroupedLines(scoped, locale) {
  /** @type {string[]} */
  const blocks = [];
  let index = 0;

  buildSeasonGroupedSections(scoped, locale).forEach((section) => {
    blocks.push(section.season);
    section.events.forEach((event) => {
      index += 1;
      blocks.push(translate("eventCalendar.eventLine", locale, {
        index,
        name: event.name,
        date: event.date,
      }));
    });
    blocks.push("");
  });

  if (blocks.length && blocks[blocks.length - 1] === "") blocks.pop();
  return blocks;
}

/**
 * @param {object} fetchResult
 * @param {{ locale?: 'en'|'es', omitIntro?: boolean }} [options]
 */
export function buildEventCalendarScopeBrief(fetchResult, options = {}) {
  const locale = options.locale === "es" ? "es" : "en";
  const omitIntro = options.omitIntro === true;

  const rangeDays = fetchResult?.rangeDays ?? EVENT_CALENDAR_RANGES.week?.days ?? 7;
  const scheduleIso = typeof fetchResult?.scheduleIso === "string" && fetchResult.scheduleIso
    ? fetchResult.scheduleIso.slice(0, 10)
    : toIsoDateFromDate(fetchResult?.targetDate);
  const rangeEndIso = toIsoDateFromDate(fetchResult?.rangeEnd);

  if (!scheduleIso || !rangeEndIso) {
    return {
      headline: "",
      body: translate("eventCalendar.noSchedule", locale),
      eventCount: 0,
      hasData: false,
    };
  }

  const events = Array.isArray(fetchResult?.events) ? fetchResult.events : [];
  const scoped = events
    .filter((event) => eventOverlapsScope(event, scheduleIso, rangeEndIso))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (!scoped.length) {
    return {
      headline: "",
      body: translate("eventCalendar.noData", locale),
      eventCount: 0,
      hasData: false,
    };
  }

  const intro = omitIntro
    ? ""
    : translate("eventCalendar.scopeIntro", locale, { days: rangeDays });
  const sections = buildSeasonGroupedSections(scoped, locale);
  const seasonLines = buildSeasonGroupedLines(scoped, locale);

  return {
    headline: "",
    body: omitIntro
      ? seasonLines.join("\n")
      : [intro, "", ...seasonLines].join("\n"),
    displayModel: { intro, sections },
    eventCount: scoped.length,
    hasData: true,
    events: scoped,
  };
}
