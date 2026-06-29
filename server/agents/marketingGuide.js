import { completeJson } from "../llmJson.js";
import {
  buildMarketingGuidePrompt,
  normalizeGuideLocale,
} from "./marketingGuideContext.js";
import { buildMarketContextBundle, pickPrimaryInterestRegion } from "../../src/lib/agents/marketContextBundle.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} raw
 * @returns {{ title: string, body: string, action: string }}
 */
function normalizeToolSection(raw) {
  if (!raw || typeof raw !== "object") {
    return { title: "", body: "", action: "" };
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  return {
    title: asString(obj.title),
    body: asString(obj.body),
    action: asString(obj.action),
  };
}

/**
 * @typedef {Object} MarketingGuideToolSection
 * @property {string} title
 * @property {string} body
 * @property {string} action
 */

/**
 * @typedef {Object} MarketingGuideReport
 * @property {string} brandContextHook
 * @property {string} openingHook
 * @property {MarketingGuideToolSection} calendarGuide
 * @property {MarketingGuideToolSection} forecastGuide
 * @property {MarketingGuideToolSection} marketHypeGuide
 * @property {MarketingGuideToolSection} searchIntentGuide
 * @property {MarketingGuideToolSection} youtubeGuide
 * @property {string} outcomesClosing
 * @property {string} [source]
 */

/**
 * @param {unknown} raw
 * @param {'en' | 'es'} lang
 * @returns {MarketingGuideReport}
 */
export function normalizeMarketingGuideReport(raw, lang) {
  const obj = raw && typeof raw === "object" ? raw : {};
  return {
    brandContextHook: asString(obj.brandContextHook),
    openingHook: asString(obj.openingHook),
    calendarGuide: normalizeToolSection(obj.calendarGuide),
    forecastGuide: normalizeToolSection(obj.forecastGuide),
    marketHypeGuide: normalizeToolSection(obj.marketHypeGuide),
    searchIntentGuide: normalizeToolSection(obj.searchIntentGuide),
    youtubeGuide: normalizeToolSection(obj.youtubeGuide),
    outcomesClosing: asString(obj.outcomesClosing),
    source: asString(obj.source) || "groq",
  };
}

/**
 * @param {'en' | 'es'} lang
 * @param {string} brandName
 * @param {object} detection
 * @param {object} [marketContextBundle]
 * @returns {MarketingGuideReport}
 */
export function buildFallbackMarketingGuideReport(lang, brandName, detection, marketContextBundle = null) {
  const brand = brandName.trim() || "the brand";
  const launchDate = asString(detection?.launchDate || detection?.estimatedLaunchDate);
  const bundle = marketContextBundle || buildMarketContextBundle({}, detection || {}, brand);
  const region = pickPrimaryInterestRegion(bundle);

  const brandContextHook = region && bundle.hasVerifiedData
    ? (lang === "es"
      ? `Al entender que tu marca seleccionada **${brand}** muestra mayor índice de interés en **${region}**, esto sugiere que en su próximo movimiento una parte relevante de su audiencia podría concentrarse ahí — úsalo como señal geográfica, no como dato de ventas confirmado.`
      : `Understanding that your selected brand **${brand}** shows its highest interest index in **${region}**, this suggests that for their next move a meaningful share of their audience may cluster there — use it as a geographic signal, not confirmed sales data.`)
    : "";

  if (lang === "es") {
    return {
      brandContextHook,
      openingHook: `Este Playbook enseña **cómo usar Futura Nota** paso a paso${bundle.hasVerifiedData ? `, con contexto de la señal de ${brand}` : ""}. No necesitás saber qué producto vas a lanzar.`,
      calendarGuide: {
        title: "Calendar",
        body: launchDate
          ? `Sincronizá la fecha ${launchDate} con Calendar. Los marcos 7d · 15d · 31d buscan eventos importantes desde esa fecha hacia adelante — un mapa de oportunidades más amplio que el día del launch.`
          : "Cuando Launch Radar confirme una fecha, anclala en Calendar. Los marcos 7d · 15d · 31d expanden el scope de eventos relevantes desde ese punto.",
        action: "Intel → Calendar → elegí 15d desde la fecha de lanzamiento.",
      },
      forecastGuide: {
        title: "Forecast",
        body: "Forecast cubre solo ~5 días desde hoy. Sirve cuando el evento está cerca: contenido de último momento o decisiones tácticas según clima.",
        action: "Usá Forecast la semana previa al evento, no meses antes.",
      },
      marketHypeGuide: {
        title: "Market Hype",
        body: `Market Hype muestra dónde ${brand} concentra atención ahora — índice de dónde vive su audiencia más caliente y dónde vos deberías invertir atención cuando tengas producto y contenido.`,
        action: "Intel → Market Hype → estudiar mix de canales.",
      },
      searchIntentGuide: {
        title: "Search Intent",
        body: `Las tendencias de búsqueda revelan qué busca la audiencia de ${brand} — qué escribir, promocionar y qué pain points resonan.`,
        action: "Tomá las top keywords del panel y usalas como titulares o preguntas de investigación.",
      },
      youtubeGuide: {
        title: "YouTube",
        body: `Pegá videos oficiales o de cobertura de ${brand} en Intel → YouTube. Mirá in-app y tomá notas visuales — tu espacio de aprendizaje dentro de Futura Nota.`,
        action: "Pegar un link de YouTube de las fuentes del informe → notas con timestamps.",
      },
      outcomesClosing: "Al conectar estas herramientas podés crear mejores blogs, titulares para redes con más interés, y entender las necesidades del público con antelación. Futura Nota detecta eventos futuros — este Playbook te muestra cómo actuar sobre la señal de "
        + `${brand}.`,
      source: "fallback",
    };
  }

  return {
    brandContextHook,
    openingHook: `This Playbook teaches **how to use Futura Nota** step by step${bundle.hasVerifiedData ? `, with context from the ${brand} signal` : ""}. You don't need to know your product yet.`,
    calendarGuide: {
      title: "Calendar",
      body: launchDate
        ? `Sync launch date ${launchDate} with Calendar. The 7d · 15d · 31d frames search important events forward from that anchor — a wider opportunity map than launch day alone.`
        : "When Launch Radar confirms a date, anchor it in Calendar. The 7d · 15d · 31d frames expand relevant events from that point.",
      action: "Intel → Calendar → pick 15d from the launch date.",
    },
    forecastGuide: {
      title: "Forecast",
      body: "Forecast covers only ~5 days from today. Use it when the event is close: last-minute content or tactical weather-driven decisions.",
      action: "Use Forecast the week before the event, not months ahead.",
    },
    marketHypeGuide: {
      title: "Market Hype",
      body: `Market Hype shows where ${brand} concentrates attention now — an index of where their hottest audience lives and where you should invest attention once you have product and content.`,
      action: "Intel → Market Hype → study channel mix.",
    },
    searchIntentGuide: {
      title: "Search Intent",
      body: `Search trends reveal what ${brand}'s audience looks for — what to write, promote, and which pain points resonate.`,
      action: "Take top keywords from the panel as headlines or research questions.",
    },
    youtubeGuide: {
      title: "YouTube",
      body: `Paste official or coverage videos about ${brand} in Intel → YouTube. Watch in-app and take visual notes — your learning space inside Futura Nota.`,
      action: "Paste a YouTube link from the analyst sources → timestamped notes.",
    },
    outcomesClosing: "Connecting these tools helps you write better blogs, craft stronger social headlines, and understand audience needs ahead of time. Futura Nota detects future events — this Playbook shows you how to act on the "
      + `${brand} signal.`,
    source: "fallback",
  };
}

/**
 * @param {MarketingGuideReport} report
 */
function reportHasContent(report) {
  return Boolean(
    asString(report?.openingHook)
    || asString(report?.calendarGuide?.body)
    || asString(report?.outcomesClosing),
  );
}

/**
 * @param {object} params
 * @param {'en' | 'es'} [params.locale]
 * @param {string} params.brandName
 * @param {object} [params.detection]
 * @param {object} [params.analystReport]
 * @param {object} [params.marketContextBundle]
 * @returns {Promise<MarketingGuideReport>}
 */
export async function runMarketingGuide({
  locale = "en",
  brandName,
  detection = {},
  analystReport = {},
  marketContextBundle = null,
}) {
  const lang = normalizeGuideLocale(locale);
  const brand = asString(brandName);
  if (!brand) {
    throw new Error("brandName is required");
  }

  const bundle = marketContextBundle
    || buildMarketContextBundle(analystReport, detection, brand);
  const fallback = buildFallbackMarketingGuideReport(lang, brand, detection, bundle);

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  const { system, user } = buildMarketingGuidePrompt(lang, {
    brandName: brand,
    detection,
    analystReport,
    marketContextBundle: bundle,
  });

  const llm = await completeJson(user, { system });
  if (!llm?.data || typeof llm.data !== "object") {
    return { ...fallback, source: "fallback-llm-empty" };
  }

  const normalized = normalizeMarketingGuideReport(llm.data, lang);
  if (!reportHasContent(normalized)) {
    return { ...fallback, source: "fallback-empty" };
  }

  return { ...normalized, source: llm.provider || "groq" };
}
