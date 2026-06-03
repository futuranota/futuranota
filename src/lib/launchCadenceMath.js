const MONTH_FORMATTER_EN = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

/**
 * @param {Date|string} date
 */
export function startOfCalendarMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Whole months from `from` → `to` (calendar months, floor).
 * @param {Date|string} from
 * @param {Date|string} to
 */
export function monthsBetween(from, to) {
  const a = startOfCalendarMonth(from);
  const b = startOfCalendarMonth(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * @param {Date|string} date
 * @param {number} months
 */
export function addMonths(date, months) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/**
 * @param {Date} date
 */
export function formatMonthYearEn(date) {
  const d = date instanceof Date ? date : new Date(date);
  return MONTH_FORMATTER_EN.format(d);
}

/**
 * @param {Date} today
 */
export function formatReferenceMonthLabelEn(today) {
  return formatMonthYearEn(today);
}

/**
 * @param {Object} params
 * @param {Date} params.today
 * @param {number} params.averageIntervalMonths
 * @param {string} params.lastLaunchDate ISO YYYY-MM-DD
 */
export function computeLaunchCadenceProjection({
  today,
  averageIntervalMonths,
  lastLaunchDate,
}) {
  const last = new Date(`${lastLaunchDate}T12:00:00`);
  const monthsSinceLast = Math.max(0, monthsBetween(last, today));
  const monthsRemaining = Math.max(
    0,
    Math.round((averageIntervalMonths - monthsSinceLast) * 10) / 10,
  );
  const estimatedLaunchDate = addMonths(startOfCalendarMonth(today), Math.ceil(monthsRemaining));

  return {
    monthsSinceLast,
    monthsRemaining: Math.ceil(monthsRemaining),
    estimatedLaunchDate,
    estimatedMonthLabel: formatMonthYearEn(estimatedLaunchDate),
    todayLabel: formatMonthYearEn(today),
  };
}
