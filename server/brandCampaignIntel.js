import { completeJson, describeLlmUnavailable } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";
import { buildBrandCampaignQueries } from "./discovery/brandLaunchQueries.js";
import { buildBrandCadenceQueries } from "./discovery/cadenceQueries.js";
import { buildCuratedSourceQueries } from "./discovery/curatedQueries.js";
import { resolveScanSources } from "./scanSourcesStore.js";
import {
  SYSTEM_PROMPT_HORIZON_EXTRACT,
  buildBrandCampaignExtractPrompt,
  buildBrandCadenceExtractPrompt,
  filterVerifiedHorizonResults,
  matchBrandName,
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

function noDataResult(brandName, message, source = "serper") {
  return {
    brandName,
    campaignActive: false,
    detectionMode: null,
    cadenceStatus: "no_data",
    cadenceMessage: message,
    overview: message,
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
    source,
  };
}

/**
 * Two-pass verified brand intel: Pass A campaign validation, Pass B cadence analysis.
 * @param {string} brandName
 * @param {{ rangeDays?: number, sources?: unknown[] }} [options]
 */
export async function detectBrandIntel(brandName, { rangeDays = 90, sources: clientSources = [] } = {}) {
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
