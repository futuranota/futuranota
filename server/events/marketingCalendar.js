import { isoToDateOnly } from "./normalize.js";

/** @typedef {'winter'|'spring'|'summer'|'fall'} MarketingSeason */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   summary: string,
 *   season: MarketingSeason,
 *   category: string,
 *   month: number,
 *   day: number,
 * }} FixedMarketingMoment
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   summary: string,
 *   season: MarketingSeason,
 *   category: string,
 *   rule: 'second-sunday-may'|'third-sunday-june'|'fourth-friday-november'|'monday-after-thanksgiving'|'thanksgiving-us'|'first-monday-september',
 * }} ComputedMarketingMoment
 */

/** Fixed-date ecommerce / marketing moments (US-centric; country holidays come from Calendarific). */
export const FIXED_MARKETING_MOMENTS = /** @type {FixedMarketingMoment[]} */ ([
  {
    id: "new-year",
    title: "New Year's Day",
    summary: "Fresh-start campaigns, resolutions, and Q1 planning windows.",
    season: "winter",
    category: "holiday",
    month: 1,
    day: 1,
  },
  {
    id: "valentines",
    title: "Valentine's Day",
    summary: "Gift, companion-product, and limited-edition drop window.",
    season: "winter",
    category: "retail",
    month: 2,
    day: 14,
  },
  {
    id: "international-womens-day",
    title: "International Women's Day",
    summary: "Brand storytelling and cause-led commerce moment.",
    season: "spring",
    category: "campaign",
    month: 3,
    day: 8,
  },
  {
    id: "st-patricks",
    title: "St. Patrick's Day",
    summary: "Seasonal merch, F&B promos, and themed companion SKUs.",
    season: "spring",
    category: "retail",
    month: 3,
    day: 17,
  },
  {
    id: "earth-day",
    title: "Earth Day",
    summary: "Sustainability messaging and eco companion positioning.",
    season: "spring",
    category: "campaign",
    month: 4,
    day: 22,
  },
  {
    id: "independence-day-us",
    title: "Independence Day (US)",
    summary: "Summer peak for outdoor, picnic, and Americana retail.",
    season: "summer",
    category: "holiday",
    month: 7,
    day: 4,
  },
  {
    id: "back-to-school",
    title: "Back to School",
    summary: "Late-summer retail push — supplies, apparel, dorm companions.",
    season: "summer",
    category: "seasonal",
    month: 8,
    day: 15,
  },
  {
    id: "halloween",
    title: "Halloween",
    summary: "Themed products, limited runs, and social-first campaigns.",
    season: "fall",
    category: "retail",
    month: 10,
    day: 31,
  },
  {
    id: "single-day-11-11",
    title: "Singles' Day (11.11)",
    summary: "Global ecommerce spike — flash deals and bundle tests.",
    season: "fall",
    category: "retail",
    month: 11,
    day: 11,
  },
  {
    id: "christmas",
    title: "Christmas",
    summary: "Peak gifting season — ship deadlines and companion bundles.",
    season: "winter",
    category: "holiday",
    month: 12,
    day: 25,
  },
  {
    id: "boxing-day",
    title: "Boxing Day",
    summary: "Post-Christmas clearance and year-end inventory push.",
    season: "winter",
    category: "retail",
    month: 12,
    day: 26,
  },
  {
    id: "new-years-eve",
    title: "New Year's Eve",
    summary: "Celebration merch, countdown promos, and year-end urgency.",
    season: "winter",
    category: "holiday",
    month: 12,
    day: 31,
  },
]);

