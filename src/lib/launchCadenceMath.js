const MONTH_FORMATTER_EN = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMATTER_EN = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const DEFAULT_ANNOUNCEMENT_LEAD_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string|null|undefined} iso YYYY-MM-DD
 */
export function parseIsoDate(iso) {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const d = new Date(`${iso.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date|string} date
 */
export function startOfCalendarDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Signed whole days from `from` → `to` (floor).
 * @param {Date|string} from
 * @param {Date|string} to
 */
export function daysBetween(from, to) {
  const a = startOfCalendarDay(from);
  const b = startOfCalendarDay(to);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * @param {Date|string} date
 * @param {number} days
 */
export function subtractDays(date, days) {
  const d = startOfCalendarDay(date);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * @param {string} launchDateIso
 * @param {number} [leadDays]
 * @returns {string|null} ISO date
 */
export function deriveAnnouncementDateIso(launchDateIso, leadDays = DEFAULT_ANNOUNCEMENT_LEAD_DAYS) {
  const launch = parseIsoDate(launchDateIso);
  if (!launch) return null;
  return toIsoDateString(subtractDays(launch, leadDays));
}

/**
 * @param {Date|string} date
 */
export function formatShortDateEn(date) {
  const d = date instanceof Date ? date : new Date(date);
  return SHORT_DATE_FORMATTER_EN.format(d);
}

/**
 * @param {Date|string} date
 */
export function toIsoDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const last = parseIsoDate(lastLaunchDate);
  const todayDay = startOfCalendarDay(today);
  if (!last || !todayDay || !Number.isFinite(averageIntervalMonths) || averageIntervalMonths <= 0) {
    return {
      monthsSinceLast: 0,
      monthsRemaining: 0,
      estimatedLaunchDate: todayDay,
      estimatedMonthLabel: formatMonthYearEn(todayDay),
      todayLabel: formatMonthYearEn(todayDay),
    };
  }

  const monthsSinceLast = Math.max(0, monthsBetween(last, todayDay));
  const monthsRemaining = Math.max(
    0,
    Math.round((averageIntervalMonths - monthsSinceLast) * 10) / 10,
  );
  const estimatedLaunchDate = addMonths(startOfCalendarMonth(todayDay), Math.ceil(monthsRemaining));

  return {
    monthsSinceLast,
    monthsRemaining: Math.ceil(monthsRemaining),
    estimatedLaunchDate,
    estimatedMonthLabel: formatMonthYearEn(estimatedLaunchDate),
    todayLabel: formatMonthYearEn(todayDay),
  };
}

/**
 * Confirmed campaign window from admin/Librería — compares calendar today
 * against announcement + launch dates and returns the remaining day range.
 * @param {Object} params
 * @param {Date} params.today
 * @param {string} params.launchDate ISO YYYY-MM-DD
 * @param {string|null} [params.announcementDate] ISO; derived from launch when omitted
 * @param {string} [params.overview]
 * @param {string} [params.category]
 */
export function computeCampaignWindowProjection({
  today,
  launchDate,
  announcementDate = null,
  overview = "",
  category = "",
}) {
  const launch = parseIsoDate(launchDate);
  if (!launch) return null;

  const now = startOfCalendarDay(today);
  const announceIso = announcementDate || deriveAnnouncementDateIso(launchDate);
  const announce = parseIsoDate(announceIso);

  const daysUntilLaunch = daysBetween(now, launch);
  const daysUntilAnnouncement = announce ? daysBetween(now, announce) : null;
  const windowTotalDays = announce ? Math.max(0, daysBetween(announce, launch)) : null;

  let phase = "ship-window";
  if (daysUntilLaunch < 0) phase = "post-launch";
  else if (daysUntilAnnouncement != null && daysUntilAnnouncement > 0) phase = "pre-announcement";

  const rangeDaysRemaining = Math.max(0, daysUntilLaunch);
  const windowDaysRemaining = announce
    ? Math.max(0, daysBetween(now < announce ? announce : now, launch))
    : rangeDaysRemaining;

  let rangeLabel = "";
  if (phase === "post-launch") {
    rangeLabel = `Launch date passed ${Math.abs(daysUntilLaunch)} day${Math.abs(daysUntilLaunch) === 1 ? "" : "s"} ago`;
  } else if (phase === "pre-announcement" && daysUntilAnnouncement != null) {
    rangeLabel = `${daysUntilAnnouncement} day${daysUntilAnnouncement === 1 ? "" : "s"} until announcement · ${rangeDaysRemaining} until launch`;
  } else {
    rangeLabel = `${rangeDaysRemaining} day${rangeDaysRemaining === 1 ? "" : "s"} left until launch`;
  }

  return {
    todayLabel: formatShortDateEn(now),
    todayIso: toIsoDateString(now),
    announcementDate: announceIso,
    announcementLabel: announce ? formatShortDateEn(announce) : null,
    launchDate,
    launchLabel: formatShortDateEn(launch),
    daysUntilLaunch,
    daysUntilAnnouncement,
    windowTotalDays,
    windowDaysRemaining,
    rangeDaysRemaining,
    rangeLabel,
    phase,
    overview: overview.trim(),
    category: category.trim(),
  };
}
