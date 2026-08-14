/**
 * Day-reading intro for “qué hay en agenda para hoy”:
 * greeting + mm/dd/yyyy + live condition + Forecast home city.
 * Does not insert the Forecast widget.
 */

import { fetchDailyForecastPanel } from "../forecastPanel.js";
import {
  hasWeatherLocation,
  normalizeWeatherLocation,
} from "../weatherLocation.js";
import { useWeatherLocationStore } from "../../stores/weatherLocationStore.js";

/**
 * @param {Date} [now]
 * @param {string} [locale]
 */
export function ginaDayPartGreeting(now = new Date(), locale = "es") {
  const hour = now instanceof Date && !Number.isNaN(now.getTime())
    ? now.getHours()
    : new Date().getHours();
  const en = locale === "en";
  if (hour >= 5 && hour < 12) return en ? "Good morning" : "Buenos días";
  if (hour >= 12 && hour < 19) return en ? "Good afternoon" : "Buenas tardes";
  return en ? "Good evening" : "Buenas noches";
}

/**
 * @param {Date} [now]
 * @returns {string} mm/dd/yyyy
 */
export function formatGinaMdY(now = new Date()) {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * OpenWeather `main` / condition → informal sky phrase.
 * @param {string} [condition]
 * @param {string} [locale]
 * @returns {string | null}
 */
export function ginaWeatherConditionPhrase(condition, locale = "es") {
  const raw = String(condition || "").trim().toLowerCase();
  if (!raw) return null;
  const en = locale === "en";
  if (raw.includes("thunder")) return en ? "stormy" : "con tormentas";
  if (raw.includes("drizzle") || raw.includes("rain")) return en ? "rainy" : "lluvioso";
  if (raw.includes("snow")) return en ? "snowy" : "con nieve";
  if (
    raw.includes("mist")
    || raw.includes("fog")
    || raw.includes("haze")
    || raw.includes("smoke")
  ) return en ? "foggy" : "con niebla";
  if (raw.includes("cloud")) return en ? "cloudy" : "nublado";
  if (raw.includes("clear")) return en ? "sunny" : "soleado";
  return null;
}

/**
 * @param {{
 *   locale?: string,
 *   now?: Date,
 *   city?: string | null,
 *   condition?: string | null,
 * }} [opts]
 */
export function buildGinaDayWeatherIntro(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const now = opts.now instanceof Date ? opts.now : new Date();
  const greet = ginaDayPartGreeting(now, locale);
  const date = formatGinaMdY(now);
  const city = String(opts.city || "").trim();
  const sky = ginaWeatherConditionPhrase(opts.condition, locale);
  const en = locale === "en";

  if (en) {
    if (sky && city) return `${greet}, today is ${date}. The day is ${sky} in ${city}.`;
    if (city) return `${greet}, today is ${date} in ${city}.`;
    return `${greet}, today is ${date}.`;
  }
  if (sky && city) return `${greet}, hoy es ${date}. El día está ${sky} en ${city}.`;
  if (city) return `${greet}, hoy es ${date} en ${city}.`;
  return `${greet}, hoy es ${date}.`;
}

/**
 * No home city yet — ask once, do not invent weather.
 * @param {{ locale?: string, now?: Date }} [opts]
 */
export function buildGinaDayWeatherNeedCityIntro(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const now = opts.now instanceof Date ? opts.now : new Date();
  const greet = ginaDayPartGreeting(now, locale);
  const date = formatGinaMdY(now);
  if (locale === "en") {
    return `${greet}, today is ${date}. Tell me which city you’re in so I can read the weather — I’ll save it and won’t ask again.`;
  }
  return `${greet}, hoy es ${date}. Dime en qué ciudad estás para leer el tiempo — la guardo y no te lo vuelvo a pedir.`;
}

function todayIsoFromNow(now) {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Live snapshot from Forecast city + daily API (cached). Never invents a city.
 * @param {{ locale?: string, now?: Date }} [opts]
 * @returns {Promise<string>}
 */
export async function resolveGinaDayWeatherIntro(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const now = opts.now instanceof Date ? opts.now : new Date();
  const loc = normalizeWeatherLocation(useWeatherLocationStore.getState());
  if (!hasWeatherLocation(loc)) {
    return buildGinaDayWeatherNeedCityIntro({ locale, now });
  }
  const fallbackCity = String(loc.label || loc.city || "").trim();
  try {
    const data = await fetchDailyForecastPanel(loc);
    const iso = todayIsoFromNow(now);
    const days = Array.isArray(data?.days) ? data.days : [];
    const day = days.find((row) => row?.id === iso) || days[0] || null;
    const city = String(data?.location || fallbackCity).trim();
    return buildGinaDayWeatherIntro({
      locale,
      now,
      city,
      condition: day?.condition || day?.day?.description || null,
    });
  } catch {
    return buildGinaDayWeatherIntro({
      locale,
      now,
      city: fallbackCity,
      condition: null,
    });
  }
}
