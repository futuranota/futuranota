import { completeJson, describeLlmUnavailable } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";
import { isTavilyConfigured } from "./discovery/tavilySearch.js";
import { searchBrand, formatResultsForPrompt } from "./discovery/brandIntelligenceSearch.js";
import {
  buildHighIntentQueries,
  buildTavilyIntelQuery,
  buildSerperCampaignConfirmQueries,
} from "./discovery/intentSearchQueries.js";
import { buildBrandCampaignQueries } from "./discovery/brandLaunchQueries.js";
import {
  buildUserQuerySerperQueries,
} from "./discovery/brandDeepCampaignQueries.js";
import { buildBrandCadenceQueries } from "./discovery/cadenceQueries.js";
import { buildCuratedSourceQueries } from "./discovery/curatedQueries.js";
import { resolveScanSources } from "./scanSourcesStore.js";
import { buildCitations } from "./intelOverviewPipeline.js";
import { DEFAULT_RANGE_DAYS } from "../src/lib/campaignWindow.js";
import { filterIntelSnippets, filterForwardLaunchSignals } from "../src/lib/intelSnippetFilter.js";
import { trimSnippetsForPrompt, trimCorpusForPrompt } from "./agents/intelPromptLimits.js";
import {
  SYSTEM_PROMPT_HORIZON_EXTRACT,
  SYSTEM_PROMPT_BRAND_RESEARCH,
  buildBrandCampaignExtractPrompt,
  buildBrandCadenceExtractPrompt,
  buildBrandDeepExtractPrompt,
  filterVerifiedHorizonResults,
  matchBrandName,
  normalizeBrandResearchReport,
} from "./campaignIntelSchema.js";

const MAX_SNIPPETS = 24;

export const SERPER_REQUIRED_MESSAGE =
  "Campaign Detector requiere SERPAPI_KEY (Serper) para datos verificados. "
  + "Configurala en .env — sin búsqueda web no se devuelven resultados.";

