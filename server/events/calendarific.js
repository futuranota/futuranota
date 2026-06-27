import { getCalendarificApiKey } from "./env.js";
import { isoToDateOnly, monthsOverlappingRange } from "./normalize.js";
import { readEventCache, writeEventCache } from "./eventCache.js";

const CALENDARIFIC_URL = "https://calendarific.com/api/v2/holidays";

/**
 * @param {unknown} holiday
 * @param {string} country
 * @returns {import("./normalize.js").CalendarEvent|null}
 */
function mapCalendarificHoliday(holiday, country) {
  if (!holiday || typeof holiday !== "object") return null;
  const name = typeof holiday.name === "string" ? holiday.name.trim() : "";
  const iso = typeof holiday.date?.iso === "string" ? holiday.date.iso : "";
  const date = isoToDateOnly(iso);
  if (!name || !date) return null;

  const description = typeof holiday.description === "string"
    ? holiday.description.trim()
    : "";
  const types = Array.isArray(holiday.type) ? holiday.type : [];
  const typeLabel = types[0] || "holiday";
  const uuid = typeof holiday.uuid === "string" ? holiday.uuid : `${date}-${name}`;

  return {
    id: `calendarific:${uuid}`,
    title: name,
    summary: description || typeLabel,
    date,
    dateEnd: null,
    source: "Calendarific",
    type: String(typeLabel).toLowerCase().replace(/\s+/g, "-"),
    rank: 25,
  };
}

/**
 * @param {{ year: number, month: number, country: string }} params
 */
async function fetchCalendarificMonth({ year, month, country }) {
  const apiKey = getCalendarificApiKey();
  if (!apiKey) return [];

  const cacheKey = `calendarific:${country}:${year}-${String(month).padStart(2, "0")}`;
  const cached = readEventCache(cacheKey);
  if (Array.isArray(cached)) return cached;

  const params = new URLSearchParams({
    api_key: apiKey,
    country,
    year: String(year),
    month: String(month),
  });

  const res = await fetch(`${CALENDARIFIC_URL}?${params}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Calendarific ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }

  const payload = await res.json();
  if (payload?.meta?.code !== 200) {
    throw new Error(`Calendarific error: ${payload?.meta?.code ?? "unknown"}`);
  }

  const holidays = Array.isArray(payload?.response?.holidays)
    ? payload.response.holidays
    : [];
  const mapped = holidays.map((h) => mapCalendarificHoliday(h, country)).filter(Boolean);
  writeEventCache(cacheKey, mapped);
  return mapped;
}

/**
 * @param {{ from: string, to: string, country: string }} params
 */
export async function fetchCalendarificEvents({ from, to, country }) {
  const apiKey = getCalendarificApiKey();
  if (!apiKey) return [];

  const months = monthsOverlappingRange(from, to);
  const batches = await Promise.all(
    months.map((m) => fetchCalendarificMonth({ ...m, country })),
  );

  return batches.flat();
}
