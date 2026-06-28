import { tavily } from "@tavily/core";

const TAVILY_URL = "https://api.tavily.com/search";

/**
 * @typedef {import("./serpApiSearch.js").SearchHit} SearchHit
 */

/** @type {import("@tavily/core").TavilyClient | null} */
let tavilyClient = null;

/**
 * @returns {import("@tavily/core").TavilyClient | null}
 */
function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  if (!tavilyClient) {
    tavilyClient = tavily({ apiKey });
  }
  return tavilyClient;
}

/**
 * @param {Array<{ title?: string, url?: string, content?: string, publishedDate?: string }>} results
 * @returns {SearchHit[]}
 */
function toSearchHits(results) {
  if (!Array.isArray(results)) return [];
  return results
    .map((item) => ({
      title: item.title || "",
      snippet: (item.content || "").trim(),
      link: item.url || "",
      date: item.publishedDate || null,
    }))
    .filter((h) => h.link || h.snippet || h.title);
}

/**
 * @param {SearchHit[]} hits
 * @param {number} [maxTotal]
 */
function dedupeSearchHits(hits, maxTotal = 24) {
  const seen = new Set();
  /** @type {SearchHit[]} */
  const merged = [];
  for (const item of hits) {
    const key = (item.link || item.title || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= maxTotal) break;
  }
  return merged;
}

export function isTavilyConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

/**
 * @param {string} query
 * @param {{ maxResults?: number, searchDepth?: "basic"|"advanced", days?: number }} [opts]
 * @returns {Promise<SearchHit[]|null>}
 */
export async function searchTavily(query, opts = {}) {
  const client = getTavilyClient();
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return [];

  if (client) {
    try {
      const response = await client.search(q, {
        searchDepth: opts.searchDepth || "advanced",
        maxResults: opts.maxResults ?? 10,
        includeAnswer: false,
        includeRawContent: false,
        ...(typeof opts.days === "number" && opts.days > 0 ? { days: opts.days } : {}),
      });
      const hits = toSearchHits(response?.results);
      console.log(`[intel] tavily "${q.slice(0, 80)}" → ${hits.length} hits`);
      return hits;
    } catch (err) {
      console.error("[intel] tavily sdk error:", err instanceof Error ? err.message : err);
    }
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: q,
      search_depth: opts.searchDepth || "advanced",
      include_answer: false,
      max_results: opts.maxResults ?? 10,
      ...(typeof opts.days === "number" && opts.days > 0 ? { days: opts.days } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const hits = toSearchHits(data?.results);
  console.log(`[intel] tavily "${q.slice(0, 80)}" → ${hits.length} hits`);
  return hits;
}

/**
 * Run multiple Tavily queries in parallel; dedupe by URL.
 * @param {string[]} queries
 * @param {{ maxResults?: number, searchDepth?: "basic"|"advanced", maxTotal?: number, days?: number }} [opts]
 * @returns {Promise<SearchHit[]|null>}
 */
export async function searchTavilyParallel(queries, opts = {}) {
  if (!isTavilyConfigured()) return null;

  const list = (queries || [])
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter(Boolean);

  if (!list.length) return [];

  const perQuery = opts.maxResults ?? 5;
  const maxTotal = opts.maxTotal ?? 24;

  const batches = await Promise.all(
    list.map((query) => searchTavily(query, {
      maxResults: perQuery,
      searchDepth: opts.searchDepth || "advanced",
      days: opts.days,
    }).catch((err) => {
      console.error("[intel] tavily parallel error:", err instanceof Error ? err.message : err);
      return [];
    })),
  );

  const flat = batches.flatMap((hits) => hits || []);
  const merged = dedupeSearchHits(flat, maxTotal);
  console.log(`[intel] tavily parallel ${list.length} queries → ${merged.length} hits`);
  return merged;
}
