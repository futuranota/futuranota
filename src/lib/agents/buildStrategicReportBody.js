import { isFutureLaunchDate } from "../campaignWindow.js";

/**
 * @param {'en' | 'es'} locale
 * @param {Date} [now]
 */
export function getTimeGreeting(locale, now = new Date()) {
  const hour = now.getHours();
  const lang = locale === "es" ? "es" : "en";

  if (lang === "es") {
    if (hour >= 5 && hour < 12) return "buenos días";
    if (hour >= 12 && hour < 20) return "buenas tardes";
    return "buenas noches";
  }

  if (hour >= 5 && hour < 12) return "good morning";
  if (hour >= 12 && hour < 18) return "good afternoon";
  return "good evening";
}

/**
 * @param {'en' | 'es'} locale
 * @param {Date} [now]
 */
export function formatReportGreeting(locale, now = new Date()) {
  const greeting = getTimeGreeting(locale, now);
  return locale === "es"
    ? `Hey, ${greeting}, aquí te dejo el reporte de lo que me pediste. Esto fue lo que pude encontrar.`
    : `Hey, ${greeting}, here's the report on what you asked for. This is what I found.`;
}

/**
 * @param {string} url
 */
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return (url || "").replace(/^https?:\/\//i, "").split("/")[0] || "";
  }
}

/**
 * @param {string} tipo
 * @param {'en' | 'es'} lang
 */
function formatSourceType(tipo, lang) {
  const t = (tipo || "").trim().toLowerCase();
  if (lang === "es") {
    if (t === "oficial" || t === "official") return "oficial";
    if (t === "rumor") return "rumor";
    return "medio";
  }
  if (t === "oficial" || t === "official") return "official";
  if (t === "rumor") return "rumor";
  return "media";
}

/**
 * @param {string} url
 * @param {string} [brandHost]
 */
function isOfficialUrl(url, brandHost = "") {
  const domain = domainFromUrl(url).toLowerCase();
  if (!domain) return false;
  if (brandHost && domain.includes(brandHost.toLowerCase())) return true;
  return /newsroom|press|investor|\.com\/news|newswire/i.test(url);
}

/**
 * @param {object} citation
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
export function formatSourceLine(citation, brandName, lang) {
  const url = (citation?.url || "").trim();
  if (!url) return "";

  const domain = (citation?.domain || domainFromUrl(url)).replace(/^www\./i, "");
  const title = (citation?.title || citation?.label || domain || "Fuente").trim().slice(0, 120);
  const brandSlug = (brandName || "").trim().toLowerCase().replace(/\s+/g, "");
  const brandHost = brandSlug ? `${brandSlug}.com` : "";
  const tipo = citation?.tipo || citation?.type
    || (isOfficialUrl(url, brandHost) ? (lang === "es" ? "oficial" : "official") : (lang === "es" ? "medio" : "media"));
  const typeLabel = formatSourceType(tipo, lang);

  return `· ${domain} · ${title} (${typeLabel})\n  [${domain}](${url})`;
}

/**
 * @param {object|null|undefined} marketInterest
 * @param {'en' | 'es'} lang
 */
