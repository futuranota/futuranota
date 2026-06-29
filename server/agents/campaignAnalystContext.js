import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatCitationsForPrompt, formatResultsForPrompt } from "../discovery/brandIntelligenceSearch.js";
import { DEFAULT_RANGE_DAYS, daysUntilLaunch, isFutureLaunchDate } from "../../src/lib/campaignWindow.js";
import { filterForwardLaunchSignals } from "../../src/lib/intelSnippetFilter.js";
import { trimCorpusForPrompt, trimSnippetsForPrompt } from "./intelPromptLimits.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.join(__dirname, "../../content/agents");

/** @type {Record<string, string | null>} */
const cachedSystemByLocale = {};

/**
 * @param {'en' | 'es'} [locale]
 * @returns {'en' | 'es'}
 */
export function normalizeAnalystLocale(locale) {
  return locale === "es" ? "es" : "en";
}

/**
 * @param {'en' | 'es'} [locale]
 * @returns {string}
 */
export function loadCampaignAnalystSystemContext(locale = "en") {
  const lang = normalizeAnalystLocale(locale);
  if (cachedSystemByLocale[lang] !== undefined) {
    return cachedSystemByLocale[lang] || "";
  }
  const filePath = path.join(AGENTS_DIR, `campaign-analyst.${lang}.md`);
  try {
    cachedSystemByLocale[lang] = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    cachedSystemByLocale[lang] = "";
  }
  return cachedSystemByLocale[lang] || "";
}

/**
 * Format detection citations for analyst user message (Groq prompt block).
 * @param {object} detection
 * @param {'en' | 'es'} lang
 */
function formatSearchCorpus(detection, lang) {
  let corpus = "";

  if (typeof detection?.searchCorpus === "string" && detection.searchCorpus.trim()) {
    corpus = detection.searchCorpus.trim();
  } else {
    const citations = Array.isArray(detection?.citations) ? detection.citations : [];
    if (citations.length) {
      corpus = formatCitationsForPrompt(trimSnippetsForPrompt(citations), lang);
    } else {
      const snippets = Array.isArray(detection?.retrievalSnippets) ? detection.retrievalSnippets : [];
      if (snippets.length) {
        corpus = formatResultsForPrompt(trimSnippetsForPrompt(snippets), lang);
      }
    }
  }

  return trimCorpusForPrompt(corpus);
}

const OUTPUT_BRIDGE = {
  en: `
OUTPUT — valid JSON only (no markdown wrapper). All text fields in English.

{
  "primaryQuestion": string,
  "openingBrief": string,
  "structuredFacts": [
    {
      "fact": string,
      "date": string,
      "source": string,
      "confidence": "high"|"medium"|"low"|"",
      "category": "launch"|"campaign"|"financial data"|"rumor"|""
    }
  ],
  "whatsNew": string,
  "whatsComing": string,
  "strategicRecommendation": string,
  "businessOpportunities": string[],
  "customerMarkets": string,
  "launchCadence": string,
  "sources": [{ "url": string, "type": "official"|"media"|"rumor"|"", "label": string }],
  "overallConfidence": "High"|"Medium"|"Low"|"",
  "confidenceReason": string,
  "marketContext": string,
  "customerMarkets": string,
  "marketAnalysis": {
    "customerLocations": string,
    "salesMetrics": string,
    "priorYearInterestPeak": string,
    "topInterestRegions": string[],
    "evidenceSummary": string
  },
  "launchScenario": "A"|"B"|"C"|"none"|""
}

Rules:
- Phases 2–5 only; search results are in the user message.
- Phase 6: Launch Radar handoff only — no Calendar/Forecast/Market Hype/YouTube guides (Marketing Guide agent).
- marketAnalysis: ONLY from search corpus or detection.marketInterest. Empty strings if no evidence. topInterestRegions max 5 (e.g. "Palo Alto, California").
- openingBrief: strategic hook, 2–4 paragraphs. NEVER repeat the user's question verbatim.
- strategicRecommendation: "My recommendation" block — opportunities, features, direction; never tell user what to sell.
- NEVER include in text fields: "Intel —", "I reviewed X focusing on", Groq/fallback/confidence meta (confidence fields are internal only).
- whatsComing: FUTURE launches only. State days/weeks remaining when known.
- marketContext: ONLY verified data from search corpus or detection.marketInterest (if source is dataforseo). Never invent Trends %.
- sources: include url, type, short label (headline).
- Empty string "" when no evidence. NEVER use "No confirmed data in this period."
- Never invent models, dates, or specs absent from search results.
`.trim(),
  es: `
SALIDA — solo JSON válido (sin markdown). Texto en español.

{
  "primaryQuestion": string,
  "openingBrief": string,
  "structuredFacts": [
    {
      "hecho": string,
      "fecha": string,
      "fuente": string,
      "confianza": "alta"|"media"|"baja"|"",
      "categoria": "lanzamiento"|"campaña"|"dato financiero"|"rumor"|""
    }
  ],
  "whatsNew": string,
  "whatsComing": string,
  "strategicRecommendation": string,
  "businessOpportunities": string[],
  "customerMarkets": string,
  "launchCadence": string,
  "sources": [{ "url": string, "tipo": "oficial"|"medio"|"rumor"|"", "label": string }],
  "overallConfidence": "Alta"|"Media"|"Baja"|"",
  "confidenceReason": string,
  "marketContext": string,
  "customerMarkets": string,
  "marketAnalysis": {
    "customerLocations": string,
    "salesMetrics": string,
    "priorYearInterestPeak": string,
    "topInterestRegions": string[],
    "evidenceSummary": string
  },
  "launchScenario": "A"|"B"|"C"|"none"|""
}

Reglas:
- Fases 2–5 solamente; los resultados de búsqueda vienen en el mensaje de usuario.
- Fase 6: solo handoff Launch Radar — sin guías Calendar/Forecast/Market Hype/YouTube (agente Marketing Guide).
- marketAnalysis: SOLO del corpus o detection.marketInterest. Strings vacíos sin evidencia. topInterestRegions máx 5 (ej. "Palo Alto, California").
- openingBrief: gancho estratégico, 2–4 párrafos. NUNCA repitas la pregunta del usuario textualmente.
- strategicRecommendation: bloque "Mi recomendación" — oportunidades, features, dirección; nunca digas qué vender.
- NUNCA incluyas en campos de texto: "Intel —", "Revisé X con foco en", meta de Groq/fallback/confianza (confidence es interno).
- whatsComing: solo lanzamientos FUTUROS. Indica días/semanas restantes si hay fecha.
- marketContext: SOLO datos verificados del corpus o detection.marketInterest (si source es dataforseo). Nunca inventes % de Trends.
- sources: url, tipo, label breve (titular).
- String vacío "" sin evidencia. NUNCA uses "Sin datos confirmados en este período."
- Nunca inventes modelos, fechas ni specs ausentes en los resultados de búsqueda.
`.trim(),
};

