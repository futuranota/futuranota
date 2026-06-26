import { getAuthedUser } from "./supabaseServer.js";
import {
  fetchOpenWeatherForecast,
  weatherCacheKey,
  WEATHER_CACHE_TTL_MS,
} from "./weather/openWeather.js";

const DEFAULT_CITY = process.env.WEATHER_DEFAULT_CITY?.trim() || "New York,US";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

/**
 * @param {{ method?: string, url?: string, headers?: Record<string, string|string[]|undefined> }} reqLike
 */
export async function processWeatherForecastRequest(reqLike) {
  const url = new URL(reqLike.url || "", "http://localhost");
  const date = url.searchParams.get("date")?.trim() || "";
  const city = url.searchParams.get("city")?.trim() || DEFAULT_CITY;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: "date query param required (YYYY-MM-DD)" } };
  }

  const cacheKey = weatherCacheKey(city, date);

  const { user, supabase, token } = await getAuthedUser({ headers: reqLike.headers || {} });

  if (supabase && token) {
    const { data: cached } = await supabase
      .from("weather_cache")
      .select("payload, fetched_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached?.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < WEATHER_CACHE_TTL_MS) {
        return { status: 200, body: { ...cached.payload, fromCache: true } };
      }
    }
  }

  const forecast = await fetchOpenWeatherForecast(date, city);
  const payload = { ...forecast, targetDate: date, fromCache: false };

  if (supabase) {
    await supabase.from("weather_cache").upsert({
      cache_key: cacheKey,
      payload,
      fetched_at: new Date().toISOString(),
    });
  }

  return { status: 200, body: payload };
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
