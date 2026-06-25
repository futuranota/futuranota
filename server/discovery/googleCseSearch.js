const GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * @typedef {import('./serpApiSearch.js').SearchHit} SearchHit
 */

/**
 * Runs a single search against a curated Google Programmable Search Engine
 * (restricted to whatever sites are configured in its dashboard — Google
 * retired unrestricted "search the entire web" for new CSEs). Returns null
 * when GOOGLE_CSE_CX isn't configured, same "no key = feature disabled"
 * pattern as serpApiSearch.js / llmJson.js.
 * @param {string} query
 * @returns {Promise<SearchHit[]|null>}
 */
export async function searchCuratedSites(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) return null;

  const url = `${GOOGLE_CSE_URL}?key=${apiKey}&cx=${cx}&num=10&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google CSE ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return items.map((item) => ({
    title: item.title || "",
    snippet: item.snippet || "",
    link: item.link || "",
    date: item.pagemap?.metatags?.[0]?.["article:published_time"] || null,
  }));
}

/**
 * Runs several queries in parallel and flattens the results into one corpus.
 * @param {string[]} queries
 * @returns {Promise<SearchHit[]|null>} null if GOOGLE_CSE_CX is not configured
 */
export async function searchCuratedSitesMulti(queries) {
  if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_CX) return null;

  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const hits = await searchCuratedSites(q);
        console.log(`[horizon-scan] cse "${q}" → ${hits.length} hits`);
        return hits;
      } catch (err) {
        console.error(`[horizon-scan] cse error for "${q}":`, err.message);
        return [];
      }
    }),
  );
  return results.flat();
}
