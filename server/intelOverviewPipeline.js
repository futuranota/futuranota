import { completeJson } from "./llmJson.js";
import { searchWebMulti } from "./discovery/serpApiSearch.js";

const TOKEN_COST = 1_000;
const SYSTEM_PROMPT = `You respond only with valid JSON. No markdown.
Schema:
{
  "overview": string,
  "citations": [{ "title": string, "url": string, "snippet": string, "source": string }]
}
Synthesize a concise overview from the query and web snippets. Include up to 6 citations from the snippets.`;

function formatSnippets(snippets) {
  return snippets
    .slice(0, 12)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.link}`)
    .join("\n\n");
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

  const citations = Array.isArray(llm.data.citations)
    ? llm.data.citations.slice(0, 8).map((c, i) => ({
      id: `cite-${i + 1}`,
      title: c.title || "Source",
      url: c.url || "#",
      domain: (c.url || "").replace(/^https?:\/\//, "").split("/")[0] || "web",
      source: c.source || "web",
      body: c.snippet || c.title || "",
    }))
    : [];

  return {
    overview: typeof llm.data.overview === "string" ? llm.data.overview : q,
    citations,
    tokensUsed: TOKEN_COST,
    model: llm.provider || "groq",
    source: snippets?.length ? "serper+groq" : "groq",
  };
}

export { TOKEN_COST as INTEL_OVERVIEW_TOKEN_COST };
