import { getWeatherActionCap } from "./planConfig.js";
import { resetLocalCityChangeUsage } from "./weatherCityRateLimit.js";
import { getWeatherLocationKey, normalizeWeatherLocation } from "./weatherLocation.js";
import { usePlanStore } from "../stores/planStore.js";
import { useUpgradeModalStore } from "../stores/upgradeModalStore.js";

const LOCAL_COUNT_KEY = "futuranota-weather-actions-used";
const FORECAST_NODE_INSERTED_KEY = "futuranota-forecast-node-inserted";

export function readLocalWeatherActionsUsed() {
  try {
    if (typeof localStorage === "undefined") return 0;
    const raw = localStorage.getItem(LOCAL_COUNT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function persistLocalWeatherActionsUsed(count) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LOCAL_COUNT_KEY, String(Math.max(0, count)));
  } catch {
    /* ignore */
  }
}

export function readForecastNodeInserted() {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(FORECAST_NODE_INSERTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistForecastNodeInserted() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FORECAST_NODE_INSERTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Clears local forecast node counter and city-change antibot state (dev / testing). */
export function resetLocalWeatherUsage() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LOCAL_COUNT_KEY);
    localStorage.removeItem(FORECAST_NODE_INSERTED_KEY);
    localStorage.removeItem("futuranota-weather-baseline-key");
    resetLocalCityChangeUsage();
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} used
 * @param {string} plan
 */
export function formatWeatherActionCounter(used, plan) {
  const cap = getWeatherActionCap(plan);
  const safeUsed = Math.max(0, Math.min(used, cap));
  return `${safeUsed}/${cap}`;
}

/** @deprecated Location apply always consumes; kept for tests. */
export function classifyWeatherLocationChange(prevLocation, nextLocation) {
  const prevKey = getWeatherLocationKey(normalizeWeatherLocation(prevLocation));
  const nextKey = getWeatherLocationKey(normalizeWeatherLocation(nextLocation));
  if (!nextKey || nextKey === prevKey) return "same";
  return "consume";
}

/** Free → upgrade modal; Pro → inline limit only. */
export function notifyWeatherActionLimit() {
  if (usePlanStore.getState().isPro()) return false;
  useUpgradeModalStore.getState().show("weather");
  return true;
}
