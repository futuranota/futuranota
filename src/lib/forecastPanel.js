import { API_ROUTES } from "../api/routes.js";
import { supabase } from "./supabaseClient.js";
import {
  buildWeatherLocationQuery,
  getWeatherLocationKey,
  normalizeWeatherLocation,
} from "./weatherLocation.js";
import { WEATHER_ERROR_LOCATION_NOT_FOUND, WEATHER_ERROR_NOT_CONFIGURED } from "./weatherErrors.js";

/**
 * @param {import("./weatherLocation.js").WeatherLocation} weatherLocation
 * @param {{ fresh?: boolean }} [opts]
 */
export async function fetchDailyForecastPanel(weatherLocation, opts = {}) {
  const normalized = normalizeWeatherLocation(weatherLocation);
  const locationQuery = buildWeatherLocationQuery(normalized);
  const locationKey = getWeatherLocationKey(normalized);

  if (!locationQuery || !locationKey) {
    throw new Error("location_required");
  }

  const queryParts = ["mode=daily", locationQuery, `_k=${encodeURIComponent(locationKey)}`];
  if (opts.fresh) queryParts.push("fresh=1");

  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(opts.cityApply ? { "X-Futura-City-Apply": "1" } : {}),
  };

  const res = await fetch(`${API_ROUTES.weatherForecast}?${queryParts.join("&")}`, {
    headers,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.error === WEATHER_ERROR_LOCATION_NOT_FOUND) {
      throw new Error(WEATHER_ERROR_LOCATION_NOT_FOUND);
    }
    if (body.error === WEATHER_ERROR_NOT_CONFIGURED) {
      throw new Error(WEATHER_ERROR_NOT_CONFIGURED);
    }
    throw new Error(body.error || `Forecast request failed (${res.status})`);
  }

  return body;
}
