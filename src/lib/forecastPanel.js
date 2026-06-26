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
 */
export async function fetchDailyForecastPanel(weatherLocation) {
  const normalized = normalizeWeatherLocation(weatherLocation);
  const locationQuery = buildWeatherLocationQuery(normalized);
  const locationKey = getWeatherLocationKey(normalized);

  if (!locationQuery || !locationKey) {
    throw new Error("location_required");
  }

  const queryParts = ["mode=daily", locationQuery, `_k=${encodeURIComponent(locationKey)}`];

  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

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
