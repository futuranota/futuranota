/**
 * Display clocks in 12-hour AM/PM (user-facing). Storage stays ISO / HH:mm 24h.
 */

/**
 * @param {string | Date | number | null | undefined} value ISO string, Date, or ms
 * @returns {string}
 */
export function formatClock12h(value) {
  if (value == null || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a HH:mm (24h) time input as 12h AM/PM.
 * @param {string | null | undefined} hhmm
 * @returns {string}
 */
export function formatTimeInput12h(hhmm) {
  const parts = String(hhmm || "").split(":").map(Number);
  const hours = parts[0];
  const mins = parts[1];
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return "";
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${period}`;
}

/**
 * @param {string | Date | null | undefined} start
 * @param {string | Date | null | undefined} finish
 * @param {{ sep?: string }} [opts]
 * @returns {string}
 */
export function formatClockRange12h(start, finish, opts = {}) {
  const sep = opts.sep || "–";
  const left = formatClock12h(start);
  if (!left) return "";
  const right = formatClock12h(finish);
  if (!right) return left;
  return `${left}${sep}${right}`;
}