export const INTEL_SEARCH_REQUIRED_MESSAGE =
  "Intel requiere TAVILY_API_KEY o SERPAPI_KEY para búsqueda web verificada.";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSnippetsCorpus(snippets) {
  return trimSnippetsForPrompt(snippets, 12)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.link}${s.date ? `\nDate: ${s.date}` : ""}`)
    .join("\n\n");
}

/**
 * @param {Array<{ title?: string, snippet?: string, link?: string, date?: string|null }>} a
 * @param {Array<{ title?: string, snippet?: string, link?: string, date?: string|null }>} b
 */
function mergeSnippets(a, b) {
  const seen = new Set();
  /** @type {typeof a} */
  const merged = [];
  for (const item of [...a, ...b]) {
    const key = (item.link || item.title || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, MAX_SNIPPETS);
}

/**
 * Pass 1: Tavily parallel brand search (@tavily/core), or Serper fallback.
 * @param {string} brandName
 * @param {{ userQuery?: string, analystBrief?: string, locale?: 'en'|'es', rangeDays?: number, sources?: unknown[], officialDomain?: string }} opts
 */
async function runIntelPass1(brandName, {
  userQuery = "",
  analystBrief = "",
  locale = "es",
  rangeDays = DEFAULT_RANGE_DAYS,
  sources = [],
  officialDomain = "",
} = {}) {
  const name = brandName.trim();
  const lang = locale === "en" ? "en" : "es";

  if (isTavilyConfigured()) {
    try {
      const brandSearch = await searchBrand(name, {
        officialDomain,
        locale: lang,
        rangeDays,
        maxTotal: MAX_SNIPPETS,
      });

      if (brandSearch?.hits?.length) {
        const filtered = filterIntelSnippets(brandSearch.hits, name);
        if (filtered.length) {
          return {
            snippets: filtered,
            source: brandSearch.source || "tavily",
          };
        }
      }
    } catch (err) {
      console.error("[intel] tavily pass1 error:", err instanceof Error ? err.message : err);
    }
  }

  const curatedForBrand = buildCuratedSourceQueries(sources, rangeDays, name)
    .slice(0, 2)
    .map((q) => `${name} ${q}`);

  const queries = [
    buildTavilyIntelQuery(name, userQuery, analystBrief, lang),
    ...buildHighIntentQueries(name, lang).slice(0, 4),
    ...buildUserQuerySerperQueries(userQuery, name).slice(0, 2),
    ...curatedForBrand,
  ];

  const snippets = await searchWebMulti(queries, { maxQueries: 5 });
  if (snippets === null) {
    return { snippets: null, source: "none" };
  }
  return { snippets: filterIntelSnippets(snippets, name), source: "serper" };
}

/**
 * @param {object} detection
 * @param {Array<{ link?: string }>} snippets
 * @param {string} [officialDomain]
 */
function shouldRunSerperPass2(detection, snippets, officialDomain = "") {
  if (Boolean(detection?.campaignActive)) return true;
  if (detection?.detectionMode === "confirmed_campaign") return true;
  const signals = Array.isArray(detection?.launchSignals) ? detection.launchSignals.length : 0;
  if (signals >= 2) return true;
  if ((detection?.confidence || 0) >= 75 && detection?.campaignActive) return true;

  const domain = (officialDomain || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (domain && Boolean(detection?.campaignActive)) {
    const hit = snippets.some((s) => (s.link || "").includes(domain));
    if (hit) return true;
  }
  return false;
}

/**
 * Pass 2: Serper refinement when campaign signal is confirmed.
 */
async function runSerperPass2(brandName, { officialDomain = "", userQuery = "", rangeDays = DEFAULT_RANGE_DAYS } = {}) {
  const queries = buildSerperCampaignConfirmQueries(brandName, rangeDays, officialDomain, userQuery);
  return searchWebMulti(queries, { maxQueries: 3 });
}

/**
 * @param {Array<{ title?: string, snippet?: string, link?: string, date?: string|null }>} snippets
 * @param {string} today
 * @param {number} rangeDays
 * @param {string} brandName
 * @param {string} userQuery
 */
async function extractBrandDeepFromSnippets(snippets, today, rangeDays, brandName, userQuery) {
  const citations = buildCitations(snippets, []);
  const reportCtx = {
    snippets,
    todayIso: today,
    rangeDays,
    brandName,
    userQuery,
  };

  const prompt = buildBrandDeepExtractPrompt(
    today,
    rangeDays,
    brandName,
    userQuery,
    formatSnippetsCorpus(snippets),
  );
  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT_BRAND_RESEARCH });

  if (!llm) {
    const fallback = normalizeBrandResearchReport({}, reportCtx);
    return {
      report: fallback,
      citations,
      provider: "fallback",
    };
  }

  const report = normalizeBrandResearchReport(llm.data, reportCtx);
  const llmCitations = buildCitations(
    snippets,
    Array.isArray(llm.data?.citations) ? llm.data.citations : [],
  );

  return {
    report,
    citations: llmCitations.length ? llmCitations : citations,
    provider: llm.provider,
  };
}

/**
 * @param {Array<{ brandName?: string }>} hits
 * @param {string} brandName
 */
function pickBrandHit(hits, brandName) {
  if (!hits.length) return null;
  return (
    hits.find((h) => matchBrandName(h.brandName, brandName))
    || hits.find((h) => h.brandName?.toLowerCase().includes(brandName.toLowerCase()))
    || hits[0]
  );
}

function noDataResult(brandName, message, source = "serper", extra = {}) {
  return {
    brandName,
    campaignActive: false,
    detectionMode: null,
    cadenceStatus: "no_data",
    cadenceMessage: message,
    overview: message,
    deepReport: "",
    launchDate: null,
    announcementDate: null,
    lastLaunchDate: null,
    averageIntervalMonths: null,
    monthsRemaining: null,
    estimatedLaunchDate: null,
    confidence: 0,
    evidenceUrl: null,
    category: null,
    ticketTier: null,
    launchSignals: [],
    citations: [],
    source,
    ...extra,
  };
}

/**
 * Deep single-brand intel study (report-first, Tavily Pass 1 + conditional Serper Pass 2).
 * @param {string} brandName
 * @param {{ rangeDays?: number, sources?: unknown[], officialDomain?: string, userQuery?: string, analystBrief?: string, locale?: 'en'|'es' }} [options]
 */
export async function detectBrandIntelDeep(brandName, {
  rangeDays = DEFAULT_RANGE_DAYS,
  sources: clientSources = [],
  officialDomain = "",
  userQuery = "",
  analystBrief = "",
  locale = "es",
} = {}) {
  const name = brandName.trim();
  if (!name) throw new Error("brandName is required");

  const sources = resolveScanSources(clientSources);
  const today = todayIso();

  const pass1 = await runIntelPass1(name, {
    userQuery,
    analystBrief,
    locale,
    rangeDays,
    sources,
    officialDomain,
  });

  if (pass1.snippets === null) {
    return {
      ...noDataResult(name, INTEL_SEARCH_REQUIRED_MESSAGE, "none"),
      error: INTEL_SEARCH_REQUIRED_MESSAGE,
      noData: true,
      mode: "deep",
    };
  }

  if (!pass1.snippets.length) {
    return {
      ...noDataResult(name, `Sin resultados web para ${name}.`, pass1.source || "none"),
      mode: "deep",
    };
  }

  let snippets = pass1.snippets;
  let retrievalSource = pass1.source || "unknown";

  let extracted = await extractBrandDeepFromSnippets(
    snippets,
    today,
    rangeDays,
    name,
    userQuery,
  );

  if (shouldRunSerperPass2(extracted.report, snippets, officialDomain)) {
    const serperSnippets = await runSerperPass2(name, { officialDomain, userQuery, rangeDays });
    if (serperSnippets?.length) {
      snippets = mergeSnippets(snippets, serperSnippets);
      const deepLen = (extracted.report?.deepReport || "").trim().length;
      if (deepLen < 80) {
        extracted = await extractBrandDeepFromSnippets(
          snippets,
          today,
          rangeDays,
          name,
          userQuery,
        );
      }
      retrievalSource = `${pass1.source}+serper`;
    }
  }

  const report = extracted.report;
  const lang = locale === "en" ? "en" : "es";

  const forwardSignals = filterForwardLaunchSignals(report.launchSignals || []);
  const normalizedReport = {
    ...report,
    launchSignals: forwardSignals,
  };

  return {
    ...normalizedReport,
    brandName: report.brandName || name,
    citations: extracted.citations,
    retrievalSnippets: snippets.slice(0, MAX_SNIPPETS),
    sourceCount: snippets.length,
    searchCorpus: trimCorpusForPrompt(formatResultsForPrompt(trimSnippetsForPrompt(snippets, 10), lang)),
    rangeDays,
    source: `${retrievalSource}+${extracted.provider}`,
    mode: "deep",
  };
}

/**
 * Two-pass verified brand intel: Pass A campaign validation, Pass B cadence analysis.
 * @param {string} brandName
 * @param {{ rangeDays?: number, sources?: unknown[], mode?: string, officialDomain?: string, userQuery?: string }} [options]
 */
export async function detectBrandIntel(brandName, options = {}) {
  if (options.mode === "deep") {
    return detectBrandIntelDeep(brandName, options);
  }

  const { rangeDays = DEFAULT_RANGE_DAYS, sources: clientSources = [] } = options;
  const name = brandName.trim();
  if (!name) throw new Error("brandName is required");

  const sources = resolveScanSources(clientSources);
  const today = todayIso();
  const curatedForBrand = buildCuratedSourceQueries(sources, rangeDays, name)
    .slice(0, 3)
    .map((q) => `${name} ${q}`);

  const campaignQueries = [
    ...buildBrandCampaignQueries(name, rangeDays),
    ...curatedForBrand,
  ];

  const campaignSnippets = await searchWebMulti(campaignQueries);
  if (campaignSnippets === null) {
    return {
      ...noDataResult(name, SERPER_REQUIRED_MESSAGE, "none"),
      error: SERPER_REQUIRED_MESSAGE,
      noData: true,
    };
  }

  if (campaignSnippets.length > 0) {
    const prompt = buildBrandCampaignExtractPrompt(
      today,
      rangeDays,
      name,
      formatSnippetsCorpus(campaignSnippets),
    );
    const llm = await completeJson(prompt, { system: SYSTEM_PROMPT_HORIZON_EXTRACT });
    if (llm) {
      const rawList = Array.isArray(llm.data?.companies) ? llm.data.companies : [];
      const { companies } = filterVerifiedHorizonResults(rawList, {
        snippets: campaignSnippets,
        todayIso: today,
        rangeDays,
        maxResults: 5,
      });
      const confirmed = pickBrandHit(
        companies.filter((c) => c.detectionMode === "confirmed_campaign"),
        name,
      );
      if (confirmed) {
        return {
          ...confirmed,
          brandName: confirmed.brandName || name,
          cadenceStatus: null,
          cadenceMessage: null,
          source: `serper+${llm.provider}`,
        };
      }
    }
  }

  const cadenceQueries = buildBrandCadenceQueries(name, rangeDays);
  const cadenceSnippets = await searchWebMulti(cadenceQueries);

  if (!cadenceSnippets || cadenceSnippets.length === 0) {
    return noDataResult(
      name,
      `Sin evidencia web de ciclo de lanzamiento para ${name}.`,
    );
  }

  const cadencePrompt = buildBrandCadenceExtractPrompt(
    today,
    rangeDays,
    name,
    formatSnippetsCorpus(cadenceSnippets),
  );
  const llmCadence = await completeJson(cadencePrompt, { system: SYSTEM_PROMPT_HORIZON_EXTRACT });
  if (!llmCadence) {
    return {
      ...noDataResult(name, describeLlmUnavailable(), "serper"),
      error: describeLlmUnavailable(),
      noData: true,
    };
  }

  const rawCadence = Array.isArray(llmCadence.data?.companies) ? llmCadence.data.companies : [];
  const { companies: cadenceHits } = filterVerifiedHorizonResults(rawCadence, {
    snippets: cadenceSnippets,
    todayIso: today,
    rangeDays,
    maxResults: 5,
  });

  const cadenceHit = pickBrandHit(
    cadenceHits.filter((c) => c.detectionMode === "cadence_only"),
    name,
  );

  if (!cadenceHit) {
    return noDataResult(
      name,
      `Sin evidencia verificada de cadencia para ${name} en fuentes web.`,
      `serper+${llmCadence.provider}`,
    );
  }

  return {
    ...cadenceHit,
    brandName: cadenceHit.brandName || name,
    source: `serper+${llmCadence.provider}`,
  };
}

/**
 * Splits horizon results: main list excludes long-window cadence discards.
 * @param {Array<{ detectionMode?: string, cadenceStatus?: string }>} companies
 */
export function partitionHorizonCompanies(companies) {
  const confirmed = companies.filter((c) => c.detectionMode === "confirmed_campaign");
  const watch = companies.filter(
    (c) => c.detectionMode === "cadence_only" && c.cadenceStatus === "watch",
  );
  const discarded = companies.filter(
    (c) => c.detectionMode === "cadence_only" && c.cadenceStatus === "discard",
  );
  return {
    main: [...confirmed, ...watch],
    discarded,
  };
}
