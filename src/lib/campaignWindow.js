const DAY_MS = 24 * 60 * 60 * 1000;

/** Intel analyst + Tavily lookback window (90 days — stable for Groq limits). */
export const DEFAULT_RANGE_DAYS = 90;

/** @param {string|null|undefined} value @param {Date} [today] */
export function parseLaunchDateInput(value, today = new Date()) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoTry = new Date(raw);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;

  const qMatch = raw.match(/Q([1-4])\s*(\d{4})/i);
  if (qMatch) {
    const quarter = Number.parseInt(qMatch[1], 10);
    const year = Number.parseInt(qMatch[2], 10);
    const month = (quarter - 1) * 3;
    return new Date(year, month, 15, 12, 0, 0);
  }

  const yearMatch = raw.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return new Date(Number.parseInt(yearMatch[1], 10), 6, 1, 12, 0, 0);
  }

  return null;
}

/**
 * Launch date is strictly after today (still upcoming).
 * @param {string|null|undefined} value
 * @param {Date} [today]
 */
export function isFutureLaunchDate(value, today = new Date()) {
  const d = parseLaunchDateInput(value, today);
  if (!d) return false;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d.getTime() > todayStart.getTime();
}

/**
 * Whole days from today until launch (positive = future).
 * @param {string|null|undefined} value
 * @param {Date} [today]
 */
export function daysUntilLaunch(value, today = new Date()) {
  const d = parseLaunchDateInput(value, today);
  if (!d) return null;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const launchStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((launchStart.getTime() - todayStart.getTime()) / DAY_MS);
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * True if the brand has a campaign worth surfacing right now:
 * - any confirmed FUTURE launchDate counts, no matter how far ahead
 *   (e.g. "next year" is fine — there's no upper cap on the forward look), OR
 * - lastLaunchDate falls within the past `rangeDays`, AND the projected next
 *   launch (lastLaunchDate + averageIntervalMonths) hasn't already passed —
 *   this filters out brands whose cycle is stale/overdue with nothing upcoming.
 * @param {{ launchDate?: string|null, lastLaunchDate?: string|null, averageIntervalMonths?: number|null }} params
 * @param {number} [rangeDays]
 * @param {Date} [today]
 */
export function isWithinFourMonthWindow({ launchDate, lastLaunchDate, averageIntervalMonths }, rangeDays = DEFAULT_RANGE_DAYS, today = new Date()) {
  const todayMs = today.getTime();

  const launch = parseIsoDate(launchDate);
  if (launch && launch.getTime() > todayMs) return true;

  const last = parseIsoDate(lastLaunchDate);
  if (last) {
    const diffDays = (todayMs - last.getTime()) / DAY_MS;
    if (diffDays >= 0 && diffDays <= rangeDays) {
      const avg = Number(averageIntervalMonths);
      if (!Number.isFinite(avg) || avg <= 0) return true;
      const projectedNext = addMonths(last, avg);
      return projectedNext.getTime() >= todayMs;
    }
  }

  return false;
}
