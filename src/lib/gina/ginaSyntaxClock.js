/**
 * Syntax bank: wall clock — day / date / time of “now” (browser local TZ).
 * Deterministic reply; never invent weekday or pivot to workspace.
 */

import { foldGinaText } from "./ginaTimeScope.js";

/**
 * @typedef {"day" | "date" | "time" | "full"} GinaWallClockMode
 */

const WEEKDAYS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * @param {Date} now
 * @returns {string} e.g. "12:46 a.m."
 */
export function formatGinaWallClockTime(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return "";
  const h = now.getHours();
  const m = now.getMinutes();
  const period = h >= 12 ? "p.m." : "a.m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Full grounding line — always day + date + time (one question → one answer).
 * @param {Date | number | string | null | undefined} nowValue
 * @param {"es"|"en"} [locale]
 */
export function formatGinaWallClockMessage(nowValue = new Date(), locale = "es") {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (Number.isNaN(now.getTime())) return "";

  const time = formatGinaWallClockTime(now);
  const day = now.getDate();
  const year = now.getFullYear();

  if (locale === "en") {
    const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
    const month = now.toLocaleDateString("en-US", { month: "long" });
    // time already ends with a.m. / p.m. — no extra sentence period
    return `Today is ${weekday}, ${month} ${day}, ${year}, ${time}`;
  }

  const weekday = WEEKDAYS_ES[now.getDay()] || "";
  const month = MONTHS_ES[now.getMonth()] || "";
  return `Hoy es ${weekday} ${day} de ${month} del ${year}, hora ${time}`;
}

/**
 * Schedule / sheet asks must not steal the wall clock.
 * @param {string} q folded text
 */
function isScheduleSheetAsk(q) {
  if (/\bhorarios\b/.test(q)) return true;
  if (/\bhorario\b/.test(q) && !/\bque\s+hora\s+es\b/.test(q)) return true;
  if (/\b(tenemos|hay)\s+(para\s+)?hoy\b/.test(q)) return true;
  if (/\bschedule\s+(for\s+)?today\b/.test(q)) return true;
  if (/\btoday'?s\s+schedule\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {GinaWallClockMode | null}
 */
export function parseWallClockIntent(text) {
  const q = foldGinaText(text);
  if (!q) return null;
  if (isScheduleSheetAsk(q)) return null;

  // Time first (more specific than bare "hora" noise)
  if (
    /\bque\s+hora\s+es\b/.test(q)
    || /\bque\s+hora\s+tenemos\b/.test(q)
    || /\bdime\s+(la\s+)?hora\b/.test(q)
    || /\bhora\s+actual\b/.test(q)
    || /\bwhat\s+time\s+is\s+it\b/.test(q)
    || /\bwhat'?s\s+the\s+time\b/.test(q)
    || /\btell\s+me\s+the\s+time\b/.test(q)
  ) {
    return "time";
  }

  if (
    /\bque\s+fecha\s+(es|tenemos|tenemos\s+hoy)?\b/.test(q)
    || /\bfecha\s+(de\s+)?hoy\b/.test(q)
    || /\bdime\s+(la\s+)?fecha\b/.test(q)
    || /\bwhat(?:'?s|\s+is)\s+the\s+date\b/.test(q)
    || /\bwhat\s+date\s+is\s+(it|today)\b/.test(q)
  ) {
    return "date";
  }

  if (
    /\bque\s+dia\s+(es|somos)(\s+hoy)?\b/.test(q)
    || /\bdia\s+de\s+hoy\b/.test(q)
    || /\bdime\s+(el\s+)?dia\b/.test(q)
    || /\bwhat\s+day\s+is\s+(it|today)\b/.test(q)
    || /\bwhat(?:'?s|\s+is)\s+the\s+day\b/.test(q)
  ) {
    return "day";
  }

  return null;
}

/**
 * @param {string} text
 */
export function wantsGinaWallClock(text) {
  return parseWallClockIntent(text) != null;
}
