import { getPredictHqApiKey } from "./env.js";
import { isoToDateOnly } from "./normalize.js";

const PREDICTHQ_URL = "https://api.predicthq.com/v1/events/";

/** Marketing-relevant categories (excludes severe weather / disasters by default). */
const DEFAULT_CATEGORIES = [
  "conferences",
  "expos",
  "festivals",
  "concerts",
  "performing-arts",
  "community",
  "sports",
  "public-holidays",
  "observances",
].join(",");

/**
 * @param {Record<string, unknown>} event
 * @returns {import("./normalize.js").CalendarEvent|null}
 */
function mapPredictHqEvent(event) {
  if (!event || typeof event !== "object") return null;
  const id = typeof event.id === "string" ? event.id : "";
  const title = typeof event.title === "string" ? event.title.trim() : "";
  const start = isoToDateOnly(
    typeof event.start_local === "string" ? event.start_local : event.start,
  );
  if (!id || !title || !start) return null;

  const end = isoToDateOnly(
    typeof event.end_local === "string" ? event.end_local : event.end,
  );
  const category = typeof event.category === "string" ? event.category : "event";
  const description = typeof event.description === "string"
    ? event.description.trim()
    : "";
  const rank = typeof event.rank === "number" ? event.rank : undefined;

  return {
    id: `predicthq:${id}`,
    title,
    summary: description || category.replace(/-/g, " "),
    date: start,
    dateEnd: end && end !== start ? end : null,
    source: "PredictHQ",
    type: category,
    rank,
  };
}

/**
 * @param {{ from: string, to: string, country: string, limit?: number }} params
 * @returns {Promise<import("./normalize.js").CalendarEvent[]>}
 */
export async function fetchPredictHqEvents({
  from,
  to,
  country,
  limit = 20,
}) {
  const apiKey = getPredictHqApiKey();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    "active.gte": from,
    "active.lte": to,
    country,
    category: DEFAULT_CATEGORIES,
    "brand_unsafe.exclude": "true",
    "rank.gte": "30",
    sort: "-rank,start",
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });

  const res = await fetch(`${PREDICTHQ_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PredictHQ ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }

  const payload = await res.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map(mapPredictHqEvent).filter(Boolean);
}
