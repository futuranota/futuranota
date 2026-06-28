import { daysUntilLaunch, isFutureLaunchDate } from "../campaignWindow.js";

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
 * @param {string} brandName
 * @param {string|null|undefined} launchDate
 * @param {'en' | 'es'} lang
 */
export function formatLaunchRadarClosing(brandName, launchDate, lang) {
  if (!launchDate || !isFutureLaunchDate(launchDate)) return "";

  const days = daysUntilLaunch(launchDate);
  const daysPart = days !== null
    ? (lang === "es" ? ` (${days} días restantes)` : ` (${days} days remaining)`)
    : "";

  if (lang === "es") {
    return [
      "El siguiente paso: voy a incrustar estas fechas directamente en tu Launch Radar para que puedas seguir la evolución de esta señal en tiempo real. El timeline ya tiene los datos; solo necesitas abrirlo.",
      "Ok, listo — ya ha sido agregado.",
    ].join("\n\n");
  }

  return [
    `Next step: these dates are synced to your Launch Radar for ${brandName}${daysPart} so you can track this signal in real time. Open the timeline when you're ready.`,
    "Done — it's already been added.",
  ].join("\n\n");
}

/**
 * @param {string} [text]
 */
function hasText(text) {
  return Boolean((text || "").trim());
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
  const marketBlock = [marketFromReport, marketFromApi].filter(hasText).join("\n\n");
  if (hasText(marketBlock)) {
    parts.push(marketBlock);
  }

  const launchDate = detection?.launchDate || detection?.estimatedLaunchDate || "";
  const radarClosing = formatLaunchRadarClosing(brandName, launchDate, lang);
  if (hasText(radarClosing)) {
    parts.push(radarClosing);
  }

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
