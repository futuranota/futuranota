import { getOpenWeatherApiKey } from "./weather/env.js";
import {
  DEFAULT_CITY,
  fetchOpenWeatherDailyForecast,
  resolveForecastLocation,
  sliceDailyForecastForDate,
  WEATHER_ERROR_LOCATION_NOT_FOUND,
  WEATHER_ERROR_NOT_CONFIGURED,
  WeatherLocationNotFoundError,
  weatherDailyCacheKey,
} from "./weather/openWeather.js";
import { readWeatherCache, writeWeatherCache } from "./weather/weatherCache.js";
import { getAuthedUser, loadUserProfile } from "./supabaseServer.js";
import {
  checkServerCityChangeLimit,
  recordServerCityChange,
  WEATHER_ERROR_LOCATION_RATE_LIMITED,
} from "./weather/locationRateLimit.js";

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

function readCityApplyHeader(reqLike) {
  const raw = reqLike.headers?.["x-futura-city-apply"]
    || reqLike.headers?.["X-Futura-City-Apply"];
  return raw === "1" || raw === 1;
}

function clientIp(reqLike) {
  const forwarded = reqLike.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return "anon";
}

/**
 * @param {import('http').IncomingMessage} reqLike
 */
async function enforceCityApplyRateLimit(reqLike) {
  if (!readCityApplyHeader(reqLike)) return null;

  const { user, supabase } = await getAuthedUser(reqLike);
  const subject = user?.id || clientIp(reqLike);
  let plan = "free";

  if (user && supabase) {
    try {
      const profile = await loadUserProfile(supabase, user.id);
      plan = profile?.plan === "pro" ? "pro" : "free";
    } catch {
      plan = "free";
    }
  }

  const check = checkServerCityChangeLimit(subject, plan);
  if (!check.ok) {
    return {
      status: 429,
      body: {
        error: WEATHER_ERROR_LOCATION_RATE_LIMITED,
        used: check.used,
        cap: check.cap,
      },
    };
  }

  recordServerCityChange(subject);
  return null;
}

/**
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function processWeatherDailyRequest(reqLike) {
  const rateLimited = await enforceCityApplyRateLimit(reqLike);
  if (rateLimited) return rateLimited;

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
  const fresh = url.searchParams.get("fresh") === "1";

  const cached = fresh ? null : await readWeatherCache(cacheKey);
  if (cached) {
    return { status: 200, body: cached };
  }

  try {
    const forecast = await fetchOpenWeatherDailyForecast(urlLocation);
    const payload = { ...forecast, fromCache: false };
    await writeWeatherCache(cacheKey, payload);
    return { status: 200, body: payload };
  } catch (err) {
    return weatherErrorResponse(err);
  }
}

/**
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function processWeatherDateRequest(reqLike) {
  const url = new URL(reqLike.url || "", "http://localhost");
  const date = url.searchParams.get("date")?.trim() || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: "date query param required (YYYY-MM-DD)" } };
  }

  const urlLocation = parseWeatherLocationFromUrl(url, { allowFallback: false });
  if (!urlLocation) {
    return { status: 400, body: { error: "location_required" } };
  }

  const location = await normalizeWeatherLocationForCache(urlLocation);
  const dailyCacheKey = weatherDailyCacheKey({
    ...location,
    city: urlLocation.city || location.city,
  });

  let dailyPayload = await readWeatherCache(dailyCacheKey);
  let fromCache = true;

  if (!dailyPayload) {
    try {
      dailyPayload = await fetchOpenWeatherDailyForecast(urlLocation);
      fromCache = false;
      await writeWeatherCache(dailyCacheKey, { ...dailyPayload, fromCache: false });
    } catch (err) {
      return weatherErrorResponse(err);
    }
  }

  try {
    const forecast = sliceDailyForecastForDate(dailyPayload, date);
    return {
      status: 200,
      body: {
        ...forecast,
        fromCache: fromCache || Boolean(dailyPayload.fromCache),
      },
    };
  } catch {
    return { status: 404, body: { error: "no_forecast_for_date" } };
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
  if (date) {
    return processWeatherDateRequest(reqLike);
  }

  return { status: 400, body: { error: "date query param required (YYYY-MM-DD) or mode=daily" } };
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
