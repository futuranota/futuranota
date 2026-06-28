import { searchTavily, searchTavilyParallel, isTavilyConfigured } from "./tavilySearch.js";
import { DEFAULT_RANGE_DAYS } from "../../src/lib/campaignWindow.js";
import { filterIntelSnippets } from "../../src/lib/intelSnippetFilter.js";

/**
 * @typedef {import("./serpApiSearch.js").SearchHit} SearchHit
 */

const MIN_SOURCES = 5;
const DEFAULT_DAYS = DEFAULT_RANGE_DAYS;
const FALLBACK_DAYS = DEFAULT_RANGE_DAYS;

/**
 * Normalize brand slug for site: queries.
 * @param {string} brandName
 */
function brandSlug(brandName) {
  return (brandName || "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Six intent-grouped queries for parallel Tavily search (Brand Intelligence Agent).
 * @param {string} brandName
 * @param {{ officialDomain?: string, year?: number, prevYear?: number }} [opts]
 * @returns {string[]}
 */
export function buildBrandParallelQueries(brandName, opts = {}) {
  const brand = (brandName || "").trim();
  if (!brand) return [];

  const year = opts.year ?? new Date().getFullYear();
  const prevYear = opts.prevYear ?? year - 1;
  const slug = brandSlug(brand);
  const domain = (opts.officialDomain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

  const siteNews = domain
    ? `site:${domain} news ${year}`
    : `site:${slug}.com news`;

  return [
    `${brand} newsroom announcement ${year}`,
    siteNews,
    `"${brand}" launched OR announced OR released ${year}`,
    `"${brand}" upcoming OR "will launch" OR "next release" OR "release date" ${year}`,
    `"${brand}" new campaign OR commercial OR ad ${year}`,
    `"${brand}" market share OR sales report OR revenue ${prevYear} ${year}`,
    `"${brand}" launch date OR pre-order OR "coming soon" ${year}`,
  ];
}

/**
 * Format Tavily hits for Groq user prompt.
 * @param {SearchHit[]} results
 * @param {'en' | 'es'} [locale]
 */
export function formatResultsForPrompt(results, locale = "es") {
  const lang = locale === "en" ? "en" : "es";
  const label = lang === "es" ? "Fuente" : "Source";
  const titleLabel = lang === "es" ? "Título" : "Title";
  const dateLabel = lang === "es" ? "Fecha" : "Date";
  const contentLabel = lang === "es" ? "Contenido" : "Content";
  const noDate = lang === "es" ? "sin fecha" : "no date";

  return (results || [])
    .map((r, i) => [
      `[${label} ${i + 1}]`,
      `${titleLabel}: ${r.title || ""}`,
      `URL: ${r.link || ""}`,
      `${dateLabel}: ${r.date || noDate}`,
      `${contentLabel}: ${r.snippet || ""}`,
    ].join("\n"))
    .join("\n\n---\n\n");
}

/**
 * @param {Array<{ title?: string, url?: string, body?: string, date?: string|null }>} citations
 * @param {'en' | 'es'} [locale]
 */
export function formatCitationsForPrompt(citations, locale = "es") {
  const hits = (citations || []).map((c) => ({
    title: c.title || "",
    link: c.url || "",
    snippet: c.body || "",
    date: c.date || null,
  }));
  return formatResultsForPrompt(hits, locale);
}

/**
 * Parallel brand search via @tavily/core — 6 queries, dedupe, fallback if < 5 results.
 * @param {string} brandName
 * @param {{ officialDomain?: string, locale?: 'en'|'es', rangeDays?: number, maxTotal?: number }} [opts]
 * @returns {Promise<{ hits: SearchHit[], source: string }|null>}
 */
export async function searchBrand(brandName, {
  officialDomain = "",
  locale = "es",
  rangeDays = DEFAULT_DAYS,
  maxTotal = 24,
} = {}) {
  if (!isTavilyConfigured()) return null;

  const name = brandName.trim();
  if (!name) return { hits: [], source: "tavily" };

  const days = rangeDays > 0 ? rangeDays : DEFAULT_DAYS;
  const queries = buildBrandParallelQueries(name, { officialDomain });

  let hits = await searchTavilyParallel(queries, {
    maxResults: 5,
    searchDepth: "advanced",
    maxTotal,
    days,
  });

  hits = hits || [];
  hits = filterIntelSnippets(hits, name);

  if (hits.length < MIN_SOURCES) {
    const year = new Date().getFullYear();
    const fallbackQuery = `${name} news ${year}`;
    const fallbackHits = await searchTavily(fallbackQuery, {
      searchDepth: "advanced",
      maxResults: 10,
      days: FALLBACK_DAYS,
    });

    if (fallbackHits?.length) {
      const seen = new Set(hits.map((h) => (h.link || "").toLowerCase()).filter(Boolean));
      for (const item of fallbackHits) {
        const key = (item.link || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        hits.push(item);
        if (hits.length >= maxTotal) break;
      }
      console.log(`[intel] searchBrand fallback (${FALLBACK_DAYS}d) → ${hits.length} total hits`);
    }
  }

  return { hits, source: "tavily" };
}
