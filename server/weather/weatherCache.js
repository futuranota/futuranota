import { createServiceSupabase } from "../supabaseServer.js";
import { WEATHER_CACHE_TTL_MS } from "./openWeather.js";

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
function getCacheClient() {
  return createServiceSupabase();
}

/**
 * @param {string} cacheKey
 */
export async function readWeatherCache(cacheKey) {
  const supabase = getCacheClient();
  if (!supabase) return null;

  const { data: cached, error } = await supabase
    .from("weather_cache")
    .select("payload, fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !cached?.fetched_at) return null;

  const age = Date.now() - new Date(cached.fetched_at).getTime();
  if (age >= WEATHER_CACHE_TTL_MS) return null;

  if (cached.payload?.source === "mock") return null;

  return { ...cached.payload, fromCache: true };
}

/**
 * @param {string} cacheKey
 * @param {Record<string, unknown>} payload
 */
export async function writeWeatherCache(cacheKey, payload) {
  const supabase = getCacheClient();
  if (!supabase) return;
  if (payload?.source === "mock") return;

  await supabase.from("weather_cache").upsert({
    cache_key: cacheKey,
    payload,
    fetched_at: new Date().toISOString(),
  });
}

/** @returns {boolean} */
export function isWeatherCacheConfigured() {
  return Boolean(getCacheClient());
}
