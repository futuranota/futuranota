import { completeJson } from "../llmJson.js";
import {
  buildCampaignAnalystPrompt,
  normalizeAnalystLocale,
} from "./campaignAnalystContext.js";
import { daysUntilLaunch, isFutureLaunchDate } from "../../src/lib/campaignWindow.js";
import { filterForwardLaunchSignals } from "../../src/lib/intelSnippetFilter.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

const PLACEHOLDER_RE = [
  /sin datos confirmados/i,
  /no confirmed data/i,
  /informe generado desde fallback/i,
  /report generated from fallback/i,
];

/**
 * @param {string} text
 */
function isPlaceholderText(text) {
  const t = (text || "").trim();
  if (!t) return true;
  return PLACEHOLDER_RE.some((re) => re.test(t));
}

/**
 * @param {unknown} raw
 * @returns {import("../../src/lib/fetchCampaignAnalyst.js").StructuredFact[]}
 */
function normalizeStructuredFacts(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {import("../../src/lib/fetchCampaignAnalyst.js").StructuredFact[]} */
  const out = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const hecho = asString(item.hecho || item.fact);
    const fuente = asString(item.fuente || item.source);
    if (!hecho && !fuente) continue;
    out.push({
      hecho: hecho || asString(item.fact),
      fact: asString(item.fact || item.hecho),
      fecha: asString(item.fecha || item.date),
      date: asString(item.date || item.fecha),
      fuente: fuente || asString(item.source),
      source: asString(item.source || item.fuente),
      confianza: asString(item.confianza || item.confidence),
      confidence: asString(item.confidence || item.confianza),
      categoria: asString(item.categoria || item.category),
      category: asString(item.category || item.categoria),
    });
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {import("../../src/lib/fetchCampaignAnalyst.js").ReportSource[]}
 */
function normalizeSources(raw, detection = {}) {
  /** @type {import("../../src/lib/fetchCampaignAnalyst.js").ReportSource[]} */
  const out = [];
  if (Array.isArray(raw)) {
    for (const item of raw.slice(0, 16)) {
      if (!item || typeof item !== "object") continue;
      const url = asString(item.url);
      if (!url) continue;
      out.push({
        url,
        tipo: asString(item.tipo || item.type),
        type: asString(item.type || item.tipo),
        label: asString(item.label || item.title),
      });
    }
  }
  if (out.length) return out;

  const citations = Array.isArray(detection.citations) ? detection.citations : [];
  return citations.slice(0, 12).map((c) => ({
    url: asString(c?.url),
    tipo: "medio",
    type: "media",
    label: asString(c?.title),
  })).filter((s) => s.url);
}

function legacyOpeningBrief(raw) {
  const guides = raw.educationalGuides && typeof raw.educationalGuides === "object"
    ? raw.educationalGuides
    : {};
  const parts = [
    asString(raw.narrativeBody),
    asString(raw.openingBrief),
    asString(guides.whatsNewVsPrevious || raw.whatsNewVsPrevious),
    asString(raw.strategicCounsel),
  ].filter(Boolean);
  return parts.join("\n\n");
}

function legacyOpportunities(raw) {
  if (!Array.isArray(raw?.productInsights)) return [];
  return raw.productInsights.slice(0, 5).map((item) => {
    if (!item || typeof item !== "object") return "";
    const name = asString(item.name);
    const opp = asString(item.opportunityAnalysis || item.innovationSummary);
    if (!opp) return "";
    return name ? `${name}: ${opp}` : opp;
  }).filter(Boolean);
}

/**
 * @param {unknown} raw
 * @param {object} [detection]
 * @returns {import("../../src/lib/fetchCampaignAnalyst.js").CampaignAnalystReport}
 */
export function normalizeAnalystReport(raw, detection = {}) {
  if (!raw || typeof raw !== "object") {
    return emptyReport();
  }

  let openingBrief = asString(raw.openingBrief);
  if (!openingBrief) {
    openingBrief = legacyOpeningBrief(raw);
  }

  let whatsNew = asString(raw.whatsNew);
  if (isPlaceholderText(whatsNew)) whatsNew = "";

  let whatsComing = asString(raw.whatsComing);
  if (isPlaceholderText(whatsComing)) whatsComing = "";

  let businessOpportunities = asStringArray(raw.businessOpportunities)
    .filter((o) => !isPlaceholderText(o));
  if (!businessOpportunities.length) {
    businessOpportunities = legacyOpportunities(raw);
  }

  const campaignStatus = raw.campaignStatus && typeof raw.campaignStatus === "object"
    ? raw.campaignStatus
    : {};
  const dataSummaryObj = raw.dataSummary && typeof raw.dataSummary === "object"
    ? raw.dataSummary
    : null;

  const launchScenarioRaw = asString(raw.launchScenario).toUpperCase();
  const launchScenario = ["A", "B", "C"].includes(launchScenarioRaw)
    ? launchScenarioRaw
    : "none";

  let toolGuide = asString(raw.toolGuide);
  if (toolGuide && launchScenario === "none") {
    toolGuide = "";
  }

  let strategicRecommendation = asString(raw.strategicRecommendation);
  if (!strategicRecommendation && businessOpportunities.length) {
    strategicRecommendation = businessOpportunities.join("\n\n");
  }
  if (!strategicRecommendation) {
    strategicRecommendation = asString(raw.strategicCounsel);
  }

  return {
    primaryQuestion: asString(raw.primaryQuestion),
    openingBrief,
    structuredFacts: normalizeStructuredFacts(raw.structuredFacts),
    whatsNew,
    whatsComing,
    strategicRecommendation,
    businessOpportunities,
    customerMarkets: isPlaceholderText(raw.customerMarkets) ? "" : asString(raw.customerMarkets),
    launchCadence: isPlaceholderText(raw.launchCadence) ? "" : asString(raw.launchCadence),
    sources: normalizeSources(raw.sources, detection),
    overallConfidence: asString(raw.overallConfidence),
    confidenceReason: asString(raw.confidenceReason),
    marketContext: isPlaceholderText(raw.marketContext) ? "" : asString(raw.marketContext),
    toolGuide,
    launchScenario,
    campaignActive: Boolean(
      campaignStatus.active
      ?? dataSummaryObj?.campaignActive
      ?? detection?.campaignActive,
    ),
  };
}

function emptyReport() {
  return normalizeAnalystReport({});
}

/**
 * @param {'en' | 'es'} lang
 * @param {string} brandName
 * @param {object} detection
 * @param {string} [primaryQuestion]
 */
function isGenericOverview(text) {
  const t = (text || "").trim();
  if (!t) return true;
  return /^informe (compilado|de campañas)/i.test(t)
    || /^resumen desde \d+ fuentes web/i.test(t) && t.length < 120;
}

/**
 * @param {object} detection
 * @param {'en'|'es'} lang
 */
function buildWhatsNewFromDetection(detection, lang) {
  const deepReport = asString(detection?.deepReport);
  if (deepReport) return deepReport;

  const citations = Array.isArray(detection?.citations) ? detection.citations : [];
  if (!citations.length) return "";

  const header = lang === "es"
    ? `Hallazgos desde ${citations.length} fuente(s) consultada(s):`
    : `Findings from ${citations.length} source(s) consulted:`;

  const lines = citations.slice(0, 8).map((c, i) => {
    const title = (c.title || c.domain || `Fuente ${i + 1}`).trim();
    const body = (c.body || "").trim().slice(0, 280);
    const url = (c.url || "").trim();
    return `${i + 1}. ${title}${body ? `\n${body}` : ""}${url ? `\n${url}` : ""}`;
  });

  return `${header}\n\n${lines.join("\n\n")}`;
}

/**
 * @param {object} detection
 * @param {'en'|'es'} lang
 */
function buildWhatsComingFromDetection(detection, lang) {
  const launchDate = asString(detection?.launchDate || detection?.estimatedLaunchDate);
  if (isFutureLaunchDate(launchDate)) {
    const days = daysUntilLaunch(launchDate);
    if (lang === "es") {
      return [
        `${launchDate}. Faltan ${days ?? "?"} días.`,
        "",
        "Ese es el número que importa. Los ciclos de hype no empiezan el día del lanzamiento — empiezan 90 a 120 días antes. Si ya hay fecha confirmada, estás en esa zona.",
      ].join("\n");
    }
    return [
      `${launchDate}. ${days ?? "?"} days remaining.`,
      "",
      "That is the number that matters. Hype cycles start 90–120 days before launch — not on launch day.",
    ].join("\n");
  }

  const signals = filterForwardLaunchSignals(detection?.launchSignals || []);
  if (!signals.length) return "";

  return signals.slice(0, 5).map((sig, i) => {
    const phrase = (sig.phrase || sig.quote || "").trim();
    const hint = (sig.dateHint || "").trim();
    const url = (sig.url || "").trim();
    const datePart = hint ? ` · ${hint}` : "";
    return `${i + 1}. ${phrase || (lang === "es" ? "Señal de expectativa" : "Expectation signal")}${datePart}${url ? `\n${url}` : ""}`;
  }).join("\n\n");
}

/**
 * @param {'en'|'es'} lang
 * @param {string} brandName
 */
function buildFallbackStrategicRecommendation(lang, brandName) {
  if (lang === "es") {
    return [
      "Según este informe, la dirección siempre depende del proyecto que quieras construir — pero hay una constante: las tendencias nuevas que sugieren los medios son tu mejor punto de entrada.",
      "Los features nuevos de un producto en ciclo de lanzamiento no solo definen el producto — definen qué busca, qué consume, y qué necesita su audiencia en los meses previos.",
      "Siempre puedes encontrar inspiración en esas señales para resolver un problema, crear una comodidad, o capitalizar un interés que todavía nadie está atendiendo bien.",
    ].join("\n\n");
  }
  return [
    "Based on this report, direction always depends on the project you want to build — but one constant remains: new trends surfaced by media are your best entry point.",
    "New features in a launch-cycle product define not just the product — they define what the audience searches for, consumes, and needs in the months before release.",
    "Use these signals for inspiration to solve a problem, create convenience, or capitalize on interest nobody is serving well yet.",
  ].join("\n\n");
}

/**
 * @param {object} detection
 * @param {'en'|'es'} lang
 */
function citationsToStructuredFacts(detection, lang) {
  const citations = Array.isArray(detection?.citations) ? detection.citations : [];
  return citations.slice(0, 8).map((c) => ({
    hecho: (c.body || c.title || "").trim().slice(0, 240),
    fact: (c.body || c.title || "").trim().slice(0, 240),
    fuente: (c.url || "").trim(),
    source: (c.url || "").trim(),
    confianza: lang === "es" ? "media" : "medium",
    confidence: lang === "es" ? "media" : "medium",
    categoria: "medio",
    category: "media",
  })).filter((f) => f.hecho || f.fuente);
}

/**
 * Merge detection corpus into a thin analyst report.
 * @param {import("../../src/lib/fetchCampaignAnalyst.js").CampaignAnalystReport} report
 * @param {object} detection
 * @param {'en'|'es'} lang
 */
export function enrichReportFromDetection(report, detection, lang) {
  const enriched = { ...report };

  const overview = asString(detection?.overview);
  if (!asString(enriched.openingBrief) || isGenericOverview(enriched.openingBrief)) {
    if (overview && !isGenericOverview(overview)) {
      enriched.openingBrief = overview;
    }
  }

  if (!asString(enriched.whatsNew)) {
    enriched.whatsNew = buildWhatsNewFromDetection(detection, lang);
  }

  if (!asString(enriched.whatsComing)) {
    enriched.whatsComing = buildWhatsComingFromDetection(detection, lang);
  }

  if (!enriched.structuredFacts?.length) {
    enriched.structuredFacts = citationsToStructuredFacts(detection, lang);
  }

  if (!asString(enriched.strategicRecommendation)) {
    enriched.strategicRecommendation = buildFallbackStrategicRecommendation(lang, detection?.brandName || "");
  }

  if (!enriched.sources?.length) {
    enriched.sources = normalizeSources([], detection);
  }

  return normalizeAnalystReport(enriched, detection);
}

/**
 * @param {'en' | 'es'} lang
 * @param {string} brandName
 * @param {object} detection
 * @param {string} [primaryQuestion]
 */
function buildFallbackOpeningBrief(lang, brandName, detection) {
  const overviewRaw = (detection?.overview || "").trim();
  const overview = isGenericOverview(overviewRaw) ? "" : overviewRaw;
  const launchDate = asString(detection?.launchDate || detection?.estimatedLaunchDate);
  const daysLeft = daysUntilLaunch(launchDate);
  const futureLaunch = isFutureLaunchDate(launchDate);

  if (lang === "es") {
    const parts = [];
    if (overview) {
      parts.push(overview);
    } else {
      parts.push(`${brandName} movió ficha en múltiples frentes este trimestre según las fuentes consultadas.`);
    }
    if (futureLaunch && daysLeft !== null) {
      parts.push(
        `${brandName} no está en modo silencio — está en modo cuenta regresiva. `
        + `Hay una fecha de lanzamiento futura (${launchDate}); faltan aproximadamente ${daysLeft} días. `
        + "Eso no es un rumor — es una señal accionable, y el mercado ya empieza a reaccionar.",
      );
    }
    return parts.join("\n\n");
  }

  const parts = [];
  if (overview) {
    parts.push(overview);
  } else {
    parts.push(`${brandName} moved on multiple fronts this quarter according to sources consulted.`);
  }
  if (futureLaunch && daysLeft !== null) {
    parts.push(
      `${brandName} is not in silent mode — it's in countdown mode. `
      + `Future launch date (${launchDate}); about ${daysLeft} days remain. `
      + "That is actionable signal, and the market is already reacting.",
    );
  }
  return parts.join("\n\n");
}

/**
 * @param {'en' | 'es'} locale
 * @param {string} brandName
 * @param {object} detection
 * @param {string} [primaryQuestion]
 */
export function buildFallbackAnalystReport(locale, brandName, detection, primaryQuestion = "") {
  const lang = normalizeAnalystLocale(locale);
  const openingBrief = buildFallbackOpeningBrief(lang, brandName, detection);
  const sources = normalizeSources([], detection);

  const launchDate = asString(detection?.launchDate || detection?.estimatedLaunchDate);
  let launchScenario = "none";
  if (isFutureLaunchDate(launchDate)) {
    launchScenario = "A";
  } else if (Array.isArray(detection?.launchSignals) && detection.launchSignals.length > 0) {
    launchScenario = "B";
  } else if (Boolean(detection?.campaignActive)) {
    launchScenario = "C";
  }

  return normalizeAnalystReport({
    primaryQuestion: primaryQuestion || (lang === "es" ? `Intel sobre ${brandName}` : `Intel on ${brandName}`),
    openingBrief,
    structuredFacts: citationsToStructuredFacts(detection, lang),
    whatsNew: buildWhatsNewFromDetection(detection, lang),
    whatsComing: buildWhatsComingFromDetection(detection, lang),
    strategicRecommendation: buildFallbackStrategicRecommendation(lang, brandName),
    businessOpportunities: [],
    customerMarkets: "",
    launchCadence: detection?.averageIntervalMonths
      ? (lang === "es"
        ? `Patrón histórico estimado: cada ${detection.averageIntervalMonths} meses (desde detección).`
        : `Estimated historical pattern: every ${detection.averageIntervalMonths} months (from detection).`)
      : "",
    sources,
    overallConfidence: lang === "es" ? "Baja" : "Low",
    confidenceReason: lang === "es"
      ? "Groq no respondió en este run; texto armado desde fuentes de detección."
      : "Groq did not respond this run; text built from detection sources.",
    marketContext: "",
    toolGuide: "",
    launchScenario,
    source: "fallback",
  }, detection);
}

function finalizeAnalystReport(report, detection, lang, source) {
  const enriched = enrichReportFromDetection(report, detection, lang);
  return { ...enriched, source };
}

function detectionIsUsableForCorpusReport(detection) {
  const cites = Array.isArray(detection?.citations) ? detection.citations.length : 0;
  const deep = asString(detection?.deepReport).length;
  const overview = asString(detection?.overview).length;
  return cites >= 2 && (deep >= 80 || overview >= 40);
}

/**
 * @param {import("../../src/lib/fetchCampaignAnalyst.js").CampaignAnalystReport} report
 */
function reportHasContent(report) {
  if (!report) return false;
  return Boolean(
    asString(report.openingBrief)
    || asString(report.strategicRecommendation)
    || asString(report.whatsNew)
    || asString(report.whatsComing)
    || asString(report.customerMarkets)
    || asString(report.launchCadence)
    || asString(report.marketContext)
    || (report.businessOpportunities?.length > 0)
    || (report.structuredFacts?.length > 0),
  );
}

/**
 * @param {object} params
 * @param {'en' | 'es'} [params.locale]
 * @param {string} params.brandName
 * @param {string} params.analystBrief
 * @param {string} [params.primaryQuestion]
 * @param {object} params.detection
 * @param {string[]} [params.ignoredTopics]
 */
export async function runCampaignAnalyst({
  locale = "en",
  brandName,
  analystBrief,
  primaryQuestion = "",
  detection,
  ignoredTopics = [],
}) {
  const lang = normalizeAnalystLocale(locale);
  const fallback = buildFallbackAnalystReport(lang, brandName, detection, primaryQuestion);

  if (detectionIsUsableForCorpusReport(detection)) {
    const corpusReport = finalizeAnalystReport(fallback, detection, lang, "detection-corpus");
    if (reportHasContent(corpusReport)) {
      return corpusReport;
    }
  }

  if (!process.env.GROQ_API_KEY) {
    return finalizeAnalystReport(fallback, detection, lang, "fallback");
  }

  const { system, user } = buildCampaignAnalystPrompt(lang, {
    brandName,
    analystBrief,
    primaryQuestion,
    detection,
    ignoredTopics,
  });

  const llm = await completeJson(user, { system, temperature: 0.7 });

  if (!llm?.data || typeof llm.data !== "object") {
    return finalizeAnalystReport(fallback, detection, lang, "fallback-llm-empty");
  }

  const normalized = normalizeAnalystReport(llm.data, detection);

  if (!reportHasContent(normalized)) {
    return finalizeAnalystReport(fallback, detection, lang, "fallback-llm-empty");
  }

  return finalizeAnalystReport(normalized, detection, lang, "groq");
}
