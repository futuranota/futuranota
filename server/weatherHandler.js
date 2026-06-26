import { getAuthedUser } from "./supabaseServer.js";
import { getOpenWeatherApiKey } from "./weather/env.js";
import {
  DEFAULT_CITY,
  fetchOpenWeatherDailyForecast,
  fetchOpenWeatherForecast,
  resolveForecastLocation,
  WEATHER_ERROR_LOCATION_NOT_FOUND,
  WEATHER_ERROR_NOT_CONFIGURED,
  WeatherLocationNotFoundError,
  weatherCacheKey,
  weatherDailyCacheKey,
  WEATHER_CACHE_TTL_MS,
} from "./weather/openWeather.js";

const FALLBACK_CITY = process.env.WEATHER_DEFAULT_CITY?.trim() || DEFAULT_CITY;

function parseWeatherLocationFromUrl(url, { allowFallback = false } = {}) {
  const cityParam = url.searchParams.get("city")?.trim() || "";
  const latParam = url.searchParams.get("lat");
  const lonParam = url.searchParams.get("lon");
  const lat = latParam != null && latParam !== "" ? Number(latParam) : null;
  const lon = lonParam != null && lonParam !== "" ? Number(lonParam) : null;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);

  if (hasCoords) return { lat, lon };
  if (cityParam) return { city: cityParam };
  if (allowFallback) return { city: FALLBACK_CITY };
  return null;
}

function resolveWeatherLocation(url) {
  return parseWeatherLocationFromUrl(url, { allowFallback: true });
}

async function readWeatherCache(supabase, token, cacheKey) {
  if (!supabase || !token) return null;

  const { data: cached } = await supabase
    .from("weather_cache")
    .select("payload, fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (!cached?.fetched_at) return null;

  const age = Date.now() - new Date(cached.fetched_at).getTime();
  if (age >= WEATHER_CACHE_TTL_MS) return null;

  if (cached.payload?.source === "mock") return null;

  return { ...cached.payload, fromCache: true };
}

async function writeWeatherCache(supabase, cacheKey, payload) {
  if (!supabase) return;
  if (payload?.source === "mock") return;

  await supabase.from("weather_cache").upsert({
    cache_key: cacheKey,
    payload,
    fetched_at: new Date().toISOString(),
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

function weatherErrorResponse(err) {
  if (err instanceof WeatherLocationNotFoundError) {
    return {
      status: 422,
      body: { error: WEATHER_ERROR_LOCATION_NOT_FOUND },
    };
  }
  if (err?.code === WEATHER_ERROR_NOT_CONFIGURED || err?.message === WEATHER_ERROR_NOT_CONFIGURED) {
    return {
      status: 503,
      body: { error: WEATHER_ERROR_NOT_CONFIGURED },
    };
  }
  throw err;
}

async function normalizeWeatherLocationForCache(location) {
  const apiKey = getOpenWeatherApiKey();
  if (!apiKey || (Number.isFinite(location.lat) && Number.isFinite(location.lon))) {
    return location;
  }

  try {
    const resolved = await resolveForecastLocation(location, apiKey);
    return {
      lat: resolved.lat,
      lon: resolved.lon,
      label: resolved.label,
      city: location.city,
    };
  } catch {
    return location;
  }
}

/**
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function processWeatherDailyRequest(reqLike) {
  const url = new URL(reqLike.url || "", "http://localhost");
  const urlLocation = parseWeatherLocationFromUrl(url, { allowFallback: false });
  if (!urlLocation) {
    return { status: 400, body: { error: "location_required" } };
  }

  const location = await normalizeWeatherLocationForCache(urlLocation);
  const cacheKey = weatherDailyCacheKey({
    ...location,
    city: urlLocation.city || location.city,
  });
  const { supabase, token } = await getAuthedUser({ headers: reqLike.headers || {} });

  const cached = await readWeatherCache(supabase, token, cacheKey);
  if (cached) {
    return { status: 200, body: cached };
  }

  try {
    const forecast = await fetchOpenWeatherDailyForecast(urlLocation);
    const payload = { ...forecast, fromCache: false };
    await writeWeatherCache(supabase, cacheKey, payload);
    return { status: 200, body: payload };
  } catch (err) {
    return weatherErrorResponse(err);
  }
}

/**
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function processWeatherForecastRequest(reqLike) {
  const url = new URL(reqLike.url || "", "http://localhost");
  const mode = url.searchParams.get("mode")?.trim() || "";

  if (mode === "daily") {
    return processWeatherDailyRequest(reqLike);
  }

  const date = url.searchParams.get("date")?.trim() || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: "date query param required (YYYY-MM-DD)" } };
  }

  const urlLocation = parseWeatherLocationFromUrl(url, { allowFallback: false });
  if (!urlLocation) {
    return { status: 400, body: { error: "location_required" } };
  }

  const location = await normalizeWeatherLocationForCache(urlLocation);
  const cacheKey = weatherCacheKey(
    { ...location, city: urlLocation.city || location.city },
    date,
  );
  const { supabase, token } = await getAuthedUser({ headers: reqLike.headers || {} });

  const cached = await readWeatherCache(supabase, token, cacheKey);
  if (cached) {
    return { status: 200, body: cached };
  }

  try {
    const forecast = await fetchOpenWeatherForecast(date, urlLocation);
    const payload = { ...forecast, targetDate: date, fromCache: false };
    await writeWeatherCache(supabase, cacheKey, payload);
    return { status: 200, body: payload };
  } catch (err) {
    return weatherErrorResponse(err);
  }
}

export async function handleWeatherForecast(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  if (req.url?.split("?")[0] !== "/api/weather/forecast") return false;
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  try {
    const result = await processWeatherForecastRequest({
      method: req.method,
      url: req.url,
      headers: req.headers,
    });
    sendJson(res, result.status, result.body);
    return true;
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Weather fetch failed" });
    return true;
  }
}

export function createWeatherForecastMiddleware() {
  return async (req, res, next) => {
    const handled = await handleWeatherForecast(req, res);
    if (!handled) next();
  };
}