export const COMPUTED_MARKETING_MOMENTS = /** @type {ComputedMarketingMoment[]} */ ([
  {
    id: "mothers-day-us",
    title: "Mother's Day",
    summary: "Gift-led companion products and short ship windows.",
    season: "spring",
    category: "retail",
    rule: "second-sunday-may",
  },
  {
    id: "fathers-day-us",
    title: "Father's Day",
    summary: "Gift bundles and masculine companion SKUs.",
    season: "summer",
    category: "retail",
    rule: "third-sunday-june",
  },
  {
    id: "labor-day-us",
    title: "Labor Day (US)",
    summary: "End-of-summer sale weekend and last-chance summer clearance.",
    season: "summer",
    category: "retail",
    rule: "first-monday-september",
  },
  {
    id: "thanksgiving-us",
    title: "Thanksgiving (US)",
    summary: "Pre-Black-Friday warm-up and hospitality companions.",
    season: "fall",
    category: "holiday",
    rule: "thanksgiving-us",
  },
  {
    id: "black-friday",
    title: "Black Friday",
    summary: "Peak discount window — companion attach and bundle tests.",
    season: "fall",
    category: "retail",
    rule: "fourth-friday-november",
  },
  {
    id: "cyber-monday",
    title: "Cyber Monday",
    summary: "Digital-first promos and DTC conversion push.",
    season: "fall",
    category: "retail",
    rule: "monday-after-thanksgiving",
  },
]);

/**
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} weekday 0=Sun
 * @param {number} n nth occurrence
 */
function nthWeekdayOfMonth(year, month, weekday, n) {
  const cursor = new Date(year, month - 1, 1, 12);
  let count = 0;
  while (cursor.getMonth() === month - 1) {
    if (cursor.getDay() === weekday) {
      count += 1;
      if (count === n) {
        return `${year}-${String(month).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return "";
}

/**
 * @param {number} year
 */
function thanksgivingUs(year) {
  return nthWeekdayOfMonth(year, 11, 4, 4);
}

/**
 * @param {ComputedMarketingMoment} moment
 * @param {number} year
 */
function resolveComputedDate(moment, year) {
  switch (moment.rule) {
    case "second-sunday-may":
      return nthWeekdayOfMonth(year, 5, 0, 2);
    case "third-sunday-june":
      return nthWeekdayOfMonth(year, 6, 0, 3);
    case "fourth-friday-november":
      return nthWeekdayOfMonth(year, 11, 5, 4);
    case "thanksgiving-us":
      return thanksgivingUs(year);
    case "monday-after-thanksgiving": {
      const tg = thanksgivingUs(year);
      if (!tg) return "";
      const d = new Date(`${tg}T12:00:00`);
      d.setDate(d.getDate() + 4);
      return isoToDateOnly(d.toISOString());
    }
    case "first-monday-september":
      return nthWeekdayOfMonth(year, 9, 1, 1);
    default:
      return "";
  }
}

/**
 * @param {number} month 1-12
 * @returns {MarketingSeason}
 */
export function seasonFromMonth(month) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

/**
 * @param {string} from YYYY-MM-DD
 * @param {string} to YYYY-MM-DD
 * @returns {import("./normalize.js").CalendarEvent[]}
 */
export function buildCuratedMarketingEvents(from, to) {
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return [];

  /** @type {import("./normalize.js").CalendarEvent[]} */
  const events = [];

  for (let year = startYear; year <= endYear; year += 1) {
    FIXED_MARKETING_MOMENTS.forEach((moment) => {
      const date = `${year}-${String(moment.month).padStart(2, "0")}-${String(moment.day).padStart(2, "0")}`;
      if (date < from || date > to) return;
      events.push({
        id: `marketing:${moment.id}:${year}`,
        title: moment.title,
        summary: moment.summary,
        date,
        dateEnd: null,
        source: "Futura marketing calendar",
        type: moment.category,
        rank: 80,
        season: moment.season,
      });
    });

    COMPUTED_MARKETING_MOMENTS.forEach((moment) => {
      const date = resolveComputedDate(moment, year);
      if (!date || date < from || date > to) return;
      events.push({
        id: `marketing:${moment.id}:${year}`,
        title: moment.title,
        summary: moment.summary,
        date,
        dateEnd: null,
        source: "Futura marketing calendar",
        type: moment.category,
        rank: 85,
        season: moment.season,
      });
    });
  }

  return events;
}
