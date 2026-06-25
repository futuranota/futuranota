// api/analytics/horizon-scan.js
// Vercel Function — espejo de server/horizonScanHandler.js para producción.

import { completeJson } from "../../server/llmJson.js";
import { searchWebMulti } from "../../server/discovery/serpApiSearch.js";
import { searchCuratedSitesMulti } from "../../server/discovery/googleCseSearch.js";
import { buildLaunchQueries } from "../../server/discovery/launchQueries.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;
const MAX_RESULTS = 8;
const MAX_SNIPPETS = 20;

// Used when SERPAPI_KEY is missing — Groq invents candidates from its own training knowledge.
const SYSTEM_PROMPT_INVENT = `You respond only with valid JSON. No markdown, no commentary.
Schema: { "companies": [ { "brandName": string, "category": string, "campaignActive": boolean,
"launchDate": "YYYY-MM-DD"|null, "overview": string, "averageIntervalMonths": number,
"lastLaunchDate": "YYYY-MM-DD" } ] }
Use realistic public knowledge. Discover companies OPEN — do not limit yourself to any
previously-given list. Only include companies whose launchDate falls within the requested
range from today. "overview" must be written in Spanish, 2-3 short sentences.
Return at most ${MAX_RESULTS} companies, ranked by confidence.`;

// Used when SERPAPI_KEY is present — Groq only extracts/qualifies from real search snippets.
const SYSTEM_PROMPT_QUALIFY = `You respond only with valid JSON. No markdown, no commentary.
Schema: { "companies": [ { "brandName": string, "category": string, "campaignActive": boolean,
"launchDate": "YYYY-MM-DD"|null, "overview": string, "averageIntervalMonths": number,
"lastLaunchDate": "YYYY-MM-DD" } ] }
You will be given real web search snippets. For each snippet, decide: is there an identifiable
company, is there a confirmed launch/campaign/pre-order event, and does the estimated launch
date fall within the requested range from today? Discard snippets that don't clearly name a
company or confirm an event — do not invent companies that aren't in the snippets.
"overview" must be written in Spanish, 2-3 short sentences, grounded in the snippet content.
Return at most ${MAX_RESULTS} companies, ranked by confidence.`;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mockHorizonScan(rangeDays, industry) {
  const seedLabel = industry || "tech";
  const today = new Date();
  const seeds = ["Nimbus Labs", "Quanta Forge", "Driftwave", "Verdant Systems"];

  return seeds.map((brandName, i) => {
    const daysAhead = Math.min(rangeDays, 10 + i * 20);
    const launch = new Date(today);
    launch.setDate(launch.getDate() + daysAhead);
    const launchDate = `${launch.getFullYear()}-${String(launch.getMonth() + 1).padStart(2, "0")}-${String(launch.getDate()).padStart(2, "0")}`;
    const last = new Date(today);
    last.setMonth(last.getMonth() - (6 + i));
    const lastLaunchDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    return {
      brandName,
      category: `${seedLabel} launch`,
      campaignActive: true,
      launchDate,
      overview: `${brandName} parece tener un lanzamiento ${seedLabel} en preparación, estimado para el ${launchDate}.`,
      averageIntervalMonths: 8 + i,
      lastLaunchDate,
      source: "mock",
    };
  });
}

function normalizeHit(hit) {
  const brandName = typeof hit?.brandName === "string" ? hit.brandName.trim() : "";
  if (!brandName) return null;

  const avg = Number(hit?.averageIntervalMonths);
  const last = typeof hit?.lastLaunchDate === "string" ? hit.lastLaunchDate.trim() : "";
  if (!Number.isFinite(avg) || avg <= 0 || avg > 60) return null;
  if (!ISO_DATE.test(last) || Number.isNaN(new Date(`${last}T12:00:00`).getTime())) return null;

  const campaignActive = Boolean(hit?.campaignActive);
  let launchDate = null;
  if (campaignActive) {
    const candidate = typeof hit?.launchDate === "string" ? hit.launchDate.trim() : "";
    if (!ISO_DATE.test(candidate) || Number.isNaN(new Date(`${candidate}T12:00:00`).getTime())) return null;
    launchDate = candidate;
  }

  return {
    brandName,
    category: typeof hit?.category === "string" ? hit.category.trim() : "",
    campaignActive,
    launchDate,
    overview: typeof hit?.overview === "string" ? hit.overview.trim() : "",
    averageIntervalMonths: Math.round(avg * 10) / 10,
    lastLaunchDate: last,
  };
}

