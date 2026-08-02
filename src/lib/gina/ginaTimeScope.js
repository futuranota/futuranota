/**
 * Parse natural-language time scopes for Gina.
 */

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

  // para mañana / tomorrow (exclusive)
  if (
    /\bpara\s+(manana|mañana)\b/.test(q)
    || (/\b(manana|mañana|tomorrow)\b/.test(q) && !/\bhoy\b/.test(q) && !/\btoday\b/.test(q))
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

  if (/\b(hoy|today|para hoy)\b/.test(q)) {
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

  return null;
}

export {
  fold as foldGinaText,
  dayKey,
  startOfDay,
  endOfDay,
  addDays,
  toDate,
};
