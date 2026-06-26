/**
 * In-memory daily city-change rate limit (server backstop).
 * Client sends X-Futura-City-Apply: 1 only on user location apply.
 */

const CITY_CAPS = { free: 5, pro: 50 };
const buckets = new Map();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {string} subject user id or ip
 * @param {'free'|'pro'} plan
 */
export function checkServerCityChangeLimit(subject, plan = "free") {
  const cap = CITY_CAPS[plan] || CITY_CAPS.free;
  const key = `${todayIso()}:${subject}`;
  const used = buckets.get(key) || 0;
  if (used >= cap) {
    return { ok: false, used, cap };
  }
  return { ok: true, used, cap };
}

/** @param {string} subject */
export function recordServerCityChange(subject) {
  const key = `${todayIso()}:${subject}`;
  buckets.set(key, (buckets.get(key) || 0) + 1);
}

export const WEATHER_ERROR_LOCATION_RATE_LIMITED = "location_rate_limited";
