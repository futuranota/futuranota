/**
 * Absolute Fecha y Hora display for Gina table cells.
 * Relative labels (En N días) stay available for other surfaces but tables use day badge + clock.
 */

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const MONTH_SHORT_ES_CAP = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function normalizeLocale(locale) {
  const s = typeof locale === "string" ? locale : "es";
  return s.toLowerCase().startsWith("en") ? "en" : "es";
}

/** Calendar-day delta: to − from (0 = same day). */
export function calendarDayDelta(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Short absolute date — e.g. "15 sep" or "15 Sep" (badge). */
export function formatGinaShortDate(value, locale = "es") {
  const d = toDate(value);
  if (!d) return null;
  if (normalizeLocale(locale) === "es") {
    return `${d.getDate()} ${MONTH_SHORT_ES[d.getMonth()]}`;
  }
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/** Badge day for Fecha y Hora column — "09 Ago". */
export function formatGinaDayBadge(value, locale = "es") {
  const d = toDate(value);
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  if (normalizeLocale(locale) === "es") {
    return `${dd} ${MONTH_SHORT_ES_CAP[d.getMonth()]}`;
  }
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

/** Single-letter weekday: ES L M X J V S D · EN M T W T F S S */
export function formatGinaWeekdayLetter(value, locale = "es") {
  const d = toDate(value);
  if (!d) return null;
  const i = d.getDay(); // 0 Sun
  if (normalizeLocale(locale) === "en") {
    return ["S", "M", "T", "W", "T", "F", "S"][i];
  }
  return ["D", "L", "M", "X", "J", "V", "S"][i];
}

/** Full absolute for tooltip — e.g. "7 ago 2026, 09:00". */
export function formatGinaAbsoluteTooltip(value, locale = "es") {
  const d = toDate(value);
  if (!d) return null;
  const datePart = normalizeLocale(locale) === "es"
    ? `${d.getDate()} ${MONTH_SHORT_ES[d.getMonth()]} ${d.getFullYear()}`
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${datePart}, ${hh}:${mm}`;
}

/**
 * @param {string|Date|null|undefined} value — usually anchorAt
 * @param {Date} [now]
 * @param {string} [locale]
 * @returns {string|null}
 */
export function formatGinaRelativeDay(value, now = new Date(), locale = "es") {
  const d = toDate(value);
  if (!d) return null;
  const delta = calendarDayDelta(now, d);
  if (delta == null) return null;
  if (delta === 0) return "Hoy";
  if (delta === 1) return "Mañana";
  if (delta === -1) return "Ayer";
  if (delta >= 2 && delta <= 6) return `En ${delta} días`;
  if (delta <= -2 && delta >= -6) return `Hace ${Math.abs(delta)} días`;
  return formatGinaShortDate(d, locale);
}

/**
 * Compose Fecha y Hora cell: day badge + clock range (absolute). No "En N días" as primary.
 * @param {{ anchorAt?: string|null, anchorFinishAt?: string|null, timeRange?: string|null }} opts
 * @param {Date} [now]
 * @param {string} [locale]
 */
export function buildGinaTimeDisplay(opts = {}, now = new Date(), locale = "es") {
  const anchor = opts.anchorAt || null;
  const relativeDay = formatGinaRelativeDay(anchor, now, locale);
  const dayBadge = formatGinaDayBadge(anchor, locale);
  const weekday = formatGinaWeekdayLetter(anchor, locale);
  const timeClock = opts.timeRange || null;
  const absoluteDate = formatGinaAbsoluteTooltip(anchor, locale);

  if (!anchor) {
    return {
      relativeDay: null,
      dayBadge: null,
      weekday: null,
      timeClock: null,
      absoluteDate: null,
      timeLabel: "Flexible",
    };
  }

  let timeLabel = dayBadge || timeClock || "—";
  if (dayBadge && timeClock) timeLabel = `${dayBadge} · ${timeClock}`;
  else if (dayBadge) timeLabel = dayBadge;
  else if (timeClock) timeLabel = timeClock;

  return {
    relativeDay,
    dayBadge,
    weekday,
    timeClock,
    absoluteDate,
    timeLabel,
  };
}
