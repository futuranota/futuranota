import { completeJson } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";

const TOKEN_COST = 1_000;
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
function citationsFromLlm(raw, allowedUrlKeys) {
  if (!Array.isArray(raw)) return [];

  const items = raw
    .map((c, i) => {
      const url = typeof c?.url === "string" ? c.url.trim() : "";
      if (!url || url === "#") return null;
      const key = normalizeUrlKey(url);
      if (allowedUrlKeys && !allowedUrlKeys.has(key)) return null;
      const domain = domainFromUrl(url);
      return {
        id: `cite-${i + 1}`,
        title: (c.title || domain || "Source").trim(),
        url,
        domain,
        source: (c.source || domain).trim(),
        body: (c.snippet || c.title || "").trim(),
      };
    })
    .filter(Boolean);

  return dedupeCitations(items).slice(0, MAX_CITATIONS).map((c, i) => ({
    ...c,
    id: `cite-${i + 1}`,
  }));
}

/**
 * Prefer verified Serper hits; fall back to LLM citations (validated when Serper had hits).
 * @param {SearchHit[]|null|undefined} snippets
 * @param {unknown[]} llmCitations
 */
function buildCitations(snippets, llmCitations) {
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
 */
export async function runIntelOverviewPipeline(query, contextNodes = []) {
  const q = query.trim();
  if (!q) throw new Error("query is required");

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

  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT });
  if (!llm?.data) {
    throw new Error("Intel overview unavailable — configure GROQ_API_KEY and SERPAPI_KEY");
  }

  const citations = buildCitations(
    snippets,
    Array.isArray(llm.data.citations) ? llm.data.citations : [],
  );

  return {
    overview: typeof llm.data.overview === "string" ? llm.data.overview : q,
    citations,
    tokensUsed: TOKEN_COST,
    model: llm.provider || "groq",
    source: snippets?.length ? "serper+groq" : "groq",
  };
}

export { TOKEN_COST as INTEL_OVERVIEW_TOKEN_COST };
