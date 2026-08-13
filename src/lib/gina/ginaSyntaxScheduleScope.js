/**
 * Syntax bank: visualize scheduled documents by time scope (all / week / today).
 * Chip commands from post-listado refine intent.
 *
 * Pattern: every new Gina intent ships a ginaSyntax*.js + tests of variants.
 */

import { foldGinaText, dayKey, toDate, ginaWeekBounds } from "./ginaTimeScope.js";

/** Stable chip / command labels (ES). */
export const GINA_SCHEDULE_SCOPE_CHIPS_ES = [
  {
    id: "scope_all",
    scope: "all",
    label: "visualizar todos los horarios creados",
    text: "visualizar todos los horarios creados",
  },
  {
    id: "scope_week",
    scope: "week",
    label: "visualizar todos los horarios de la semana",
    text: "visualizar todos los horarios de la semana",
  },
  {
    id: "scope_today",
    scope: "today",
    label: "visualizar todos los horarios de hoy",
    text: "visualizar todos los horarios de hoy",
  },
];

/** @type {typeof GINA_SCHEDULE_SCOPE_CHIPS_ES} */
export const GINA_SCHEDULE_SCOPE_CHIPS_EN = [
  {
    id: "scope_all",
    scope: "all",
    label: "view all created schedules",
    text: "view all created schedules",
  },
  {
    id: "scope_week",
    scope: "week",
    label: "view all schedules this week",
    text: "view all schedules this week",
  },
  {
    id: "scope_today",
    scope: "today",
    label: "view all schedules for today",
    text: "view all schedules for today",
  },
];

/**
 * @param {string} [locale]
 */
export function getGinaScheduleScopeChips(locale = "es") {
  return locale === "en" ? GINA_SCHEDULE_SCOPE_CHIPS_EN : GINA_SCHEDULE_SCOPE_CHIPS_ES;
}

/**
 * @param {string} text
 * @returns {"all" | "week" | "today" | null}
 */
export function parseGinaScheduleScope(text) {
  const q = foldGinaText(text);
  if (!q) return null;

  // Exact refine-chip wording (and close EN mirrors) — do not steal
  // classic "muéstrame los horarios de hoy" → today / schedule_sheet.
  if (
    /\bvisualizar\s+todos\s+los\s+horarios\s+de\s+hoy\b/.test(q)
    || /\bview\s+all\s+schedules?\s+(for\s+)?today\b/.test(q)
  ) {
    return "today";
  }
  if (
    /\bvisualizar\s+todos\s+los\s+horarios\s+de\s+la\s+semana\b/.test(q)
    || /\bview\s+all\s+schedules?\s+(this\s+)?week\b/.test(q)
    || /\bhorarios?\s+de\s+la\s+semana\b/.test(q)
    || (/\bhorarios?\b/.test(q) && /\b(esta\s+)?semana\b/.test(q) && !/\bhoy\b/.test(q))
    || (/\bdocumentos?\b/.test(q) && /\bhorarios?\b/.test(q) && /\bsemana\b/.test(q))
  ) {
    return "week";
  }
  if (
    /\bvisualizar\s+todos\s+los\s+horarios\s+creados\b/.test(q)
    || /\bview\s+all\s+created\s+schedules?\b/.test(q)
    || /\b(todos\s+los\s+)?horarios?\s+(creados|activos)\b/.test(q)
    || (/\b(dame|entreg\w*|muestra\w*|trae\w*|quiero|ver)\b/.test(q)
      && /\b(todos\s+los\s+)?horarios?\b/.test(q)
      && !/\bhoy\b/.test(q)
      && !/\bsemana\b/.test(q)
      && !/\bmu[eé]strame\s+los\s+horarios\s+de\s+hoy\b/.test(q))
  ) {
    return "all";
  }

  return null;
}

/**
 * @param {string} text
 */
export function wantsGinaScheduleScopeList(text) {
  return parseGinaScheduleScope(text) != null;
}

/**
 * Monday–Sunday by default (prefs.weekStartsOn); see ginaTimeScope.ginaWeekBounds.
 * @param {Date} now
 * @param {number} [weekOffset]
 * @param {{ weekStartsOn?: 0 | 1 }} [opts]
 */
export { ginaWeekBounds };

/**
 * Keep docs whose anchorAt falls in scheduleScope.
 * Assumes caller already dropped docs without anchorAt when showSchedule.
 * @param {object[]} docs
 * @param {"all"|"week"|"today"|null|undefined} scope
 * @param {Date} [now]
 */
export function filterDocsByScheduleScope(docs, scope, now = new Date()) {
  const list = Array.isArray(docs) ? docs : [];
  if (!scope || scope === "all") return list;
  const clock = now instanceof Date ? now : new Date();
  if (scope === "today") {
    const today = dayKey(clock);
    return list.filter((d) => {
      const at = toDate(d?.anchorAt);
      return at && dayKey(at) === today;
    });
  }
  if (scope === "week") {
    const { monday, sunday } = ginaWeekBounds(clock, 0);
    const start = dayKey(monday);
    const end = dayKey(sunday);
    return list.filter((d) => {
      const at = toDate(d?.anchorAt);
      if (!at) return false;
      const k = dayKey(at);
      return k && start && end && k >= start && k <= end;
    });
  }
  return list;
}
