import { completeJsonForProvider, describeLlmUnavailable, getLastLlmFailure } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";
import {
  DEFAULT_INTEL_MODEL_ID,
  getIntelModel,
  resolveIntelModelApiModel,
} from "./intelModels.js";

const MAX_CITATIONS = 8;
const SYSTEM_PROMPT = `You respond only with valid JSON. No markdown.
Schema:
{
  "overview": string,
  "citations": [{ "title": string, "url": string, "snippet": string, "source": string }]
}
Synthesize a concise overview from the query and web snippets. Include up to 6 citations from the snippets.`;

/**
 * @typedef {{ title?: string, snippet?: string, link?: string }} SearchHit
 * @typedef {{ id: string, title: string, url: string, domain: string, source: string, body: string }} Citation
 */

function formatSnippets(snippets) {
  return snippets
    .slice(0, 12)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.link}`)
    .join("\n\n");
}

/** @param {string} url */
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return (url || "").replace(/^https?:\/\//i, "").split("/")[0] || "web";
  }
}

/** @param {string} url */
function normalizeUrlKey(url) {
  return (url || "").replace(/\/$/, "").toLowerCase();
}

/** @param {Citation[]} items */
function dedupeCitations(items) {
  const seen = new Set();
  return items.filter((c) => {
    const key = normalizeUrlKey(c.url);
    if (!key || key === "#" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @param {SearchHit} hit @param {number} index */
function hitToCitation(hit, index) {
  const url = (hit.link || "").trim();
  if (!url) return null;
  const domain = domainFromUrl(url);
  return {
    id: `cite-${index + 1}`,
    title: (hit.title || domain || "Source").trim(),
    url,
    domain,
    source: domain,
    body: (hit.snippet || hit.title || "").trim(),
    date: hit.date || null,
  };
}

/** @param {SearchHit[]|null|undefined} snippets */
function citationsFromSnippets(snippets) {
  const items = (snippets || [])
    .map((hit, i) => hitToCitation(hit, i))
    .filter(Boolean);
  return dedupeCitations(items).slice(0, MAX_CITATIONS).map((c, i) => ({
    ...c,
    id: `cite-${i + 1}`,
  }));
}

/**
 * @param {unknown[]} raw
 * @param {Set<string>|null} allowedUrlKeys — when set, only URLs from Serper pass through
 */
function citationsFromLlm(raw, allowedUrlKeys = null) {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!url) return null;
      if (allowedUrlKeys && !allowedUrlKeys.has(normalizeUrlKey(url))) return null;
      const domain = domainFromUrl(url);
      return {
        id: `cite-llm-${index + 1}`,
        title: (item.title || domain || "Source").trim(),
        url,
        domain,
        source: (item.source || domain).trim(),
        body: (item.snippet || item.title || "").trim(),
      };
    })
    .filter(Boolean);
  return dedupeCitations(items).slice(0, MAX_CITATIONS);
}

/**
 * @param {SearchHit[]|null|undefined} snippets
 * @param {unknown[]} llmCitations
 */
export function buildCitations(snippets, llmCitations) {
  const fromSerper = citationsFromSnippets(snippets);
  if (fromSerper.length) return fromSerper;

  const allowedKeys = new Set(
    (snippets || [])
      .map((s) => normalizeUrlKey(s.link || ""))
      .filter(Boolean),
  );

  const validatedLlm = citationsFromLlm(
    llmCitations,
    allowedKeys.size ? allowedKeys : null,
  );
  if (validatedLlm.length) return validatedLlm;

  return [];
}

/**
 * @param {string} query
 * @param {Array<{ title?: string, dataType?: string, content?: unknown }>} contextNodes
 * @param {{ modelId?: string }} [options]
 */
export async function runIntelOverviewPipeline(query, contextNodes = [], options = {}) {
  const q = query.trim();
  if (!q) throw new Error("query is required");

  const modelDef = getIntelModel(options.modelId || DEFAULT_INTEL_MODEL_ID);
  const apiModel = resolveIntelModelApiModel(modelDef);

  const contextBlock = contextNodes.length
    ? contextNodes.map((n, i) => `${i + 1}. ${n.title}: ${String(n.content ?? "").slice(0, 200)}`).join("\n")
    : "";

  const queries = [
    q,
    `${q} product launch news`,
    `${q} market analysis`,
  ];

  const snippets = await searchWebMulti(queries);
  const corpus = snippets?.length ? formatSnippets(snippets) : "No web snippets available.";

  const prompt =
    `User query: ${q}\n\n`
    + (contextBlock ? `Connected node context:\n${contextBlock}\n\n` : "")
    + `Web snippets:\n${corpus}\n\n`
    + "Write overview and citations JSON.";

  const llm = await completeJsonForProvider(prompt, {
    system: SYSTEM_PROMPT,
    provider: modelDef.provider,
    model: apiModel,
  });

  if (!llm?.data) {
    const failure = getLastLlmFailure();
    const err = new Error(describeLlmUnavailable());
    if (failure?.code === "rate_limit") {
      err.code = "rate_limit";
    }
    throw err;
  }

  const citations = buildCitations(
    snippets,
    Array.isArray(llm.data.citations) ? llm.data.citations : [],
  );

  return {
    overview: typeof llm.data.overview === "string" ? llm.data.overview : q,
    citations,
    tokensUsed: modelDef.tokenCost,
    modelId: modelDef.id,
    modelLabel: modelDef.label,
    provider: llm.provider || modelDef.provider,
    source: snippets?.length ? `serper+${llm.provider || modelDef.provider}` : (llm.provider || modelDef.provider),
  };
}

export { citationsFromSnippets };
