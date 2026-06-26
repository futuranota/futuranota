const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast";
const DEFAULT_CITY = "New York,US";

/**
 * @param {string} dateIso YYYY-MM-DD
 * @param {string} [city]
 */
export async function fetchOpenWeatherForecast(dateIso, city = DEFAULT_CITY) {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return mockForecast(dateIso, city);
  }

  const res = await fetch(
    `${OPENWEATHER_URL}?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenWeather ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const list = Array.isArray(data?.list) ? data.list : [];
  const target = list.find((entry) => {
    const dt = entry.dt_txt?.slice(0, 10);
    return dt === dateIso;
  }) || list[0];

  if (!target) {
    throw new Error("No forecast data for date");
  }

  const main = target.main || {};
  const weather = target.weather?.[0] || {};
  const wind = target.wind || {};

  return {
    location: data.city?.name || city,
    asOf: new Date().toISOString(),
    day: {
      condition: weather.main || weather.description || "Unknown",
      conditionIcon: weather.icon || null,
      high: Math.round(main.temp_max ?? main.temp ?? 0),
      low: Math.round(main.temp_min ?? main.temp ?? 0),
      precipPct: Math.round((target.pop ?? 0) * 100),
      day: {
        description: weather.description || weather.main || "",
      },
      wind: {
        speed: wind.speed ?? 0,
        gust: wind.gust ?? null,
        direction: wind.deg ?? null,
      },
    },
    source: "openweather",
  };
}

function mockForecast(dateIso, city) {
  const seed = dateIso.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const high = 55 + (seed % 25);
  const low = high - 8 - (seed % 5);
  return {
    location: city.split(",")[0],
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

export function weatherCacheKey(city, dateIso) {
  return `${city.toLowerCase().trim()}::${dateIso}`;
}

export const WEATHER_CACHE_TTL_MS = 45 * 60 * 1000;
