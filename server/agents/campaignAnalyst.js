import { completeJson } from "../llmJson.js";
import {
  buildCampaignAnalystPrompt,
  normalizeAnalystLocale,
} from "./campaignAnalystContext.js";
import { DEFAULT_RANGE_DAYS, daysUntilLaunch, isFutureLaunchDate } from "../../src/lib/campaignWindow.js";
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
      });
    }
  }
  if (out.length) return out;

  const citations = Array.isArray(detection.citations) ? detection.citations : [];
  return citations.slice(0, 12).map((c) => ({
    url: asString(c?.url),
    tipo: "medio",
    type: "media",
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

  return {
    primaryQuestion: asString(raw.primaryQuestion),
    openingBrief,
    structuredFacts: normalizeStructuredFacts(raw.structuredFacts),
    whatsNew,
    whatsComing,
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
  const signals = filterForwardLaunchSignals(detection?.launchSignals || []);
  if (!signals.length) {
    const launchDate = asString(detection?.launchDate || detection?.estimatedLaunchDate);
    if (isFutureLaunchDate(launchDate)) {
      const days = daysUntilLaunch(launchDate);
      return lang === "es"
        ? `Lanzamiento futuro detectado: ${launchDate}${days !== null ? ` (faltan ~${days} días)` : ""}.`
        : `Future launch detected: ${launchDate}${days !== null ? ` (~${days} days remaining)` : ""}.`;
    }
    return "";
  }

  return signals.slice(0, 5).map((sig, i) => {
    const phrase = (sig.phrase || sig.quote || "").trim();
    const hint = (sig.dateHint || "").trim();
    const url = (sig.url || "").trim();
    const datePart = hint ? (lang === "es" ? ` · ${hint}` : ` · ${hint}`) : "";
    return `${i + 1}. ${phrase || (lang === "es" ? "Señal de expectativa" : "Expectation signal")}${datePart}${url ? `\n${url}` : ""}`;
  }).join("\n\n");
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
function buildFallbackOpeningBrief(lang, brandName, detection, primaryQuestion) {
  const citations = Array.isArray(detection?.citations) ? detection.citations : [];
  const overviewRaw = (detection?.overview || "").trim();
  const overview = isGenericOverview(overviewRaw) ? "" : overviewRaw;
  const launchDate = asString(detection?.launchDate || detection?.estimatedLaunchDate);
  const daysLeft = daysUntilLaunch(launchDate);
  const futureLaunch = isFutureLaunchDate(launchDate);

  const citeLines = citations.slice(0, 5).map((c, i) => {
    const title = (c.title || c.domain || `Fuente ${i + 1}`).trim();
    return `${title} (${c.url || ""})`;
  });

  if (lang === "es") {
    const parts = [
      primaryQuestion
        ? `Revisé ${brandName} con foco en: ${primaryQuestion}.`
        : `Revisé ${brandName} en una ventana de ${DEFAULT_RANGE_DAYS} días, priorizando lo que aún no ocurrió.`,
    ];
    if (overview) parts.push(overview);
    else if (citeLines.length) {
      parts.push(`Encontré ${citations.length} fuente(s). Lo más relevante: ${citeLines.slice(0, 3).join("; ")}.`);
    } else {
      parts.push("La búsqueda no devolvió fuentes útiles en este run — puede ser un tema de API o de sesión.");
    }
    if (futureLaunch && daysLeft !== null) {
      parts.push(`Hay una fecha de lanzamiento futura (${launchDate}); faltan aproximadamente ${daysLeft} días. Eso es la ventana accionable.`);
    } else if (Array.isArray(detection?.launchSignals) && detection.launchSignals.length) {
      parts.push("Hay señales de expectativa (rumor o anuncio parcial), pero sin fecha futura confirmada en las fuentes.");
    } else {
      parts.push("No aparece un lanzamiento futuro fechado en las fuentes consultadas; el silencio o la falta de fecha también informa.");
    }
    return parts.join("\n\n");
  }

  const parts = [
    primaryQuestion
      ? `I reviewed ${brandName} focusing on: ${primaryQuestion}.`
      : `I reviewed ${brandName} over a ${DEFAULT_RANGE_DAYS}-day window, prioritizing what has not happened yet.`,
  ];
  if (overview) parts.push(overview);
  else if (citeLines.length) {
    parts.push(`Found ${citations.length} source(s). Most relevant: ${citeLines.slice(0, 3).join("; ")}.`);
  } else {
    parts.push("Search returned no useful sources this run — check API keys or session.");
  }
  if (futureLaunch && daysLeft !== null) {
    parts.push(`There is a future launch date (${launchDate}); about ${daysLeft} days remain. That is the actionable window.`);
  } else if (Array.isArray(detection?.launchSignals) && detection.launchSignals.length) {
    parts.push("There are expectation signals (rumor or partial announcement) but no confirmed future date in sources.");
  } else {
    parts.push("No dated future launch appears in sources consulted; silence or missing dates also inform.");
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
  const openingBrief = buildFallbackOpeningBrief(lang, brandName, detection, primaryQuestion);
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
