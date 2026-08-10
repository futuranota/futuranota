/**
 * Shared calendar-day helpers for Gina day sheet + talk notifications.
 * After midnight, yesterday’s ritual stays valid until this local hour (exclusive).
 */
export const GINA_DAY_RITUAL_OVERNIGHT_UNTIL_HOUR = 6;

/**
 * @param {Date} [d]
 * @returns {string} YYYY-MM-DD local
 */
export function ginaDayKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD local for yesterday
 */
export function ginaYesterdayKey(now = new Date()) {
  const x = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(x.getTime())) return "";
  x.setDate(x.getDate() - 1);
  return ginaDayKey(x);
}

/**
 * True when a stored ritual date still applies (today, or yesterday before 06:00).
 * @param {string | null | undefined} storedDate
 * @param {Date} [now]
 */
export function isAcceptableGinaDayRitualDate(storedDate, now = new Date()) {
  const key = String(storedDate || "").trim();
  if (!key) return false;
  const n = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(n.getTime())) return false;
  if (key === ginaDayKey(n)) return true;
  if (n.getHours() < GINA_DAY_RITUAL_OVERNIGHT_UNTIL_HOUR) {
    return key === ginaYesterdayKey(n);
  }
  return false;
}

/**
 * Whether we’re in the overnight window (local hour &lt; 6).
 * @param {Date} [now]
 */
export function isGinaDayRitualOvernight(now = new Date()) {
  const n = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(n.getTime())) return false;
  return n.getHours() < GINA_DAY_RITUAL_OVERNIGHT_UNTIL_HOUR;
}
