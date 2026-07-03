// Despite the filename (kept for import stability), this calls Serper
// (google.serper.dev) — not SerpApi (serpapi.com). Different provider,
// different auth (X-API-KEY header, not api_key query param) and different
// request shape (POST + JSON body, not GET).
const SERPER_URL = "https://google.serper.dev/search";

/**
 * @typedef {Object} SearchHit
 * @property {string} title
 * @property {string} snippet
 * @property {string} link
 * @property {string} [date]
 */

/** @param {'en'|'es'} [locale] */
function serperLocaleParams(locale = "en") {
  return locale === "es" ? { gl: "es", hl: "es" } : { gl: "us", hl: "en" };
}

/**
 * Runs a single Google search via Serper. Returns null when SERPAPI_KEY is
 * not configured, mirroring the completeJsonWithGroq/Gemini "no key = feature
 * disabled" pattern in server/llmJson.js.
 * @param {string} query
 * @param {{ locale?: 'en'|'es' }} [opts]
 * @returns {Promise<SearchHit[]|null>}
 */
export async function searchWeb(query, opts = {}) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  const locale = opts.locale === "es" ? "es" : "en";
  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, ...serperLocaleParams(locale), num: 10 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const organic = Array.isArray(data?.organic) ? data.organic : [];
  const news = Array.isArray(data?.news) ? data.news : [];

  return [...organic, ...news].map((item) => ({
    title: item.title || "",
    snippet: item.snippet || "",
    link: item.link || "",
    date: item.date || null,
  }));
}

/**
 * Runs several queries in parallel and flattens the results into one corpus.
 * @param {string[]} queries
 * @param {{ maxQueries?: number, locale?: 'en'|'es' }} [opts]
 * @returns {Promise<SearchHit[]|null>} null if SERPAPI_KEY is not configured
 */
export async function searchWebMulti(queries, opts = {}) {
  if (!process.env.SERPAPI_KEY) return null;

  const maxQueries = opts.maxQueries ?? 8;
  const seen = new Set();
  const capped = [];
  for (const raw of queries) {
    const q = typeof raw === "string" ? raw.trim() : "";
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    capped.push(q);
    if (capped.length >= maxQueries) break;
  }

  const results = await Promise.all(
    capped.map(async (q) => {
      try {
        const hits = await searchWeb(q, { locale: opts.locale });
        console.log(`[horizon-scan] serper "${q}" → ${hits.length} hits`);
        return hits;
      } catch (err) {
        console.error(`[horizon-scan] serper error for "${q}":`, err.message);
        return [];
      }
    }),
  );
  return results.flat();
}
