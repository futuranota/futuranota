import { completeJson, describeLlmUnavailable } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";
import { searchCuratedSitesMulti } from "./discovery/googleCseSearch.js";
import { buildLaunchQueries } from "./discovery/launchQueries.js";
import { buildCuratedSourceQueries } from "./discovery/curatedQueries.js";
import { resolveScanSources } from "./scanSourcesStore.js";
import {
  SYSTEM_PROMPT_HORIZON_EXTRACT,
  buildHorizonExtractPrompt,
  filterVerifiedHorizonResults,
} from "./campaignIntelSchema.js";
import { partitionHorizonCompanies } from "./brandCampaignIntel.js";

const MAX_RANGE_DAYS = 365;
const MAX_RESULTS = 8;
const MAX_SNIPPETS = 24;

export const SERPER_REQUIRED_MESSAGE =
  "Horizon Scan requiere SERPAPI_KEY (Serper) para datos verificados. "
  + "Configurala en .env — sin búsqueda web no se devuelven compañías.";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSnippetsCorpus(snippets) {
  return snippets
    .slice(0, MAX_SNIPPETS)
    .map((s, i) => {
      const tier = s._tier ? `[${s._tier}] ` : "";
      return `[${i + 1}] ${tier}${s.title}\n${s.snippet}\nURL: ${s.link}${s.date ? `\nDate: ${s.date}` : ""}`;
    })
    .join("\n\n");
}

function tagSnippets(hits, tier) {
  return (hits || []).map((h) => ({ ...h, _tier: tier }));
}

function combineSnippetSources(serpCurated, serpOpen, cseHits) {
  const enabledSources = [];
  if (serpCurated !== null || serpOpen !== null) enabledSources.push("serper");
  if (cseHits !== null) enabledSources.push("cse");

  if (enabledSources.length === 0) return { snippets: null, sourceLabel: null };

  const seen = new Set();
  const merged = [
    ...tagSnippets(serpCurated, "curated"),
    ...tagSnippets(serpOpen, "open_web"),
    ...tagSnippets(cseHits, "cse"),
  ].filter((s) => {
    if (!s.link) return true;
    if (seen.has(s.link)) return false;
    seen.add(s.link);
    return true;
  });

  return { snippets: merged, sourceLabel: enabledSources.join("+") };
}

/**
 * @param {number} rangeDays
 * @param {string} industry
 * @param {unknown[]} [clientSources]
 */
export async function scanHorizonVerified(rangeDays, industry, clientSources) {
  const sources = resolveScanSources(clientSources);
  const industryClause = industry
    ? `Industry focus: ${industry}. `
    : "Prefer sports, premium physical, physical+tech, innovation, and mass retail launches. ";

  const curatedQueries = buildCuratedSourceQueries(sources, rangeDays, industry);
  const openQueries = buildLaunchQueries(rangeDays, industry);
  const allQueries = [...curatedQueries, ...openQueries];

  const [serpCurated, serpOpen, cseHits] = await Promise.all([
    curatedQueries.length > 0 ? searchWebMulti(curatedQueries) : Promise.resolve([]),
    searchWebMulti(openQueries),
    searchCuratedSitesMulti(allQueries),
  ]);

  const { snippets, sourceLabel } = combineSnippetSources(serpCurated, serpOpen, cseHits);

  if (snippets === null) {
    return {
      companies: [],
      meta: { liveSearch: false, error: SERPER_REQUIRED_MESSAGE },
    };
  }

  if (snippets.length === 0) {
    return {
      companies: [],
      meta: {
        liveSearch: true,
        rejected: {},
        curatedSources: sources.length,
        message: "Búsqueda web sin resultados para este rango/industria.",
      },
    };
  }

  const today = todayIso();
  const corpus = formatSnippetsCorpus(snippets);
  const prompt = buildHorizonExtractPrompt(today, rangeDays, industryClause, corpus);

  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT_HORIZON_EXTRACT });
  if (!llm) {
    return {
      companies: [],
      meta: {
        liveSearch: true,
        error: describeLlmUnavailable(),
      },
    };
  }

  const rawList = Array.isArray(llm.data?.companies) ? llm.data.companies : [];
  const { companies: allVerified, rejected } = filterVerifiedHorizonResults(rawList, {
    snippets,
    todayIso: today,
    rangeDays,
    maxResults: MAX_RESULTS * 2,
  });

  const { main, discarded } = partitionHorizonCompanies(allVerified);
  const companies = main.slice(0, MAX_RESULTS);

  const source = `${sourceLabel}+${llm.provider}`;
  const discardedCompanies = discarded.map((hit) => ({ ...hit, source }));
  return {
    companies: companies.map((hit) => ({ ...hit, source })),
    discardedCompanies,
    meta: {
      liveSearch: true,
      rejected,
      rawCandidates: rawList.length,
      accepted: companies.length,
      curatedSources: sources.length,
      curatedQueries: curatedQueries.length,
      detectorContext: "content/admin/detector-de-campanas.md",
      cadenceDiscarded: discarded.length,
      cadenceDiscardedBrands: discardedCompanies.map((d) => ({
        brandName: d.brandName,
        monthsRemaining: d.monthsRemaining,
        cadenceMessage: d.cadenceMessage,
      })),
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function createHorizonScanMiddleware() {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/analytics/horizon-scan") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const rangeDays = Math.min(MAX_RANGE_DAYS, Math.max(1, Number(body.rangeDays) || 90));
      const industry = typeof body.industry === "string" ? body.industry.trim() : "";
      const sources = Array.isArray(body.sources) ? body.sources : [];

      const result = await scanHorizonVerified(rangeDays, industry, sources);

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err instanceof Error ? err.message : "Scan failed",
      }));
    }
  };
}
