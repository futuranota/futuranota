/**
 * @param {string} [text]
 */
function hasText(text) {
  return Boolean((text || "").trim());
}

/**
 * @param {import("../fetchMarketingGuide.js").MarketingGuideToolSection} section
 * @param {string} defaultTitle
 * @param {'en' | 'es'} lang
 */
function formatToolSection(section, defaultTitle, lang) {
  const body = (section?.body || "").trim();
  if (!hasText(body)) return "";

  const title = (section?.title || defaultTitle).trim();
  const action = (section?.action || "").trim();
  const actionLabel = lang === "es" ? "**Acción:**" : "**Action:**";

  const parts = [`## ${title}`, "", body];
  if (hasText(action)) {
    parts.push("", `${actionLabel} ${action}`);
  }
  return parts.join("\n");
}

/**
 * @param {import("../fetchMarketingGuide.js").MarketingGuideReport} report
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
export function buildMarketingGuideBody(report, brandName, lang) {
  /** @type {string[]} */
  const parts = [];

  const header = lang === "es"
    ? `# Marketing Guide\n\n*Cómo usar Futura Nota con esta señal — sin asumir qué producto vas a lanzar.*`
    : `# Marketing Guide\n\n*How to use Futura Nota with this signal — without assuming what product you'll launch.*`;

  parts.push(header);

  const brandHook = (report?.brandContextHook || "").trim();
  if (hasText(brandHook)) {
    const label = lang === "es" ? "## Señal de mercado · tu marca" : "## Market signal · your brand";
    parts.push(`${label}\n\n${brandHook}`);
  }

  const hook = (report?.openingHook || "").trim();
  if (hasText(hook)) {
    parts.push(hook);
  }

  const sections = lang === "es"
    ? [
      { section: report?.calendarGuide, title: "📅 Calendar" },
      { section: report?.forecastGuide, title: "🌤 Forecast" },
      { section: report?.marketHypeGuide, title: "📊 Market Hype" },
      { section: report?.searchIntentGuide, title: "🔍 Search Intent" },
      { section: report?.youtubeGuide, title: "▶ YouTube" },
    ]
    : [
      { section: report?.calendarGuide, title: "📅 Calendar" },
      { section: report?.forecastGuide, title: "🌤 Forecast" },
      { section: report?.marketHypeGuide, title: "📊 Market Hype" },
      { section: report?.searchIntentGuide, title: "🔍 Search Intent" },
      { section: report?.youtubeGuide, title: "▶ YouTube" },
    ];

  for (const { section, title } of sections) {
    const block = formatToolSection(section, title, lang);
    if (hasText(block)) parts.push(block);
  }

  const closing = (report?.outcomesClosing || "").trim();
  if (hasText(closing)) {
    const label = lang === "es" ? "## Lo que ganás al conectar esto" : "## What you gain";
    parts.push(`${label}\n\n${closing}`);
  }

  return parts.join("\n\n\n");
}

/**
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
export function playbookDocTitle(_brandName, _lang) {
  return "Marketing Guide";
}
