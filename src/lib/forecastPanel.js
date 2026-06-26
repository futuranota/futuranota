import { API_ROUTES } from "../api/routes.js";
import { supabase } from "./supabaseClient.js";
import { buildWeatherLocationQuery } from "./weatherLocation.js";
import { WEATHER_ERROR_LOCATION_NOT_FOUND } from "./weatherErrors.js";

/**
 * @param {import("./weatherLocation.js").WeatherLocation} [weatherLocation]
 */
export async function fetchDailyForecastPanel(weatherLocation) {
  const locationQuery = weatherLocation ? buildWeatherLocationQuery(weatherLocation) : "";
  const queryParts = ["mode=daily"];
  if (locationQuery) queryParts.push(locationQuery);

  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const res = await fetch(`${API_ROUTES.weatherForecast}?${queryParts.join("&")}`, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.error === WEATHER_ERROR_LOCATION_NOT_FOUND) {
      throw new Error(WEATHER_ERROR_LOCATION_NOT_FOUND);
    }
    throw new Error(body.error || `Forecast request failed (${res.status})`);
  }

  return body;
}
