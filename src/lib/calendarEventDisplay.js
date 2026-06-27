import { parseCalendarEventNodeContent } from "./eventCalendarSearch.js";
import {
  beautifyCalendarDate,
  beautifyCalendarEventName,
} from "./calendarEventFormat.js";

/** @typedef {{ name: string, date: string }} CalendarDisplayEvent */
/** @typedef {{ season: string, events: CalendarDisplayEvent[] }} CalendarDisplaySection */
/** @typedef {{ intro: string, sections: CalendarDisplaySection[] }} CalendarDisplayModel */

const SEASON_HEADERS = new Set([
  "winter", "spring", "summer", "fall",
  "invierno", "primavera", "verano", "otoño", "otono",
]);

const EVENT_LINE_RE = /^Event(?:o)?\s*\[\d+\]:\s*(.+?)\s*(?:[·•]|[-–—])\s*(.+)$/i;

export { beautifyCalendarDate, beautifyCalendarEventName } from "./calendarEventFormat.js";

/**
 * @param {string|null|undefined} line
 */
function isSeasonHeaderLine(line) {
  const normalized = (line || "").trim().toLowerCase();
  return SEASON_HEADERS.has(normalized);
}

/**
 * @param {string|null|undefined} line
 * @returns {CalendarDisplayEvent|null}
 */
function parseEventLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return null;

  const match = trimmed.match(EVENT_LINE_RE);
  if (match) {
    return {
      name: beautifyCalendarEventName(match[1]),
      date: beautifyCalendarDate(match[2]),
    };
  }

  const splitMatch = trimmed.match(/^(.+?)\s*(?:[·•]|[-–—])\s*(.+)$/);
  if (splitMatch) {
    return {
      name: beautifyCalendarEventName(splitMatch[1]),
      date: beautifyCalendarDate(splitMatch[2]),
    };
  }

  return { name: beautifyCalendarEventName(trimmed), date: "" };
}

/**
 * @param {string|null|undefined} text
 * @returns {CalendarDisplayModel|null}
 */
export function parseScopeBriefText(text) {
  if (!text || typeof text !== "string") return null;

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  /** @type {string[]} */
  const introLines = [];
  /** @type {CalendarDisplaySection[]} */
  const sections = [];
  /** @type {CalendarDisplaySection|null} */
  let currentSection = null;

  lines.forEach((line) => {
    if (isSeasonHeaderLine(line)) {
      currentSection = { season: line, events: [] };
      sections.push(currentSection);
      return;
    }

    const event = parseEventLine(line);
    if (currentSection && event) {
      currentSection.events.push(event);
      return;
    }

    if (!currentSection) introLines.push(line);
  });

  if (!introLines.length && !sections.length) return null;

  return {
    intro: introLines.join(" "),
    sections: sections.filter((section) => section.events.length > 0),
  };
}

/**
 * @param {unknown} value
 * @returns {CalendarDisplayModel|null}
 */
function normalizeDisplayModel(value) {
  if (!value || typeof value !== "object") return null;
  const intro = typeof value.intro === "string" ? value.intro.trim() : "";
  const sections = Array.isArray(value.sections)
    ? value.sections
      .map((section) => {
        const season = typeof section?.season === "string" ? section.season.trim() : "";
        const events = Array.isArray(section?.events)
          ? section.events
            .map((event) => ({
              name: beautifyCalendarEventName(event?.name),
              date: beautifyCalendarDate(event?.date),
            }))
            .filter((event) => event.name)
          : [];
        if (!season || !events.length) return null;
        return { season, events };
      })
      .filter(Boolean)
    : [];

  if (!intro && !sections.length) return null;
  return { intro, sections };
}

/**
 * @param {unknown} content
 * @returns {CalendarDisplayModel|null}
 */
export function getCalendarEventDisplayModel(content) {
  const payload = parseCalendarEventNodeContent(content);
  if (!payload) {
    return typeof content === "string" ? parseScopeBriefText(content) : null;
  }

  const fromModel = normalizeDisplayModel(payload.displayModel);
  if (fromModel) return fromModel;

  if (typeof payload.scopeBrief === "string" && payload.scopeBrief.trim()) {
    const parsed = parseScopeBriefText(payload.scopeBrief);
    if (parsed) return parsed;
  }

  if (payload.title || payload.date) {
    return {
      intro: "",
      sections: [{
        season: "",
        events: [{
          name: beautifyCalendarEventName(payload.title),
          date: beautifyCalendarDate(
            payload.dateEnd && payload.dateEnd !== payload.date
              ? `${payload.date} to ${payload.dateEnd}`
              : payload.date,
          ),
        }],
      }],
    };
  }

  return null;
}

/**
 * Plain-text preview for sidebar / search (no JSON, no Event [n]: prefixes).
 * @param {unknown} content
 */
export function getCalendarEventDisplayText(content) {
  const model = getCalendarEventDisplayModel(content);
  if (!model) {
    const payload = parseCalendarEventNodeContent(content);
    if (!payload) return typeof content === "string" ? content : "";
    return typeof payload.scopeBrief === "string" ? payload.scopeBrief.trim() : "";
  }

  const parts = [];
  if (model.intro) parts.push(model.intro);
  model.sections.forEach((section) => {
    if (section.season) parts.push(section.season);
    section.events.forEach((event) => {
      parts.push(event.date ? `${event.name}, ${event.date}` : event.name);
    });
  });

  return parts.join("\n").trim();
}

/**
 * @param {object} node
 * @returns {{ text: string, embedded: { kind: string, displayModel: object, linkedNodeId: string|null } }|null}
 */
export function buildCalendarEmbeddedBlockFields(node) {
  if (!node?.content) return null;
  const displayModel = getCalendarEventDisplayModel(node.content);
  if (!displayModel) return null;

  return {
    text: getCalendarEventDisplayText(node.content),
    embedded: {
      kind: "calendar-event",
      displayModel,
      linkedNodeId: node.id || null,
    },
  };
}
