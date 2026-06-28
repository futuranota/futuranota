import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatCitationsForPrompt, formatResultsForPrompt } from "../discovery/brandIntelligenceSearch.js";
import { DEFAULT_RANGE_DAYS } from "../../src/lib/campaignWindow.js";
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
  "businessOpportunities": string[],
  "customerMarkets": string,
  "launchCadence": string,
  "sources": [{ "url": string, "type": "official"|"media"|"rumor"|"" }],
  "overallConfidence": "High"|"Medium"|"Low"|"",
  "confidenceReason": string,
  "marketContext": string,
  "toolGuide": string,
  "launchScenario": "A"|"B"|"C"|"none"|""
}

Rules:
- Phases 2–6 only; search results are in the user message.
- openingBrief is required — natural prose, 2–4 paragraphs, direct voice.
- Empty string "" or [] when no evidence. NEVER use "No confirmed data in this period."
- whatsComing: FUTURE launches only (date after today). State weeks/months remaining when known.
- businessOpportunities: 0–5 items; minimum 2 only when evidence supports it.
- toolGuide: full Phase 6 block text only if launchScenario is A, B, or C; otherwise "".
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
  "businessOpportunities": string[],
  "customerMarkets": string,
  "launchCadence": string,
  "sources": [{ "url": string, "tipo": "oficial"|"medio"|"rumor"|"" }],
  "overallConfidence": "Alta"|"Media"|"Baja"|"",
  "confidenceReason": string,
  "marketContext": string,
  "toolGuide": string,
  "launchScenario": "A"|"B"|"C"|"none"|""
}

Reglas:
- Fases 2–6 solamente; los resultados de búsqueda vienen en el mensaje de usuario.
- openingBrief es obligatorio — prosa natural, 2–4 párrafos, voz directa.
- String vacío "" o [] sin evidencia. NUNCA uses "Sin datos confirmados en este período."
- whatsComing: solo lanzamientos FUTUROS (fecha posterior a hoy). Indica semanas/meses restantes si hay fecha.
- businessOpportunities: 0–5 ítems; mínimo 2 solo si la evidencia lo permite.
- toolGuide: bloque completo Fase 6 solo si launchScenario es A, B o C; si no, "".
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
