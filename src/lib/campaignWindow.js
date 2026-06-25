const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RANGE_DAYS = 90;

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
