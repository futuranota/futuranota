/** Shared OpenWeather env access for server middleware and Vercel functions. */
export function getOpenWeatherApiKey() {
  return process.env.OPENWEATHER_API_KEY?.trim() || "";
}

export function isWeatherMockAllowed() {
  return process.env.WEATHER_ALLOW_MOCK === "1";
}