/**
 * @param {'en' | 'es'} locale
 * @param {object} params
 * @param {string} params.brandName
 * @param {string} params.analystBrief
 * @param {string} [params.primaryQuestion]
 * @param {object} params.detection
 * @param {string[]} [params.ignoredTopics]
 */
export function buildCampaignAnalystPrompt(locale, {
  brandName,
  analystBrief,
  primaryQuestion = "",
  detection,
  ignoredTopics = [],
}) {
  const lang = normalizeAnalystLocale(locale);
  const systemContext = loadCampaignAnalystSystemContext(lang)
    .replace(/{brand}/g, brandName);
  const bridge = OUTPUT_BRIDGE[lang];

  const searchCorpus = formatSearchCorpus(detection, lang);
  const sourceCount = detection?.sourceCount
    ?? (Array.isArray(detection?.citations) ? detection.citations.length : 0);

  const launchDate = detection?.launchDate || detection?.estimatedLaunchDate || "";
  const launchDaysRemaining = daysUntilLaunch(launchDate);
  const forwardLaunchSignals = filterForwardLaunchSignals(detection?.launchSignals || []);

  const payload = {
    brandName,
    locale: lang,
    primaryQuestion: primaryQuestion || analystBrief.slice(0, 240),
    analystBrief,
    ignoredTopics,
    horizon: {
      lookbackDays: DEFAULT_RANGE_DAYS,
      forwardOnlyForWhatsComing: true,
      launchDate,
      launchDaysRemaining,
      launchIsFuture: isFutureLaunchDate(launchDate),
    },
    detection: {
      overview: detection?.overview || "",
      deepReport: detection?.deepReport || "",
      campaignActive: Boolean(detection?.campaignActive),
      launchDate,
      announcementDate: detection?.announcementDate || "",
      category: detection?.category || "",
      detectionMode: detection?.detectionMode || "",
      confidence: detection?.confidence ?? null,
      averageIntervalMonths: detection?.averageIntervalMonths ?? null,
      lastLaunchDate: detection?.lastLaunchDate || "",
      launchSignals: forwardLaunchSignals.slice(0, 10),
      citations: (detection?.citations || []).slice(0, 8).map((c) => ({
        title: (c.title || "").slice(0, 120),
        url: c.url || "",
        body: (c.body || "").slice(0, 200),
      })),
      source: detection?.source || "",
      marketInterest: detection?.marketInterest || null,
    },
  };

  const instruction = lang === "es"
    ? `Aquí están los resultados de búsqueda para ${brandName}.\nTienes ${sourceCount} fuentes disponibles.\n\n${searchCorpus}\n\nGenera el reporte completo siguiendo las fases 2–6.\nResponde SOLO JSON según OUTPUT_BRIDGE.`
    : `Here are the search results for ${brandName}.\nYou have ${sourceCount} sources available.\n\n${searchCorpus}\n\nGenerate the full report following phases 2–6.\nRespond with JSON only per OUTPUT_BRIDGE.`;

  const header = lang === "es"
    ? "CONTEXTO ADICIONAL (JSON):"
    : "ADDITIONAL CONTEXT (JSON):";

  return {
    system: `${systemContext}\n\n---\n\n${bridge}`,
    user: `${instruction}\n\n${header}\n${JSON.stringify(payload, null, 2)}`,
  };
}

/** Clears in-memory cache (tests). */
export function clearCampaignAnalystContextCache() {
  for (const key of Object.keys(cachedSystemByLocale)) {
    delete cachedSystemByLocale[key];
  }
}
