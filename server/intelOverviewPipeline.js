import { completeJsonForProvider, describeLlmUnavailable, getLastLlmFailure } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";
import { isTavilyConfigured, searchTavilyParallel } from "./discovery/tavilySearch.js";
import {
  DEFAULT_INTEL_MODEL_ID,
  getIntelModel,
  resolveIntelModelApiModel,
} from "./intelModels.js";

const MAX_CITATIONS = 8;

/** @param {'en'|'es'} locale */
function buildSystemPrompt(locale) {
  const lang = locale === "en" ? "en" : "es";
  const languageRule = lang === "es"
    ? "- overview: 2-4 frases concisas en español, basadas solo en los snippets."
  : "- overview: 2-4 concise sentences in English, grounded only in the snippets.";
  const noSnippetsRule = lang === "es"
    ? "- Si los snippets están vacíos o dicen que no hay resultados, overview debe ser una sola frase indicando que no hay fuentes web. NO uses conocimiento general ni describas el tema."
    : "- If snippets are empty or say no results, overview must be one sentence stating no web sources were found. Do NOT use general knowledge or describe the topic.";

  return `You respond only with valid JSON. No markdown.
Schema:
{
  "overview": string,
  "citations": [{ "title": string, "url": string, "snippet": string, "source": string }]
}
Synthesize a concise overview from the query and web snippets. Include up to 6 citations from the snippets.
${languageRule}
${noSnippetsRule}`;
}

/** @param {'en'|'es'} locale */
function noWebResultsOverview(locale) {
  return locale === "es"
    ? "No encontramos fuentes web para esta búsqueda. Probá con términos más amplios."
    : "No web sources found for this search. Try broader terms.";
}

/**
 * Serper first, Tavily fallback when Serper is missing or returns nothing.
 * @param {string[]} queries
 * @param {'en'|'es'} locale
 */
async function discoverWebSnippets(queries, locale) {
  let snippets = await searchWebMulti(queries, { locale, maxQueries: 3 });
  if (snippets?.length) {
    return { snippets, source: "serper" };
  }

  if (isTavilyConfigured()) {
    const tavilyHits = await searchTavilyParallel(queries, {
      maxResults: 5,
      searchDepth: "basic",
      maxTotal: 18,
    });
    if (tavilyHits?.length) {
      return { snippets: tavilyHits, source: "tavily" };
    }
  }

  return { snippets: [], source: null };
}

/** @param {string} query @param {'en'|'es'} locale */
function buildSearchQueries(query, locale) {
  const q = query.trim();
  if (locale === "es") {
    return [q, `${q} noticias lanzamiento producto`, `${q} análisis mercado`];
  }
  return [q, `${q} product launch news`, `${q} market analysis`];
}

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
 * @param {{ modelId?: string, locale?: 'en'|'es' }} [options]
 */
export async function runIntelOverviewPipeline(query, contextNodes = [], options = {}) {
  const q = query.trim();
  if (!q) throw new Error("query is required");

  const locale = options.locale === "en" ? "en" : "es";
  const modelDef = getIntelModel(options.modelId || DEFAULT_INTEL_MODEL_ID);
  const apiModel = resolveIntelModelApiModel(modelDef);

  const contextBlock = contextNodes.length
    ? contextNodes.map((n, i) => `${i + 1}. ${n.title}: ${String(n.content ?? "").slice(0, 200)}`).join("\n")
    : "";

  const queries = buildSearchQueries(q, locale);

  const { snippets, source: searchSource } = await discoverWebSnippets(queries, locale);
  if (!snippets.length) {
    return {
      overview: noWebResultsOverview(locale),
      citations: [],
      tokensUsed: modelDef.tokenCost,
      modelId: modelDef.id,
      modelLabel: modelDef.label,
      provider: modelDef.provider,
      source: searchSource || "no-web-results",
    };
  }

  const corpus = formatSnippets(snippets);

  const closingInstruction = locale === "es"
    ? "Escribe overview y citations en JSON. El overview debe estar en español."
    : "Write overview and citations JSON in English.";

  const prompt =
    `User query: ${q}\n\n`
    + (contextBlock ? `Connected node context:\n${contextBlock}\n\n` : "")
    + `Web snippets:\n${corpus}\n\n`
    + closingInstruction;

  const llm = await completeJsonForProvider(prompt, {
    system: buildSystemPrompt(locale),
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
    source: `${searchSource || "web"}+${llm.provider || modelDef.provider}`,
  };
}

export { citationsFromSnippets };
