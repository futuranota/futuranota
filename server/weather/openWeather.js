import { getOpenWeatherApiKey, isWeatherMockAllowed } from "./env.js";
import { mapConditionIcon } from "../../src/lib/weatherConditions.js";

const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast";
const OPENWEATHER_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
export const DEFAULT_CITY = "New York,US";
export const FORECAST_DAILY_HORIZON = 7;
/** OpenWeather 2.5 /forecast returns 3-hour steps (~5 full days + partial 6th). */
export const OPENWEATHER_MAX_DAILY_DAYS = 6;
export const WEATHER_CACHE_VERSION = "v4";
export const WEATHER_ERROR_LOCATION_NOT_FOUND = "location_not_found";
export const WEATHER_ERROR_NOT_CONFIGURED = "openweather_not_configured";

const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
  "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
  "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
  "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
  "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
  "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
  "virginia", "washington", "west virginia", "wisconsin", "wyoming",
]);

export class WeatherLocationNotFoundError extends Error {
  constructor(query = "") {
    super(WEATHER_ERROR_LOCATION_NOT_FOUND);
    this.name = "WeatherLocationNotFoundError";
    this.query = query;
  }
}

function formatGeocodeLabel(hit) {
  if (!hit) return "";
  const bits = [hit.name, hit.state, hit.country].filter(Boolean);
  return bits.join(", ");
}

function buildGeocodeCandidates(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const candidates = [trimmed];
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    candidates.push(part);
  }

  const lastPart = parts[parts.length - 1] || trimmed;
  const words = lastPart.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const maybeState = words.slice(1).join(" ").toLowerCase();
    const city = words[0];
    candidates.push(`${city},US`);
    if (US_STATE_NAMES.has(maybeState)) {
      candidates.push(`${city},US`);
    } else {
      candidates.push(`${city},${words.slice(1).join(" ")}`);
    }
  } else if (words.length === 1 && words[0].length > 2) {
    candidates.push(`${words[0]},US`);
  }

  if (parts.length >= 2) {
    const tail = parts[parts.length - 1];
    const headCity = tail.split(/\s+/)[0];
    if (headCity) candidates.push(`${headCity},US`);
  }

  return [...new Set(candidates.filter(Boolean))];
}

async function geocodeOpenWeatherQuery(query, apiKey) {
  const res = await fetch(
    `${OPENWEATHER_GEO_URL}?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`,
  );
  if (!res.ok) return null;

  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) return null;

  return {
    lat: hit.lat,
    lon: hit.lon,
    label: formatGeocodeLabel(hit),
  };
}

/**
 * @param {{ city?: string, lat?: number|null, lon?: number|null, label?: string }} location
 * @param {string} apiKey
 */
export async function resolveForecastLocation(location = {}, apiKey) {
  const lat = Number.isFinite(location.lat) ? location.lat : null;
  const lon = Number.isFinite(location.lon) ? location.lon : null;
  if (lat != null && lon != null) {
    return {
      lat,
      lon,
      label: location.label || cityLabel({ lat, lon }),
      query: `lat=${lat}&lon=${lon}`,
    };
  }

  const cityQuery = location.city?.trim();
  if (!cityQuery) {
    const fallback = await geocodeOpenWeatherQuery(DEFAULT_CITY, apiKey);
    if (!fallback) throw new WeatherLocationNotFoundError(DEFAULT_CITY);
    return {
      ...fallback,
      query: `lat=${fallback.lat}&lon=${fallback.lon}`,
    };
  }

  const candidates = buildGeocodeCandidates(cityQuery);
  for (const candidate of candidates) {
    const hit = await geocodeOpenWeatherQuery(candidate, apiKey);
    if (hit) {
      return {
        ...hit,
        query: `lat=${hit.lat}&lon=${hit.lon}`,
      };
    }
  }

  throw new WeatherLocationNotFoundError(cityQuery);
}

