import {
  dedupeEvents,
  filterEventsInRange,
  sortEventsByDate,
} from "./normalize.js";
import { readEventCache, writeEventCache } from "./eventCache.js";
import { fetchCalendarificEvents } from "./calendarific.js";
import { buildCuratedMarketingEvents } from "./marketingCalendar.js";
import { filterMarketingEvents } from "./marketingFilter.js";
import {
  getCalendarificApiKey,
  getDefaultEventCountry,
} from "./env.js";

/**
 * @param {string} from YYYY-MM-DD
 * @param {string} to YYYY-MM-DD
 * @param {string} [country]
 */
function buildCacheKey(from, to, country) {
  return `events:${country}:${from}:${to}`;
}

/**
 * @param {{ from: string, to: string, country?: string, limit?: number }} params
 */
export async function fetchMergedCalendarEvents({
  from,
  to,
  country = getDefaultEventCountry(),
  limit = 24,
}) {
  const countryCode = (country || getDefaultEventCountry()).toUpperCase();
  const cacheKey = buildCacheKey(from, to, countryCode);
  const cached = readEventCache(cacheKey);
  if (cached && typeof cached === "object" && Array.isArray(cached.events)) {
    return { ...cached, fromCache: true };
  }

  const hasCalendarific = Boolean(getCalendarificApiKey());
  const errors = [];

  let holidayEvents = [];
  const curatedEvents = buildCuratedMarketingEvents(from, to);

  if (hasCalendarific) {
    try {
      holidayEvents = await fetchCalendarificEvents({
        from,
        to,
        country: countryCode,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  let events = dedupeEvents(
    sortEventsByDate(
      filterEventsInRange(
        from,
        to,
        filterMarketingEvents([...curatedEvents, ...holidayEvents]),
      ),
    ),
  ).slice(0, limit);

  const source = "marketing";
  if (!events.length && !hasCalendarific) {
    errors.push(
      "No marketing calendar data for this window. "
      + "Optional: add CALENDARIFIC_API_KEY for country-specific holidays.",
    );
  }

  const body = {
    events,
    from,
    to,
    country: countryCode,
    source,
    focus: "ecommerce-marketing-seasons",
    providers: {
      curated: true,
      calendarific: hasCalendarific,
    },
    errors: errors.length ? errors : undefined,
  };

  if (events.length) {
    writeEventCache(cacheKey, body);
  }

  return body;
}
