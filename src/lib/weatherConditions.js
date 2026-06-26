/** Map OpenWeather `weather.main` + icon code (01d, 10n, …) to panel icon keys. */

const ICON_CODE_MAP = {
  "01d": "clear-day",
  "01n": "clear-night",
  "02d": "partly-cloudy-day",
  "02n": "partly-cloudy-night",
  "03d": "cloudy",
  "03n": "cloudy-night",
  "04d": "overcast",
  "04n": "overcast",
  "09d": "showers",
  "09n": "showers-night",
  "10d": "rain",
  "10n": "rain-night",
  "11d": "thunderstorms",
  "11n": "thunderstorms",
  "13d": "snow",
  "13n": "snow",
  "50d": "fog",
  "50n": "fog",
};

/**
 * @param {string} [weatherMain]
 * @param {string} [iconCode]
 * @param {"day"|"night"|"all"} [period]
 */
export function mapConditionIcon(weatherMain = "", iconCode = "", period = "day") {
  const code = String(iconCode || "").toLowerCase().trim();
  if (code && ICON_CODE_MAP[code]) {
    return ICON_CODE_MAP[code];
  }

  const value = String(weatherMain || "").toLowerCase().trim();
  const isNight = period === "night" || code.endsWith("n");

  if (value.includes("thunder")) return "thunderstorms";
  if (value.includes("drizzle")) return isNight ? "showers-night" : "showers";
  if (value.includes("rain")) return isNight ? "rain-night" : "rain";
  if (value.includes("snow")) return "snow";
  if (
    value.includes("mist")
    || value.includes("fog")
    || value.includes("haze")
    || value.includes("smoke")
    || value.includes("dust")
    || value.includes("sand")
    || value.includes("ash")
  ) {
    return "fog";
  }
  if (value === "clear") return isNight ? "clear-night" : "clear-day";
  if (value.includes("cloud")) {
    return isNight ? "cloudy-night" : "cloudy";
  }

  return isNight ? "cloudy-night" : "cloudy";
}

/** @param {string} [iconKey] */
export function normalizeConditionIconKey(iconKey) {
  const key = String(iconKey || "").toLowerCase().trim();
  if (!key) return "cloudy";
  if (ICON_CODE_MAP[key]) return ICON_CODE_MAP[key];
  if (key === "showers-night" || key === "thunderstorms") return key;
  if (key.includes("thunder")) return "thunderstorms";
  if (key.includes("01d")) return "clear-day";
  if (key.includes("01n")) return "clear-night";
  if (key.includes("11")) return "thunderstorms";
  if (key.includes("13")) return "snow";
  if (key.includes("09") || key.includes("10")) return key.endsWith("n") ? "showers-night" : "rain";
  if (key.includes("50")) return "fog";
  if (key.includes("02")) return key.endsWith("n") ? "partly-cloudy-night" : "partly-cloudy-day";
  if (key.includes("03") || key.includes("04")) return key.endsWith("n") ? "cloudy-night" : "cloudy";
  return key;
}
