import { createDocBlock } from "../docBlocks.js";
import { campaignSignalFieldsFromDetection } from "../campaignSignalFields.js";
import { isoFromDateInput } from "../docDates.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { DEFAULT_RANGE_DAYS } from "../campaignWindow.js";

const CATEGORY_LABELS = {
  en: {
    sports: "Sports",
    physical: "Physical products",
    physical_tech: "Physical + tech",
    innovation: "Innovation",
    other: "General",
  },
  es: {
    sports: "Deportes",
    physical: "Productos físicos",
    physical_tech: "Físico + tech",
    innovation: "Innovación",
    other: "General",
  },
};

const PLACEHOLDER_PATTERNS = [
  /no se pudo determinar/i,
  /sin datos confirmados/i,
  /informe generado desde fallback/i,
  /could not determine/i,
  /not verified in this run/i,
  /no confirmed data/i,
  /report generated from fallback/i,
];

/**
 * @param {string} raw
 * @param {'en' | 'es'} lang
 */
function formatCategoryLabel(raw, lang) {
  const key = (raw || "").trim().toLowerCase();
  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  return labels[key] || (raw?.trim() || "");
}

/**
 * @param {string | null | undefined} launchDate
 */
function toLaunchAtIso(launchDate) {
  if (!launchDate) return null;
  const trimmed = String(launchDate).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isoFromDateInput(trimmed);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * @param {string} [text]
 */
function hasUsableText(text) {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.length < 40 && PLACEHOLDER_PATTERNS.some((re) => re.test(t))) return false;
  return true;
}

/**
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
function formatReportHeader(brandName, lang) {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return lang === "es"
    ? `Intel — ${brandName} · ${iso} · ventana ${DEFAULT_RANGE_DAYS} días (prioridad: lanzamientos futuros)`
    : `Intel — ${brandName} · ${iso} · ${DEFAULT_RANGE_DAYS}-day window (priority: upcoming launches)`;
}

/**
 * @param {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} report
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
function buildReportBodyText(report, detection, brandName, lang) {
  /** @type {string[]} */
  const parts = [];

  parts.push(formatReportHeader(brandName, lang));

  const opening = (report?.openingBrief || "").trim();
  if (hasUsableText(opening)) {
    parts.push(opening);
  }

  const whatsNew = (report?.whatsNew || "").trim();
  if (hasUsableText(whatsNew)) {
    const label = lang === "es" ? "Qué pasó recientemente" : "What happened recently";
    parts.push(`${label}\n\n${whatsNew}`);
  }

  const whatsComing = (report?.whatsComing || "").trim();
  if (hasUsableText(whatsComing)) {
    const label = lang === "es" ? "Qué se viene (solo futuro)" : "What's ahead (future only)";
    parts.push(`${label}\n\n${whatsComing}`);
  }

  const opps = (report?.businessOpportunities || []).filter(hasUsableText);
  if (opps.length) {
    const label = lang === "es" ? "Oportunidades de negocio" : "Business opportunities";
    parts.push(`${label}\n\n${opps.map((o, i) => `${i + 1}. ${o}`).join("\n\n")}`);
  }

  const customers = (report?.customerMarkets || "").trim();
  if (hasUsableText(customers)) {
    const label = lang === "es" ? "Dónde están sus clientes" : "Where their customers are";
    parts.push(`${label}\n\n${customers}`);
  }

  const marketContext = (report?.marketContext || "").trim();
  if (hasUsableText(marketContext)) {
    parts.push(marketContext);
  }

  const cadence = (report?.launchCadence || "").trim();
  if (hasUsableText(cadence)) {
    const label = lang === "es" ? "Cadencia de lanzamientos" : "Launch cadence";
    parts.push(`${label}\n\n${cadence}`);
  }

  const scenario = (report?.launchScenario || "none").toUpperCase();
  const toolGuide = (report?.toolGuide || "").trim();
  if (toolGuide && ["A", "B", "C"].includes(scenario) && hasUsableText(toolGuide)) {
    parts.push(toolGuide);
  }

  const confidence = (report?.overallConfidence || "").trim();
  const reason = (report?.confidenceReason || "").trim();
  if (confidence || reason) {
    const confLabel = lang === "es" ? "Confianza" : "Confidence";
    const reasonLabel = lang === "es" ? "Por qué" : "Why";
    const confLine = [confidence ? `${confLabel}: ${confidence}` : "", reason ? `${reasonLabel}: ${reason}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (confLine) parts.push(confLine);
  }

  const reportSources = report?.sources?.length
    ? report.sources
    : (detection?.citations || []).map((c) => ({
      url: c.url || "",
      tipo: "medio",
      type: "media",
    }));

  const sourceLines = reportSources
    .filter((s) => (s.url || "").trim())
    .slice(0, 12)
    .map((s, idx) => {
      const tipo = (s.tipo || s.type || "").trim();
      return `${idx + 1}. ${s.url}${tipo ? ` (${tipo})` : ""}`;
    });

  if (sourceLines.length) {
    const label = lang === "es" ? "Referencias" : "References";
    parts.push(`${label}\n\n${sourceLines.join("\n")}`);
  }

  return parts.join("\n\n\n");
}

/**
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} [report]
 * @param {string} brandName
 * @param {object} doc
 * @param {'en' | 'es'} lang
 */
export function campaignMetaFromDetection(detection, report, brandName, doc, lang = "en") {
  const fields = campaignSignalFieldsFromDetection(brandName, detection || {});
  const campaignActive = report?.campaignActive !== undefined
    ? Boolean(report.campaignActive)
    : Boolean(fields.campaignActive);

  const launchDate = fields.launchDate || detection?.launchDate || "";

  const categoryRaw = fields.category || detection?.category || "";
  const categoryLabel = formatCategoryLabel(categoryRaw, lang) || doc.category || brandName;

  return {
    campaignActive,
    launchAt: campaignActive && launchDate ? toLaunchAtIso(launchDate) : null,
    category: categoryLabel,
  };
}

/**
 * @param {string} docId
 * @param {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} report
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @returns {boolean}
 */
export function applyAnalystReportToDoc(docId, report, detection, brandName, locale = "en") {
  const store = useDocsStore.getState();
  const doc = store.getDoc(docId);
  if (!doc) return false;

  const lang = locale === "es" ? "es" : "en";
  const bodyText = buildReportBodyText(report, detection, brandName, lang);
  if (!bodyText.trim()) return false;

  const meta = campaignMetaFromDetection(detection, report, brandName, doc, lang);

  store.updateDoc(docId, {
    blocks: [createDocBlock("text", { text: bodyText })],
    campaignActive: meta.campaignActive,
    launchAt: meta.launchAt,
    category: meta.category,
  });

  return true;
}
