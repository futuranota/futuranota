import { completeJson, describeLlmUnavailable } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";
import { buildBrandCampaignQueries } from "./discovery/brandLaunchQueries.js";
import {
  buildBrandDeepCampaignQueries,
  buildUserQuerySerperQueries,
} from "./discovery/brandDeepCampaignQueries.js";
import { buildBrandCadenceQueries } from "./discovery/cadenceQueries.js";
import { buildCuratedSourceQueries } from "./discovery/curatedQueries.js";
import { resolveScanSources } from "./scanSourcesStore.js";
import { buildCitations } from "./intelOverviewPipeline.js";
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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSnippetsCorpus(snippets) {
  return snippets
    .slice(0, MAX_SNIPPETS)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.link}${s.date ? `\nDate: ${s.date}` : ""}`)
    .join("\n\n");
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
 * Deep single-brand campaign study for Intel Campaign tab (report-first).
 * @param {string} brandName
 * @param {{ rangeDays?: number, sources?: unknown[], officialDomain?: string, userQuery?: string }} [options]
 */
export async function detectBrandIntelDeep(brandName, {
  rangeDays = 90,
  sources: clientSources = [],
  officialDomain = "",
  userQuery = "",
} = {}) {
  const name = brandName.trim();
  if (!name) throw new Error("brandName is required");

  const sources = resolveScanSources(clientSources);
  const today = todayIso();
  const curatedForBrand = buildCuratedSourceQueries(sources, rangeDays, name)
    .slice(0, 5)
    .map((q) => `${name} ${q}`);

  const queries = [
    ...buildUserQuerySerperQueries(userQuery, name),
    ...buildBrandDeepCampaignQueries(name, rangeDays, officialDomain),
    ...buildBrandCampaignQueries(name, rangeDays),
    ...curatedForBrand,
  ];

  const snippets = await searchWebMulti(queries);
  if (snippets === null) {
    return {
      ...noDataResult(name, SERPER_REQUIRED_MESSAGE, "none"),
      error: SERPER_REQUIRED_MESSAGE,
      noData: true,
      mode: "deep",
    };
  }

  if (!snippets.length) {
    return {
      ...noDataResult(name, `Sin resultados web para ${name}.`, "serper"),
      mode: "deep",
    };
  }

  const citations = buildCitations(snippets, []);
  const reportCtx = {
    snippets,
    todayIso: today,
    rangeDays,
    brandName: name,
    userQuery,
  };

  const prompt = buildBrandDeepExtractPrompt(
    today,
    rangeDays,
    name,
    userQuery,
    formatSnippetsCorpus(snippets),
  );
  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT_BRAND_RESEARCH });

  if (!llm) {
    const fallback = normalizeBrandResearchReport({}, reportCtx);
    return {
      ...fallback,
      citations,
      source: "serper+fallback",
      mode: "deep",
    };
  }

  const report = normalizeBrandResearchReport(llm.data, reportCtx);
  const llmCitations = buildCitations(
    snippets,
    Array.isArray(llm.data?.citations) ? llm.data.citations : [],
  );

  return {
    ...report,
    brandName: report.brandName || name,
    citations: llmCitations.length ? llmCitations : citations,
    source: `serper+${llm.provider}`,
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

  const { rangeDays = 90, sources: clientSources = [] } = options;
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
