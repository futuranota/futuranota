import { isDataForSeoConfigured } from "./discovery/dataForSeoAuth.js";
import { fetchDataForSeoPaa } from "./discovery/dataForSeoPaa.js";
import { fetchApifySocialHype } from "./discovery/apifySocialHype.js";
import { completeJson } from "./llmJson.js";
import { normalizeLlmUsage } from "./management/apiCostPricing.js";

const SYSTEM_PROMPT = `You respond only with valid JSON. No markdown.
Schema:
{
  "campaignActive": boolean,
  "status": "ACTIVA" | "INACTIVA" | "EMERGENTE",
  "overview": string,
  "note": string
}
Use ACTIVA when there is clear ongoing campaign activity, INACTIVA when quiet, EMERGENTE when signals are building but not confirmed.`;

/**
 * @param {string} brandName
 * @param {string} [keyword]
 */
export async function runCampaignStudyPipeline(brandName, keyword) {
  const brand = brandName.trim();
  const searchKeyword = (keyword || brand).trim();
  if (!brand) throw new Error("brandName is required");

  const hasDataForSeo = isDataForSeoConfigured();
  const hasApify = Boolean(process.env.APIFY_API_TOKEN);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (!hasGroq && !hasDataForSeo && !hasApify) {
    throw new Error(
      "Campaign study pipeline unavailable — configure GROQ_API_KEY and optionally DATAFORSEO_* / APIFY_API_TOKEN",
    );
  }

  const [paaResult, hypeResult] = await Promise.all([
    fetchDataForSeoPaa(searchKeyword),
    fetchApifySocialHype(searchKeyword),
  ]);

  const paaBlock = paaResult.peopleAlsoAsk
    .slice(0, 8)
    .map((item, i) => `${i + 1}. ${item.question}\n   ${item.snippet || ""}`)
    .join("\n");

  const intentBlock = paaResult.searchIntent
    .slice(0, 6)
    .map((item) => `- ${item.keyword} (${item.intent}${item.volume ? `, vol ${item.volume}` : ""})`)
    .join("\n");

  const prompt =
    `Brand: ${brand}\nKeyword: ${searchKeyword}\n\n`
    + `Social hype score: ${hypeResult.hypeScore}/100, mentions: ${hypeResult.mentions}, engagement: ${hypeResult.engagement}\n\n`
    + `People Also Ask:\n${paaBlock || "—"}\n\n`
    + `Search intent keywords:\n${intentBlock || "—"}\n\n`
    + "Write a concise campaign overview (2-3 sentences) and a short analyst note (1-2 sentences). "
    + "Set campaignActive and status based on hype + search intent signals.";

  const llm = await completeJson(prompt, { system: SYSTEM_PROMPT });
  const data = llm?.data || {};
  const llmUsage = normalizeLlmUsage(llm?.usage);

  const status = ["ACTIVA", "INACTIVA", "EMERGENTE"].includes(data.status)
    ? data.status
    : (hypeResult.hypeScore >= 55 ? "ACTIVA" : hypeResult.hypeScore >= 35 ? "EMERGENTE" : "INACTIVA");

  return {
    campaignActive: Boolean(data.campaignActive ?? hypeResult.hypeScore >= 50),
    status,
    overview: typeof data.overview === "string" && data.overview.trim()
      ? data.overview.trim()
      : `${brand} shows ${status.toLowerCase()} campaign signals with hype score ${hypeResult.hypeScore}/100.`,
    note: typeof data.note === "string" && data.note.trim()
      ? data.note.trim()
      : `Search interest clusters around launch timing and product rumors for ${brand}.`,
    peopleAlsoAsk: paaResult.peopleAlsoAsk,
    socialHype: hypeResult,
    searchIntent: paaResult.searchIntent,
    source: [paaResult.source, hypeResult.source, llm?.provider || "groq"].filter(Boolean).join("+"),
    llmProvider: llm?.provider || null,
    llmModel: llm?.model || null,
    llmUsage,
    apifyBilled: hypeResult.source === "apify" && hypeResult.billed !== false,
    apifyComputeUnits: hypeResult.computeUnits ?? null,
    apifyUsageTotalUsd: hypeResult.usageTotalUsd ?? null,
    apifyItemCount: hypeResult.itemCount ?? hypeResult.mentions ?? null,
    apifyActorId: hypeResult.actorId || null,
    dataForSeoSource: paaResult.source || null,
  };
}

export function pipelineKeysConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}
