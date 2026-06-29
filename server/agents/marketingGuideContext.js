import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildMarketContextBundle } from "../../src/lib/agents/marketContextBundle.js";
import { daysUntilLaunch, isFutureLaunchDate } from "../../src/lib/campaignWindow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.join(__dirname, "../../content/agents");

/** @type {Record<string, string | null>} */
const cachedSystemByLocale = {};

/**
 * @param {'en' | 'es'} [locale]
 * @returns {'en' | 'es'}
 */
export function normalizeGuideLocale(locale) {
  return locale === "es" ? "es" : "en";
}

/**
 * @param {'en' | 'es'} [locale]
 * @returns {string}
 */
export function loadMarketingGuideSystemContext(locale = "en") {
  const lang = normalizeGuideLocale(locale);
  if (cachedSystemByLocale[lang] !== undefined) {
    return cachedSystemByLocale[lang] || "";
  }
  const filePath = path.join(AGENTS_DIR, `marketing-guide.${lang}.md`);
  try {
    cachedSystemByLocale[lang] = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    cachedSystemByLocale[lang] = "";
  }
  return cachedSystemByLocale[lang] || "";
}

const OUTPUT_BRIDGE = {
  en: `
OUTPUT — valid JSON only (no markdown wrapper). All text fields in English.

{
  "brandContextHook": string,
  "openingHook": string,
  "calendarGuide": { "title": string, "body": string, "action": string },
  "forecastGuide": { "title": string, "body": string, "action": string },
  "marketHypeGuide": { "title": string, "body": string, "action": string },
  "searchIntentGuide": { "title": string, "body": string, "action": string },
  "youtubeGuide": { "title": string, "body": string, "action": string },
  "outcomesClosing": string
}

Rules:
- ALWAYS fill all 5 tool sections + outcomesClosing (independent of analyst).
- brandContextHook: only when marketContextBundle.hasVerifiedData; tie region/interest to {brand} opportunity index. Else "".
- Product-agnostic: never tell user what to sell or build.
`.trim(),
  es: `
SALIDA — solo JSON válido (sin markdown). Texto en español.

{
  "brandContextHook": string,
  "openingHook": string,
  "calendarGuide": { "title": string, "body": string, "action": string },
  "forecastGuide": { "title": string, "body": string, "action": string },
  "marketHypeGuide": { "title": string, "body": string, "action": string },
  "searchIntentGuide": { "title": string, "body": string, "action": string },
  "youtubeGuide": { "title": string, "body": string, "action": string },
  "outcomesClosing": string
}

Reglas:
- SIEMPRE llená las 5 herramientas + outcomesClosing (independiente del analista).
- brandContextHook: solo si marketContextBundle.hasVerifiedData; vinculá región/interés con índice de oportunidad de {brand}. Si no, "".
- Product-agnostic: nunca digas qué vender o construir.
`.trim(),
};

/**
 * @param {object} report
 * @returns {object}
 */
function slimAnalystReportForGuide(report) {
  if (!report || typeof report !== "object") return {};
  return {
    openingBrief: (report.openingBrief || "").slice(0, 1200),
    whatsNew: (report.whatsNew || "").slice(0, 800),
    whatsComing: (report.whatsComing || "").slice(0, 800),
    strategicRecommendation: (report.strategicRecommendation || "").slice(0, 600),
    marketContext: (report.marketContext || "").slice(0, 400),
    customerMarkets: (report.customerMarkets || "").slice(0, 400),
    marketAnalysis: report.marketAnalysis || null,
    sources: (report.sources || []).slice(0, 6).map((s) => ({
      url: s.url || "",
      label: (s.label || "").slice(0, 80),
    })),
  };
}

/**
 * @param {'en' | 'es'} locale
 * @param {object} params
 */
export function buildMarketingGuidePrompt(locale, {
  brandName,
  detection = {},
  analystReport = {},
  marketContextBundle = null,
}) {
  const lang = normalizeGuideLocale(locale);
  const systemContext = loadMarketingGuideSystemContext(lang)
    .replace(/{brand}/g, brandName);
  const bridge = OUTPUT_BRIDGE[lang];

  const launchDate = detection?.launchDate || detection?.estimatedLaunchDate || "";
  const bundle = marketContextBundle
    || buildMarketContextBundle(analystReport, detection, brandName);

  const payload = {
    brandName,
    locale: lang,
    marketContextBundle: bundle,
    detection: {
      campaignActive: Boolean(detection?.campaignActive),
      launchDate,
      announcementDate: detection?.announcementDate || "",
      launchDaysRemaining: daysUntilLaunch(launchDate),
      launchIsFuture: isFutureLaunchDate(launchDate),
      detectionMode: detection?.detectionMode || "",
      overview: (detection?.overview || "").slice(0, 400),
    },
    analystReport: slimAnalystReportForGuide(analystReport),
  };

  const instruction = lang === "es"
    ? `Generá el Playbook de Futura Nota para la señal de ${brandName}.\nResponde SOLO JSON según OUTPUT_BRIDGE.`
    : `Generate the Futura Nota Playbook for the ${brandName} signal.\nRespond with JSON only per OUTPUT_BRIDGE.`;

  const header = lang === "es" ? "CONTEXTO (JSON):" : "CONTEXT (JSON):";

  return {
    system: `${systemContext}\n\n---\n\n${bridge}`,
    user: `${instruction}\n\n${header}\n${JSON.stringify(payload, null, 2)}`,
  };
}

/** Clears in-memory cache (tests). */
export function clearMarketingGuideContextCache() {
  for (const key of Object.keys(cachedSystemByLocale)) {
    delete cachedSystemByLocale[key];
  }
}
