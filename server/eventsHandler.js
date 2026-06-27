import { fetchMergedCalendarEvents } from "./events/fetchEvents.js";
import { getDefaultEventCountry } from "./events/env.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * @param {{ method?: string, url?: string }} reqLike
 */
export async function processEventsRequest(reqLike) {
  const url = new URL(reqLike.url || "/api/events", "http://localhost");
  const from = url.searchParams.get("from")?.trim() || "";
  const to = url.searchParams.get("to")?.trim() || "";
  const country = url.searchParams.get("country")?.trim() || getDefaultEventCountry();
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, 50)
    : 24;

  if (!isIsoDate(from) || !isIsoDate(to)) {
    return {
      status: 400,
      body: { error: "from and to query params required (YYYY-MM-DD)" },
    };
  }

  if (from > to) {
    return {
      status: 400,
      body: { error: "from must be on or before to" },
    };
  }

  const result = await fetchMergedCalendarEvents({ from, to, country, limit });
  return { status: 200, body: result };
}

export async function handleEvents(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return true;
  }

  if (req.url?.split("?")[0] !== "/api/events") return false;
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  try {
    const result = await processEventsRequest({
      method: req.method,
      url: req.url,
    });
    sendJson(res, result.status, result.body);
    return true;
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "Event calendar fetch failed",
    });
    return true;
  }
}

export function createEventsMiddleware() {
  return async (req, res, next) => {
    const handled = await handleEvents(req, res);
    if (!handled) next();
  };
}
