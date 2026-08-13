/**
 * Parse natural-language time scopes for Gina.
 */

import { getGinaPrefs } from "./ginaPrefs.js";

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(d) {
  const x = toDate(d);
  if (!x) return null;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date} d
 * @param {string} [locale]
 */
export function formatConfirmDateLabel(d, locale = "es") {
  return d.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * @param {string} text
 * @param {Date | string | number} [nowValue]
 * @param {{ locale?: string }} [opts]
 * @returns {{
 *   kind: null | "today" | "tomorrow_only" | "through_tomorrow" | "day_offset" | "this_week" | "next_week",
 *   startKey: string | null,
 *   endKey: string | null,
 *   dayOffset: number | null,
 *   needsConfirm: boolean,
 *   confirmDateKey: string | null,
 *   confirmDateLabel: string | null,
 *   remainder: string,
 * } | null}
 */
export function parseGinaTimeScope(text, nowValue = new Date(), opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const now = toDate(nowValue) || new Date();
  const q = fold(text);
  if (!q) return null;

  let remainder = q;
  const strip = (re) => {
    remainder = remainder.replace(re, " ").replace(/\s+/g, " ").trim();
  };

  // hasta mañana / until tomorrow → today + tomorrow
  if (/\bhasta\s+(manana|mañana)\b/.test(q) || /\buntil\s+tomorrow\b/.test(q)) {
    strip(/\bhasta\s+(manana|mañana)\b/g);
    strip(/\buntil\s+tomorrow\b/g);
    const start = startOfDay(now);
    const end = addDays(start, 1);
    return {
      kind: "through_tomorrow",
      startKey: dayKey(start),
      endKey: dayKey(end),
      dayOffset: null,
      needsConfirm: false,
      confirmDateKey: null,
      confirmDateLabel: null,
      remainder,
    };
  }

  // dentro de N días / in N days → only day today+N, confirm
  const within = q.match(/\bdentro\s+de\s+(\d+)\s+d[ií]as?\b/)
    || q.match(/\bin\s+(\d+)\s+days?\b/)
    || q.match(/\bwithin\s+(\d+)\s+days?\b/);
  if (within) {
    const n = Number(within[1]);
    strip(/\bdentro\s+de\s+\d+\s+d[ií]as?\b/g);
    strip(/\bin\s+\d+\s+days?\b/g);
    strip(/\bwithin\s+\d+\s+days?\b/g);
    const target = addDays(startOfDay(now), n);
    return {
      kind: "day_offset",
      startKey: dayKey(target),
      endKey: dayKey(target),
      dayOffset: n,
      needsConfirm: true,
      confirmDateKey: dayKey(target),
      confirmDateLabel: formatConfirmDateLabel(target, locale),
      remainder,
    };
  }

  // para mañana — explicit only (not "nos vemos mañana")
  if (
    /\bpara\s+(manana|mañana)\b/.test(q)
    || /\b(que|qué)\s+(tengo|hay|tenemos)\b.*\b(manana|mañana)\b/.test(q)
    || /\b(dime|muestra|muestrame|entreg|lista|revis)\w*\b.*\b(manana|mañana)\b/.test(q)
    || /\bwhat\s+(do\s+i\s+)?have\s+(for\s+)?tomorrow\b/.test(q)
    || /\b(show|list|give)\s+me\b.*\btomorrow\b/.test(q)
  ) {
    strip(/\bpara\s+(manana|mañana)\b/g);
    strip(/\b(manana|mañana|tomorrow)\b/g);
    const t = addDays(startOfDay(now), 1);
    return {
      kind: "tomorrow_only",
      startKey: dayKey(t),
      endKey: dayKey(t),
      dayOffset: 1,
      needsConfirm: false,
      confirmDateKey: null,
      confirmDateLabel: null,
      remainder,
    };
  }

  if (/\b(esta semana|this week)\b/.test(q) && !/\b(proxima|próxima|next)\b/.test(q)) {
    strip(/\b(esta semana|this week)\b/g);
    return {
      kind: "this_week",
      startKey: null,
      endKey: null,
      dayOffset: null,
      needsConfirm: false,
      confirmDateKey: null,
      confirmDateLabel: null,
      remainder,
    };
  }

  if (/\b(proxima semana|próxima semana|next week)\b/.test(q)) {
    strip(/\b(proxima semana|próxima semana|next week)\b/g);
    return {
      kind: "next_week",
      startKey: null,
      endKey: null,
      dayOffset: null,
      needsConfirm: false,
      confirmDateKey: null,
      confirmDateLabel: null,
      remainder,
    };
  }

  // HOY — only explicit scope ask (not "estoy cansado hoy" / "hoy no")
  if (!/\bhoy\s+no\b/.test(q) && !/\bnot\s+today\b/.test(q) && !/\bhasta\s+luego\b/.test(q)) {
    const explicitToday =
      /\b(que|qué)\s+(tengo|hay|tenemos)\b.*\b(para\s+)?hoy\b/.test(q)
      || /\b(para\s+)?hoy\b.*\b(tengo|hay|tenemos)\b/.test(q)
      || /\b(dime|muestra|muestrame|muéstrame|entregame|entrégame|entreg[aue]|lista|revis[ae]|scope)\w*\b.*\b(para\s+)?hoy\b/.test(q)
      || (/\bpara\s+hoy\b/.test(q) && /\b(que|qué|dime|muestra|entreg|hay|tengo|tenemos|lista|scope|revis)\w*\b/.test(q))
      || /\bhorarios?\s+(de\s+)?hoy\b/.test(q)
      || /\benfoc\w*\b.*\bhoy\b/.test(q)
      || /\bhoy\s+en\b/.test(q)
      || /\bexpand(ir|e)?\b.*\bhoy\b/.test(q)
      || /\bstatus\s+\w+\s+hoy\b/.test(q)
      || /\bfolder\s+.+\bhoy\b/.test(q)
      || /\bcategor(í|i)a\s+.+\bhoy\b/.test(q)
      || /\b(horas?\s+)?vencid\w*\b.*\bhoy\b/.test(q)
      || /\bdesde\s+ahora\b.*\bhoy\b/.test(q)
      || /\btodos\s+los\s+de\s+hoy\b/.test(q)
      || /\bwhat\s+(do\s+i\s+)?have\s+(for\s+)?today\b/.test(q)
      || /\b(show|list|give)\s+me\b.*\btoday\b/.test(q)
      || /\bfocus\s+today\s+on\b/.test(q)
      || /\btoday'?s?\s+(docs|documents|schedule|scope|work|agenda|hours)\b/.test(q);

    if (explicitToday) {
      strip(/\b(para\s+hoy|hoy|today)\b/g);
      return {
        kind: "today",
        startKey: dayKey(now),
        endKey: dayKey(now),
        dayOffset: 0,
        needsConfirm: false,
        confirmDateKey: null,
        confirmDateLabel: null,
        remainder,
      };
    }
  }

  return null;
}

/**
 * Week bounds (local calendar). Default Mon–Sun; prefs.weekStartsOn 0 = Sun–Sat.
 * @param {Date} now
 * @param {number} [weekOffset]
 * @param {{ weekStartsOn?: 0 | 1 }} [opts]
 */
export function ginaWeekBounds(now, weekOffset = 0, opts = {}) {
  let weekStartsOn = opts.weekStartsOn;
  if (weekStartsOn !== 0 && weekStartsOn !== 1) {
    weekStartsOn = getGinaPrefs().weekStartsOn;
  }
  if (weekStartsOn !== 0 && weekStartsOn !== 1) weekStartsOn = 1;

  const base = startOfDay(now);
  const day = base.getDay(); // 0 Sun … 6 Sat
  let startOffset;
  if (weekStartsOn === 0) {
    startOffset = -day;
  } else {
    startOffset = day === 0 ? -6 : 1 - day;
  }
  const weekStart = addDays(base, startOffset + weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  return {
    weekStart,
    weekEnd,
    /** @deprecated use weekStart — kept for Mon-default call sites */
    monday: weekStart,
    sunday: weekEnd,
    weekStartsOn,
  };
}

export {
  fold as foldGinaText,
  dayKey,
  startOfDay,
  endOfDay,
  addDays,
  toDate,
};
