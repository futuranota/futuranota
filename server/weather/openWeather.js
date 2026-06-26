const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast";
const OPENWEATHER_GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
export const DEFAULT_CITY = "New York,US";
export const FORECAST_DAILY_HORIZON = 7;
export const WEATHER_ERROR_LOCATION_NOT_FOUND = "location_not_found";

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
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return { data: null, location, source: "mock", resolved: null };
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

function mapConditionIcon(weatherMain) {
  const value = (weatherMain || "").toLowerCase();
  if (value.includes("thunder")) return "thunderstorms";
  return "showers-night";
}

function formatAsOfLabel(date = new Date()) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `as of ${h12}:${m} ${ampm}`;
}

function weekdayShort(date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function dayLabelForOffset(offset, date) {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return weekdayShort(date);
}

function aggregateDailyEntries(entries, dateIso) {
  let high = -Infinity;
  let low = Infinity;
  let maxPop = 0;
  let noonEntry = entries[0];
  let noonDistance = Infinity;

  for (const entry of entries) {
    const main = entry.main || {};
    const temp = main.temp ?? main.temp_max ?? main.temp_min ?? 0;
    high = Math.max(high, main.temp_max ?? temp);
    low = Math.min(low, main.temp_min ?? temp);
    maxPop = Math.max(maxPop, entry.pop ?? 0);

    const hour = Number(entry.dt_txt?.slice(11, 13));
    const distance = Math.abs(hour - 12);
    if (distance < noonDistance) {
      noonDistance = distance;
      noonEntry = entry;
    }
  }

  const weather = noonEntry?.weather?.[0] || {};
  const wind = noonEntry?.wind || {};
  const main = noonEntry?.main || {};
  const date = new Date(`${dateIso}T12:00:00`);

  return {
    high: Math.round(Number.isFinite(high) ? high : main.temp ?? 0),
    low: Math.round(Number.isFinite(low) ? low : main.temp ?? 0),
    precipPct: Math.round(maxPop * 100),
    condition: weather.main || weather.description || "Unknown",
    conditionIcon: mapConditionIcon(weather.main),
    wind: {
      dir: degToCompass(wind.deg),
      speed: Math.round(wind.speed ?? 0),
      unit: "mph",
    },
    description: weather.description || weather.main || "",
    humidity: main.humidity ?? null,
    dateLabel: `${weekdayShort(date)} ${date.getDate()}`,
    date,
  };
}

function buildDailyPeriod(summary, periodLabel, temp) {
  return {
    dateLabel: summary.dateLabel,
    periodLabel,
    temp,
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
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = [];

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const dateIso = date.toISOString().slice(0, 10);
    const single = mockForecast(dateIso, location);
    const day = single.day;
    days.push({
      id: dateIso,
      label: dayLabelForOffset(offset, date),
      high: day.high,
      low: day.low,
      condition: day.condition,
      conditionIcon: mapConditionIcon(day.condition),
      precipPct: day.precipPct,
      wind: {
        dir: degToCompass(day.wind?.direction),
        speed: day.wind?.speed ?? 0,
        unit: "mph",
      },
      day: buildDailyPeriod(
        {
          dateLabel: `${weekdayShort(date)} ${date.getDate()}`,
          condition: day.condition,
          conditionIcon: mapConditionIcon(day.condition),
          precipPct: day.precipPct,
          wind: {
            dir: degToCompass(day.wind?.direction),
            speed: day.wind?.speed ?? 0,
            unit: "mph",
          },
          description: day.day?.description || day.condition,
        },
        "Day",
        day.high,
      ),
      night: buildDailyPeriod(
        {
          dateLabel: `${weekdayShort(date)} ${date.getDate()}`,
          condition: day.condition,
          conditionIcon: mapConditionIcon(day.condition),
          precipPct: Math.max(0, day.precipPct - 10),
          wind: {
            dir: degToCompass(day.wind?.direction),
            speed: Math.max(0, (day.wind?.speed ?? 0) - 2),
            unit: "mph",
          },
          description: day.day?.description || day.condition,
        },
        "Night",
        day.low,
      ),
      dayMetrics: [],
      nightMetrics: [],
    });
  }

  return {
    location: cityLabel(location),
    asOf: formatAsOfLabel(new Date()),
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
  const grouped = new Map();
  for (const entry of list) {
    const dateIso = entry.dt_txt?.slice(0, 10);
    if (!dateIso) continue;
    const bucket = grouped.get(dateIso) || [];
    bucket.push(entry);
    grouped.set(dateIso, bucket);
  }

  const sortedDates = [...grouped.keys()].sort();
  const days = sortedDates.slice(0, horizonDays).map((dateIso, index) => {
    const summary = aggregateDailyEntries(grouped.get(dateIso), dateIso);
    return {
      id: dateIso,
      label: dayLabelForOffset(index, summary.date),
      high: summary.high,
      low: summary.low,
      condition: summary.condition,
      conditionIcon: summary.conditionIcon,
      precipPct: summary.precipPct,
      wind: summary.wind,
      day: buildDailyPeriod(summary, "Day", summary.high),
      night: buildDailyPeriod(summary, "Night", summary.low),
      dayMetrics: buildDailyMetrics(summary),
      nightMetrics: buildDailyMetrics(summary),
    };
  });

  if (!days.length) {
    throw new Error("No forecast data available");
  }

  return {
    location: data.city?.name || resolved?.label || cityLabel(resolvedLocation),
    asOf: formatAsOfLabel(new Date()),
    days,
    source,
    resolvedLocation: resolved ? { lat: resolved.lat, lon: resolved.lon, label: resolved.label } : null,
  };
}

/**
 * @param {{ city?: string, lat?: number|null, lon?: number|null }} location
 * @param {string} dateIso YYYY-MM-DD
 */
export async function fetchOpenWeatherForecast(dateIso, location = {}) {
  const daily = await fetchOpenWeatherDailyForecast(location, FORECAST_DAILY_HORIZON);
  const dayEntry = daily.days.find((entry) => entry.id === dateIso) || daily.days[0];
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

function mockForecast(dateIso, location = {}) {
  const city = location.city?.trim() || DEFAULT_CITY;
  const seed = dateIso.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
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
    return `geo:${lat.toFixed(3)},${lon.toFixed(3)}::${dateIso}`;
  }
  const city = (location?.city || DEFAULT_CITY).toLowerCase().trim();
  return `${city}::${dateIso}`;
}

export function weatherDailyCacheKey(location) {
  const lat = Number.isFinite(location?.lat) ? location.lat : null;
  const lon = Number.isFinite(location?.lon) ? location.lon : null;
  if (lat != null && lon != null) {
    return `daily:geo:${lat.toFixed(3)},${lon.toFixed(3)}`;
  }
  const city = (location?.city || DEFAULT_CITY).toLowerCase().trim();
  return `daily:${city}`;
}

export const WEATHER_CACHE_TTL_MS = 45 * 60 * 1000;
