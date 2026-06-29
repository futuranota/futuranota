import { getWeatherCityChangeCap } from "./planConfig.js";
import { getWeatherLocationKey, normalizeWeatherLocation } from "./weatherLocation.js";

export const WEATHER_CITY_COOLDOWN_MS = 3000;

const LAST_APPLY_KEY = "futuranota-weather-city-last-apply";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dailyStorageKey() {
  return `futuranota-weather-city-changes-${todayIso()}`;
}

export function readCityChangesUsedToday() {
  try {
    if (typeof localStorage === "undefined") return 0;
    const raw = localStorage.getItem(dailyStorageKey());
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function persistCityChangesUsedToday(count) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(dailyStorageKey(), String(Math.max(0, count)));
  } catch {
    /* ignore */
  }
}

export function getCityChangeCooldownRemainingMs() {
  try {
    if (typeof localStorage === "undefined") return 0;
    const raw = localStorage.getItem(LAST_APPLY_KEY);
    const last = Number(raw);
    if (!Number.isFinite(last) || last <= 0) return 0;
    return Math.max(0, WEATHER_CITY_COOLDOWN_MS - (Date.now() - last));
  } catch {
    return 0;
  }
}

function touchLastApplyTimestamp() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LAST_APPLY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('./weatherLocation.js').WeatherLocation} prevLocation
 * @param {import('./weatherLocation.js').WeatherLocation} nextLocation
 * @param {string} plan
 */
export function checkCityChangeAllowed(prevLocation, nextLocation, plan) {
  const prevKey = getWeatherLocationKey(normalizeWeatherLocation(prevLocation));
  const nextKey = getWeatherLocationKey(normalizeWeatherLocation(nextLocation));
  if (!nextKey) return { ok: false, reason: "empty" };
  if (nextKey === prevKey) return { ok: true, reason: "same" };

  const cooldownMs = getCityChangeCooldownRemainingMs();
  if (cooldownMs > 0) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil(cooldownMs / 1000),
    };
  }

  if (plan !== "pro") {
    if (prevKey) {
      return { ok: false, reason: "free_city_locked" };
    }
    return { ok: true, reason: "allowed" };
  }

  const used = readCityChangesUsedToday();
  const cap = getWeatherCityChangeCap(plan);
  if (Number.isFinite(cap) && used >= cap) {
    return { ok: false, reason: "daily_limit", used, cap };
  }

  return { ok: true, reason: "allowed", used, cap };
}

export function recordCityChangeApply() {
  const next = readCityChangesUsedToday() + 1;
  persistCityChangesUsedToday(next);
  touchLastApplyTimestamp();
  return next;
}

/**
 * @param {number} used
 * @param {string} plan
 */
export function formatCityChangeCounter(used, plan) {
  const cap = getWeatherCityChangeCap(plan);
  if (!Number.isFinite(cap)) return String(Math.max(0, used));
  const safeUsed = Math.max(0, Math.min(used, cap));
  return `${safeUsed}/${cap}`;
}

export function resetLocalCityChangeUsage() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LAST_APPLY_KEY);
    localStorage.removeItem(dailyStorageKey());
  } catch {
    /* ignore */
  }
}