function formatSnippetsCorpus(snippets) {
  return snippets
    .slice(0, MAX_SNIPPETS)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\n(${s.link}${s.date ? `, ${s.date}` : ""})`)
    .join("\n\n");
}

/**
 * Merges SerpApi (whole web) + Google CSE (curated sites) snippets, deduped
 * by link. Either source can be disabled (null) independently.
 */
function combineSnippetSources(serpHits, cseHits) {
  const enabledSources = [];
  if (serpHits !== null) enabledSources.push("serpapi");
  if (cseHits !== null) enabledSources.push("cse");

  if (enabledSources.length === 0) return { snippets: null, sourceLabel: null };

  const seen = new Set();
  const merged = [...(serpHits || []), ...(cseHits || [])].filter((s) => {
    if (!s.link) return true;
    if (seen.has(s.link)) return false;
    seen.add(s.link);
    return true;
  });

  return { snippets: merged, sourceLabel: enabledSources.join("+") };
}

async function scanHorizon(rangeDays, industry) {
  const industryClause = industry
    ? `Enfocate en la industria/sector: ${industry}. `
    : "Cualquier industria. ";

  const queries = buildLaunchQueries(rangeDays, industry);
  // Real web search first — sources resolve to null when their keys aren't configured.
  const [serpHits, cseHits] = await Promise.all([
    searchWebMulti(queries),
    searchCuratedSitesMulti(queries),
  ]);
  const { snippets, sourceLabel } = combineSnippetSources(serpHits, cseHits);
  const liveSearchEnabled = snippets !== null;

  let prompt;
  let systemPrompt;
  if (liveSearchEnabled) {
    if (snippets.length === 0) return [];
    systemPrompt = SYSTEM_PROMPT_QUALIFY;
    prompt =
      `Hoy es ${todayIso()}. Rango pedido: incluí lanzamientos confirmados de los últimos ${rangeDays} `
      + `días (lastLaunchDate) y cualquier lanzamiento futuro confirmado sin tope de tiempo, aunque sea `
      + `dentro de varios meses. ${industryClause}`
      + `Estos son resultados reales de búsqueda web:\n\n${formatSnippetsCorpus(snippets)}\n\n`
      + 'Extraé y devolvé un JSON con: { "companies": [ { "brandName": string, "category": string, '
      + '"campaignActive": boolean, "launchDate": "YYYY-MM-DD"|null, "overview": string, '
      + '"averageIntervalMonths": número, "lastLaunchDate": "YYYY-MM-DD" } ] }';
  } else {
    systemPrompt = SYSTEM_PROMPT_INVENT;
    prompt =
      `Hoy es ${todayIso()}. Descubrí compañías o startups (sin que te las haya dado yo) que tengan `
      + `una campaña de lanzamiento, teaser o pre-registro: ya sea lanzada en los últimos ${rangeDays} `
      + `días, o con fecha de lanzamiento futura confirmada (sin tope de tiempo, aunque sea dentro de `
      + `varios meses). ${industryClause}`
      + 'Devuelve un JSON con: { "companies": [ { "brandName": string, "category": string, '
      + '"campaignActive": boolean, "launchDate": "YYYY-MM-DD"|null, "overview": string, '
      + '"averageIntervalMonths": número, "lastLaunchDate": "YYYY-MM-DD" } ] }';
  }

  const llm = await completeJson(prompt, { system: systemPrompt });
  if (!llm) {
    return mockHorizonScan(rangeDays, industry);
  }

  const rawList = Array.isArray(llm.data?.companies) ? llm.data.companies : [];
  const source = liveSearchEnabled ? `${sourceLabel}+${llm.provider}` : llm.provider;
  return rawList
    .map(normalizeHit)
    .filter(Boolean)
    .slice(0, MAX_RESULTS)
    .map((hit) => ({ ...hit, source }));
}

// ── Vercel Function handler ──────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body ?? {};
    const rangeDays = Math.min(MAX_RANGE_DAYS, Math.max(1, Number(body.rangeDays) || 90));
    const industry = typeof body.industry === "string" ? body.industry.trim() : "";

    const companies = await scanHorizon(rangeDays, industry);
    res.status(200).json({ companies });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Scan failed",
    });
  }
}
