/**
 * Mock daily forecast data (reference: Kissimmee daily forecast UI).
 * @typedef {{ dir: string, speed: number, unit?: string }} ForecastWind
 * @typedef {{ id: string, label: string, value: string, icon: string, span?: number }} ForecastMetric
 * @typedef {{
 *   dateLabel: string,
 *   periodLabel: string,
 *   temp: number,
 *   condition: string,
 *   conditionIcon: string,
 *   precipPct: number,
 *   wind: ForecastWind,
 *   description: string,
 * }} ForecastPeriod
 * @typedef {{
 *   id: string,
 *   label: string,
 *   high: number,
 *   low: number,
 *   condition: string,
 *   conditionIcon: string,
 *   precipPct: number,
 *   wind: ForecastWind,
 *   day: ForecastPeriod,
 *   night: ForecastPeriod,
 *   dayMetrics: ForecastMetric[],
 *   nightMetrics: ForecastMetric[],
 * }} ForecastDay
 */

import { daysBetween } from "../data.jsx";
import { startOfCalendarDay } from "../temporal.js";

export const FORECAST_MOCK_HORIZON_DAYS = 7;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatAsOf(today) {
  const d = today instanceof Date ? today : new Date(today);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `as of ${h12}:${m} ${ampm} EDT`;
}

function formatDateLabel(today) {
  const d = today instanceof Date ? today : new Date(today);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
}

/**
 * @param {Date} [today]
 * @returns {{ location: string, asOf: string, days: ForecastDay[] }}
 */
export function getForecastMock(today = new Date()) {
  const dateLabel = formatDateLabel(today);

  return {
    location: "Kissimmee, Florida 34741",
    asOf: formatAsOf(today),
    days: [
      {
        id: "today",
        label: "Today",
        high: 87,
        low: 74,
        condition: "Thunderstorms",
        conditionIcon: "thunderstorms",
        precipPct: 72,
        wind: { dir: "SW", speed: 10, unit: "mph" },
        day: {
          dateLabel,
          periodLabel: "Day",
          temp: 87,
          condition: "Thunderstorms",
          conditionIcon: "thunderstorms",
          precipPct: 72,
          wind: { dir: "SW", speed: 10, unit: "mph" },
          description:
            "Thunderstorms likely. High 87F. Winds SW at 5 to 10 mph. Chance of rain 70%. 2 to 3 inches of rain expected.",
        },
        night: {
          dateLabel,
          periodLabel: "Night",
          temp: 74,
          condition: "Scattered Showers Night",
          conditionIcon: "showers-night",
          precipPct: 47,
          wind: { dir: "W", speed: 8, unit: "mph" },
          description:
            "Rain showers this evening with mostly cloudy conditions overnight. Low 74F. Winds W at 5 to 10 mph. Chance of rain 50%.",
        },
        dayMetrics: [
          { id: "humidity", label: "Humidity", value: "74%", icon: "humidity" },
          { id: "uv", label: "UV Index", value: "10 of 11", icon: "uv" },
          { id: "sunrise", label: "Sunrise", value: "6:29 am", icon: "sunrise" },
          { id: "sunset", label: "Sunset", value: "8:16 pm", icon: "sunset" },
        ],
        nightMetrics: [
          { id: "humidity", label: "Humidity", value: "90%", icon: "humidity" },
          { id: "uv", label: "UV Index", value: "0 of 11", icon: "uv" },
          { id: "moonrise", label: "Moonrise", value: "6:11 pm", icon: "moonrise" },
          { id: "moonset", label: "Moonset", value: "4:23 am", icon: "moonset" },
          { id: "moon-phase", label: "Waxing Gibbous", value: "", icon: "moon-phase", span: 2 },
        ],
      },
    ],
  };
}

/**
 * @param {Date} targetDate
 * @param {Date} [baseToday]
 * @returns {{ location: string, asOf: string, day: ForecastDay }|null}
 */
export function getForecastForDate(targetDate, baseToday = new Date()) {
  const base = startOfCalendarDay(baseToday);
  const target = startOfCalendarDay(targetDate);
  if (!base || !target) return null;

  const diff = daysBetween(base, target);
  if (diff < 0 || diff > FORECAST_MOCK_HORIZON_DAYS) return null;

  const mock = getForecastMock(target);
  const day = mock.days[0];
  if (!day) return null;

  return {
    location: mock.location,
    asOf: mock.asOf,
    day: {
      ...day,
      label: diff === 0 ? "Today" : formatDateLabel(target),
    },
  };
}