async function fetchOpenWeatherList(location = {}) {
  const apiKey = getOpenWeatherApiKey();
  if (!apiKey) {
    if (isWeatherMockAllowed()) {
      return { data: null, location, source: "mock", resolved: null };
    }
    const err = new Error(WEATHER_ERROR_NOT_CONFIGURED);
    err.code = WEATHER_ERROR_NOT_CONFIGURED;
    throw err;
  }

  let resolved;
  try {
    resolved = await resolveForecastLocation(location, apiKey);
  } catch (err) {
    if (err instanceof WeatherLocationNotFoundError) throw err;
    throw err;
  }

  const res = await fetch(
    `${OPENWEATHER_URL}?${resolved.query}&appid=${apiKey}&units=imperial`,
  );

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 || /city not found/i.test(text)) {
      throw new WeatherLocationNotFoundError(location.city || DEFAULT_CITY);
    }
    throw new Error(`OpenWeather ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    data,
    location,
    resolved,
    source: "openweather",
  };
}

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function formatAsOfLabel(date = new Date(), timezoneOffsetSec = 0) {
  const shifted = new Date(date.getTime() + timezoneOffsetSec * 1000);
  const h = shifted.getUTCHours();
  const m = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `as of ${h12}:${m} ${ampm}`;
}

function getCityDateIso(timezoneOffsetSec, unixMs = Date.now()) {
  const shifted = new Date(unixMs + timezoneOffsetSec * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayShortFromIso(dateIso) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day];
}

function formatShortDate(dateIso) {
  const month = Number(dateIso.slice(5, 7));
  const day = Number(dateIso.slice(8, 10));
  return `${month}/${day}`;
}

function dayLabelForDate(dateIso, cityTodayIso) {
  const shortDate = formatShortDate(dateIso);
  const todayMs = Date.parse(`${cityTodayIso}T00:00:00Z`);
  const targetMs = Date.parse(`${dateIso}T00:00:00Z`);
  const diffDays = Math.round((targetMs - todayMs) / 86400000);
  if (diffDays === 0) return `Today · ${shortDate}`;
  if (diffDays === 1) return `Tomorrow · ${shortDate}`;
  return `${weekdayShortFromIso(dateIso)} · ${shortDate}`;
}

function filterEntriesByPeriod(entries, period) {
  return entries.filter((entry) => {
    const hour = Number(entry.dt_txt?.slice(11, 13));
    if (Number.isNaN(hour)) return period === "all";
    if (period === "day") return hour >= 6 && hour < 18;
    if (period === "night") return hour < 6 || hour >= 18;
    return true;
  });
}

function pickRepresentativeEntry(entries, targetHour) {
  let best = entries[0];
  let bestDistance = Infinity;
  for (const entry of entries) {
    const hour = Number(entry.dt_txt?.slice(11, 13));
    const distance = Math.abs(hour - targetHour);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }
  return best;
}

function aggregatePeriodEntries(entries, period, dateIso, displayPeriod = period) {
  const scoped = filterEntriesByPeriod(entries, period);
  if (!scoped.length) return null;

  let high = -Infinity;
  let low = Infinity;
  let maxPop = 0;

  for (const entry of scoped) {
    const main = entry.main || {};
    const temp = main.temp ?? main.temp_max ?? main.temp_min ?? 0;
    high = Math.max(high, temp, main.temp_max ?? temp);
    low = Math.min(low, temp, main.temp_min ?? temp);
    maxPop = Math.max(maxPop, entry.pop ?? 0);
  }

  const targetHour = displayPeriod === "night" ? 3 : displayPeriod === "day" ? 14 : 12;
  const representative = pickRepresentativeEntry(scoped, targetHour);
  const weather = representative?.weather?.[0] || {};
  const wind = representative?.wind || {};
  const main = representative?.main || {};
  const displayTemp = displayPeriod === "night"
    ? Math.round(Number.isFinite(low) ? low : main.temp ?? 0)
    : Math.round(Number.isFinite(high) ? high : main.temp ?? 0);

  return {
    high: Math.round(Number.isFinite(high) ? high : main.temp ?? 0),
    low: Math.round(Number.isFinite(low) ? low : main.temp ?? 0),
    temp: displayTemp,
    precipPct: Math.round(maxPop * 100),
    condition: weather.main || weather.description || "Unknown",
    conditionIcon: mapConditionIcon(weather.main, weather.icon, displayPeriod),
    wind: {
      dir: degToCompass(wind.deg),
      speed: Math.round(wind.speed ?? 0),
      unit: "mph",
    },
    description: weather.description || weather.main || "",
    humidity: main.humidity ?? null,
    dateLabel: `${weekdayShortFromIso(dateIso)} ${Number(dateIso.slice(8, 10))}`,
  };
}

function groupForecastEntries(list) {
  const byDate = new Map();
  for (const entry of list) {
    const dateIso = entry.dt_txt?.slice(0, 10);
    if (!dateIso) continue;
    const bucket = byDate.get(dateIso) || [];
    bucket.push(entry);
    byDate.set(dateIso, bucket);
  }
  return byDate;
}

function entriesForNightPeriod(byDate, dateIso) {
  const sameDay = byDate.get(dateIso) || [];
  const nextDateIso = nextDateIsoString(dateIso);
  const nextDayEarly = (byDate.get(nextDateIso) || []).filter((entry) => {
    const hour = Number(entry.dt_txt?.slice(11, 13));
    return hour < 6;
  });
  const sameDayLate = sameDay.filter((entry) => {
    const hour = Number(entry.dt_txt?.slice(11, 13));
    return hour >= 18;
  });
  return [...sameDayLate, ...nextDayEarly];
}

function nextDateIsoString(dateIso) {
  const ms = Date.parse(`${dateIso}T00:00:00Z`) + 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function aggregateDailyFromEntries(byDate, dateIso, timezoneOffsetSec) {
  const entries = byDate.get(dateIso) || [];
  if (!entries.length) return null;

  const all = aggregatePeriodEntries(entries, "all", dateIso);
  const day = aggregatePeriodEntries(entries, "day", dateIso) || all;
  const nightEntries = entriesForNightPeriod(byDate, dateIso);
  const night = (nightEntries.length
    ? aggregatePeriodEntries(nightEntries, "all", dateIso, "night")
    : null) || aggregatePeriodEntries(entries, "night", dateIso, "night") || all;
  if (!all) return null;

  const cityTodayIso = getCityDateIso(timezoneOffsetSec);
  return {
    high: all.high,
    low: all.low,
    precipPct: all.precipPct,
    condition: day.condition,
    conditionIcon: day.conditionIcon,
    wind: day.wind,
    description: day.description,
    humidity: all.humidity,
    label: dayLabelForDate(dateIso, cityTodayIso),
    day,
    night,
  };
}

function buildDailyPeriod(summary, periodLabel) {
  if (!summary) return null;
  return {
    dateLabel: summary.dateLabel,
    periodLabel,
    temp: summary.temp,
    condition: summary.condition,
    conditionIcon: summary.conditionIcon,
    precipPct: summary.precipPct,
    wind: summary.wind,
    description: summary.description,
  };
}

function buildDailyMetrics(summary) {
  const metrics = [];
  if (summary.humidity != null) {
    metrics.push({
      id: "humidity",
      label: "Humidity",
      value: `${summary.humidity}%`,
      icon: "humidity",
    });
  }
  return metrics;
}

function mockDailyForecast(location = {}, horizonDays = FORECAST_DAILY_HORIZON) {
  const todayIso = getCityDateIso(0);
  const days = [];

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const dateMs = Date.parse(`${todayIso}T00:00:00Z`) + offset * 86400000;
    const dateIso = new Date(dateMs).toISOString().slice(0, 10);
    const single = mockForecast(dateIso, location);
    const dayPayload = single.day;
    const dayIconCode = seed % 3 === 0 ? "11d" : seed % 2 === 0 ? "01d" : "03d";
    const nightIconCode = dayIconCode.replace("d", "n");
    const dayCondition = seed % 3 === 0 ? "Thunderstorm" : seed % 2 === 0 ? "Clear" : "Clouds";
    const dayPeriod = {
      dateLabel: `${weekdayShortFromIso(dateIso)} ${Number(dateIso.slice(8, 10))}`,
      temp: dayPayload.high,
      condition: dayCondition,
      conditionIcon: mapConditionIcon(dayCondition, dayIconCode, "day"),
      precipPct: dayPayload.precipPct,
      wind: {
        dir: degToCompass(dayPayload.wind?.direction),
        speed: dayPayload.wind?.speed ?? 0,
        unit: "mph",
      },
      description: dayPayload.day?.description || dayCondition,
    };
    const nightPeriod = {
      ...dayPeriod,
      temp: dayPayload.low,
      conditionIcon: mapConditionIcon(dayCondition, nightIconCode, "night"),
      precipPct: Math.max(0, dayPayload.precipPct - 10),
      wind: {
        ...dayPeriod.wind,
        speed: Math.max(0, dayPeriod.wind.speed - 2),
      },
    };

    days.push({
      id: dateIso,
      label: dayLabelForDate(dateIso, todayIso),
      high: dayPayload.high,
      low: dayPayload.low,
      condition: dayCondition,
      conditionIcon: dayPeriod.conditionIcon,
      precipPct: dayPayload.precipPct,
      wind: dayPeriod.wind,
      day: buildDailyPeriod(dayPeriod, "Day"),
      night: buildDailyPeriod(nightPeriod, "Night"),
      dayMetrics: [],
      nightMetrics: [],
    });
  }

  return {
    location: cityLabel(location),
    asOf: formatAsOfLabel(new Date(), 0),
    days,
    source: "mock",
  };
}

/**
 * @param {{ city?: string, lat?: number|null, lon?: number|null }} location
 * @param {number} [horizonDays]
 */
export async function fetchOpenWeatherDailyForecast(location = {}, horizonDays = FORECAST_DAILY_HORIZON) {
  const { data, location: resolvedLocation, resolved, source } = await fetchOpenWeatherList(location);
  if (!data) {
    return mockDailyForecast(resolvedLocation, horizonDays);
  }

  const list = Array.isArray(data?.list) ? data.list : [];
  const grouped = groupForecastEntries(list);
  const timezoneOffsetSec = Number(data?.city?.timezone) || 0;
  const cityTodayIso = getCityDateIso(timezoneOffsetSec);
  const sortedDates = [...grouped.keys()]
    .sort()
    .filter((dateIso) => dateIso >= cityTodayIso);
  const maxDays = Math.min(horizonDays, OPENWEATHER_MAX_DAILY_DAYS, sortedDates.length);

  const days = sortedDates.slice(0, maxDays).map((dateIso) => {
    const summary = aggregateDailyFromEntries(grouped, dateIso, timezoneOffsetSec);
    if (!summary) return null;

    return {
      id: dateIso,
      label: summary.label,
      high: summary.high,
      low: summary.low,
      condition: summary.condition,
      conditionIcon: summary.conditionIcon,
      precipPct: summary.precipPct,
      wind: summary.wind,
      day: buildDailyPeriod({ ...summary.day, temp: summary.high }, "Day"),
      night: buildDailyPeriod({ ...summary.night, temp: summary.low }, "Night"),
      dayMetrics: buildDailyMetrics(summary.day),
      nightMetrics: buildDailyMetrics(summary.night),
    };
  }).filter(Boolean);

  if (!days.length) {
    throw new Error("No forecast data available");
  }

  return {
    location: data.city?.name || resolved?.label || cityLabel(resolvedLocation),
    asOf: formatAsOfLabel(new Date(), timezoneOffsetSec),
    days,
    source,
    horizonDays: maxDays,
    resolvedLocation: resolved ? { lat: resolved.lat, lon: resolved.lon, label: resolved.label } : null,
  };
}

/**
 * @param {{ city?: string, lat?: number|null, lon?: number|null }} location
 * @param {string} dateIso YYYY-MM-DD
 */
export async function fetchOpenWeatherForecast(dateIso, location = {}) {
  const daily = await fetchOpenWeatherDailyForecast(location, FORECAST_DAILY_HORIZON);
  const dayEntry = daily.days.find((entry) => entry.id === dateIso);
  if (!dayEntry) {
    throw new Error("No forecast data for date");
  }

  return {
    location: daily.location,
    asOf: daily.asOf,
    day: {
      condition: dayEntry.condition,
      conditionIcon: dayEntry.conditionIcon,
      high: dayEntry.high,
      low: dayEntry.low,
      precipPct: dayEntry.precipPct,
      day: {
        description: dayEntry.day?.description || dayEntry.condition,
      },
      wind: {
        speed: dayEntry.wind?.speed ?? 0,
        gust: null,
        direction: dayEntry.wind?.dir ?? null,
        dir: dayEntry.wind?.dir ?? "",
        unit: dayEntry.wind?.unit || "mph",
      },
    },
    source: daily.source,
  };
}

function cityLabel(location = {}) {
  if (location.lat != null && location.lon != null) {
    return `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°`;
  }
  return location.city?.split(",")[0] || DEFAULT_CITY.split(",")[0];
}

function mockLocationSeed(location = {}) {
  const bits = [];
  if (Number.isFinite(location.lat)) bits.push(String(location.lat.toFixed(4)));
  if (Number.isFinite(location.lon)) bits.push(String(location.lon.toFixed(4)));
  if (location.city) bits.push(location.city.toLowerCase().trim());
  const raw = bits.join("|") || DEFAULT_CITY.toLowerCase();
  return raw.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
}

function mockForecast(dateIso, location = {}) {
  const city = location.city?.trim() || DEFAULT_CITY;
  const dateSeed = dateIso.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const locationSeed = mockLocationSeed(location);
  const seed = dateSeed * 31 + locationSeed;
  const high = 55 + (seed % 25);
  const low = high - 8 - (seed % 5);
  return {
    location: cityLabel({ ...location, city }),
    asOf: new Date().toISOString(),
    day: {
      condition: seed % 2 ? "Clear" : "Clouds",
      conditionIcon: seed % 2 ? "01d" : "03d",
      high,
      low,
      precipPct: seed % 30,
      day: { description: seed % 2 ? "Mostly clear" : "Partly cloudy" },
      wind: { speed: 6 + (seed % 8), gust: null, direction: 180 },
    },
    source: "mock",
  };
}

export function weatherCacheKey(location, dateIso) {
  const lat = Number.isFinite(location?.lat) ? location.lat : null;
  const lon = Number.isFinite(location?.lon) ? location.lon : null;
  if (lat != null && lon != null) {
    const cityPart = (location?.city || "").toLowerCase().trim();
    const geo = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const base = cityPart ? `${geo}:${cityPart}` : geo;
    return `${WEATHER_CACHE_VERSION}:date:${base}::${dateIso}`;
  }
  const city = (location?.city || DEFAULT_CITY).toLowerCase().trim();
  return `${WEATHER_CACHE_VERSION}:date:${city}::${dateIso}`;
}

export function weatherDailyCacheKey(location) {
  const cityPart = (location?.city || "").toLowerCase().trim();
  const lat = Number.isFinite(location?.lat) ? location.lat : null;
  const lon = Number.isFinite(location?.lon) ? location.lon : null;
  if (lat != null && lon != null) {
    const geo = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    return cityPart
      ? `${WEATHER_CACHE_VERSION}:daily:geo:${geo}:${cityPart}`
      : `${WEATHER_CACHE_VERSION}:daily:geo:${geo}`;
  }
  if (cityPart) {
    return `${WEATHER_CACHE_VERSION}:daily:${cityPart}`;
  }
  return `${WEATHER_CACHE_VERSION}:daily:${DEFAULT_CITY.toLowerCase()}`;
}

export const WEATHER_CACHE_TTL_MS = 45 * 60 * 1000;