export function formatMarketInterestBlock(marketInterest, lang) {
  if (!marketInterest || marketInterest.source !== "dataforseo") return "";

  const pct = marketInterest.interestChangePercent;
  const regions = Array.isArray(marketInterest.topRegions) ? marketInterest.topRegions : [];
  const keyword = (marketInterest.keyword || "").trim();

  if (pct === null && !regions.length) return "";

  if (lang === "es") {
    const parts = [];
    if (pct !== null && keyword) {
      parts.push(
        `Según Google Trends (DataForSEO), el interés de búsqueda por "${keyword}" varió aproximadamente ${pct > 0 ? "+" : ""}${pct}% en la ventana analizada.`,
      );
    }
    if (regions.length) {
      parts.push(`Mayor concentración de interés en: ${regions.slice(0, 5).join(", ")}.`);
    }
    return parts.join(" ");
  }

  const parts = [];
  if (pct !== null && keyword) {
    parts.push(
      `According to Google Trends (DataForSEO), search interest for "${keyword}" shifted roughly ${pct > 0 ? "+" : ""}${pct}% in the analyzed window.`,
    );
  }
  if (regions.length) {
    parts.push(`Highest interest concentration: ${regions.slice(0, 5).join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Recommendation copy for Launch Radar (manual step — not auto-applied by Analyst).
 * @param {string} brandName
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse|null|undefined} detection
 * @param {'en' | 'es'} lang
 */
export function formatLaunchRadarRecommendation(brandName, detection, lang) {
  const mode = detection?.detectionMode;
  const brand = (brandName || "").trim() || (lang === "es" ? "la marca" : "the brand");

  if (mode === "confirmed_campaign") {
    const launchDate = detection?.launchDate;
    if (!launchDate || !isFutureLaunchDate(launchDate)) return "";

    return lang === "es"
      ? `Ok — ya recopilé fechas de lanzamiento para **${brand}** (${launchDate}). Para activar la cuenta regresiva en **Launch Radar**, andá a Intel → **Launch radar** y activá el switch. Ahí vas a ver el timeline con los datos de este informe.`
      : `Ok — I already collected launch dates for **${brand}** (${launchDate}). To activate the countdown in **Launch Radar**, open Intel → **Launch radar** and turn on the switch. You'll see the timeline with data from this report.`;
  }

  if (mode === "cadence_only") {
    return lang === "es"
      ? `Ok — ya estimé la cadencia histórica de **${brand}**. Para proyectar el próximo ciclo en **Launch Radar**, andá a Intel → **Launch radar** y activá el switch cuando quieras cargar estos datos.`
      : `Ok — I already estimated **${brand}**'s historical cadence. To project the next cycle in **Launch Radar**, open Intel → **Launch radar** and turn on the switch when you want to load this data.`;
  }

  if (mode === "heuristic_estimate") {
    return lang === "es"
      ? `Ok — hay una estimación heurística de ventana para **${brand}**. Para contrastarla en **Launch Radar**, andá a Intel → **Launch radar** y activá el switch.`
      : `Ok — there is a heuristic window estimate for **${brand}**. To cross-check it in **Launch Radar**, open Intel → **Launch radar** and turn on the switch.`;
  }

  const hasLaunchData = Boolean(
    detection?.launchDate
    || detection?.lastLaunchDate
    || detection?.estimatedLaunchDate
    || detection?.averageIntervalMonths != null,
  );

  if (hasLaunchData) {
    return lang === "es"
      ? `Ok — preparé datos de lanzamiento para **${brand}** en este informe. Abrí el panel **Launch Radar** en Intel y activá el switch para cargar lo que te dejé listo.`
      : `Ok — I prepared launch data for **${brand}** in this report. Open the **Launch Radar** panel in Intel and turn on the switch to load what I saved for you.`;
  }

  return lang === "es"
    ? `Ok — cuando quieras usar los datos de lanzamiento de este informe, abrí el panel **Launch Radar** en Intel y activá el switch.`
    : `Ok — when you're ready to use this report's launch data, open the **Launch Radar** panel in Intel and turn on the switch.`;
}

/** @deprecated Use formatLaunchRadarRecommendation */
export function formatLaunchRadarClosing(brandName, detection, lang) {
  return formatLaunchRadarRecommendation(brandName, detection, lang);
}

/**
 * @param {string} [text]
 */
function hasText(text) {
  return Boolean((text || "").trim());
}

/**
 * @param {import("./marketContextBundle.js").MarketAnalysis} marketAnalysis
 * @param {string} customerMarkets
 * @param {'en' | 'es'} lang
 */
export function formatMarketAnalysisSection(marketAnalysis, customerMarkets, lang) {
  /** @type {string[]} */
  const lines = [];

  if (customerMarkets.trim()) {
    lines.push(customerMarkets.trim());
  }

  const ma = marketAnalysis || {};
  if (ma.customerLocations?.trim()) {
    lines.push(lang === "es"
      ? `Ubicación de compradores: ${ma.customerLocations}`
      : `Buyer locations: ${ma.customerLocations}`);
  }
  if (ma.salesMetrics?.trim()) {
    lines.push(lang === "es"
      ? `Señales de ventas: ${ma.salesMetrics}`
      : `Sales signals: ${ma.salesMetrics}`);
  }
  if (ma.priorYearInterestPeak?.trim()) {
    lines.push(lang === "es"
      ? `Pico de interés (periodo anterior): ${ma.priorYearInterestPeak}`
      : `Prior interest peak: ${ma.priorYearInterestPeak}`);
  }
  if (ma.topInterestRegions?.length) {
    lines.push(lang === "es"
      ? `Regiones de mayor interés: ${ma.topInterestRegions.join(", ")}`
      : `Top interest regions: ${ma.topInterestRegions.join(", ")}`);
  }
  if (ma.evidenceSummary?.trim()) {
    lines.push(ma.evidenceSummary.trim());
  }

  return lines.join("\n\n");
}

/**
 * @param {import("../fetchCampaignAnalyst.js").CampaignAnalystReport} report
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
export function buildStrategicReportBody(report, detection, brandName, lang) {
  /** @type {string[]} */
  const parts = [];

  parts.push(formatReportGreeting(lang));

  const opening = (report?.openingBrief || "").trim();
  if (hasText(opening)) {
    parts.push(opening);
  }

  const whatsNew = (report?.whatsNew || "").trim();
  if (hasText(whatsNew)) {
    const label = lang === "es" ? "## ¿Qué pasó recientemente?" : "## What happened recently";
    parts.push(`${label}\n\n${whatsNew}`);
  }

  const whatsComing = (report?.whatsComing || "").trim();
  if (hasText(whatsComing)) {
    const label = lang === "es" ? "## Lo que viene" : "## What's ahead";
    parts.push(`${label}\n\n${whatsComing}`);
  }

  const recommendation = (report?.strategicRecommendation || "").trim();
  if (hasText(recommendation)) {
    const label = lang === "es" ? "## Mi recomendación" : "## My recommendation";
    parts.push(`${label}\n\n${recommendation}`);
  }

  const marketFromReport = (report?.marketContext || "").trim();
  const marketFromApi = formatMarketInterestBlock(detection?.marketInterest, lang);
  const marketAnalysisBlock = formatMarketAnalysisSection(
    report?.marketAnalysis,
    report?.customerMarkets || "",
    lang,
  );
  const marketBlock = [marketAnalysisBlock, marketFromReport, marketFromApi].filter(hasText).join("\n\n");
  if (hasText(marketBlock)) {
    const label = lang === "es" ? "## Análisis de mercado" : "## Market analysis";
    parts.push(`${label}\n\n${marketBlock}`);
  }

  const radarRecommendation = formatLaunchRadarRecommendation(brandName, detection, lang);
  const label = lang === "es"
    ? "## Siguiente paso · Launch Radar"
    : "## Next step · Launch Radar";
  parts.push(`${label}\n\n${radarRecommendation}`);

  const reportSources = report?.sources?.length
    ? report.sources
    : (detection?.citations || []).map((c) => ({
      url: c.url || "",
      title: c.title || "",
      domain: c.domain || "",
      tipo: isOfficialUrl(c.url || "", brandName) ? "oficial" : "medio",
      type: isOfficialUrl(c.url || "", brandName) ? "official" : "media",
    }));

  const sourceLines = reportSources
    .filter((s) => (s.url || "").trim())
    .slice(0, 12)
    .map((s) => formatSourceLine(s, brandName, lang))
    .filter(Boolean);

  if (sourceLines.length) {
    const label = lang === "es" ? "## Fuentes" : "## Sources";
    parts.push(`${label}\n\n${sourceLines.join("\n\n")}`);
  }

  return parts.join("\n\n\n");
}
