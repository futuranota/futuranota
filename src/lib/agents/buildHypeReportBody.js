/** @typedef {import("../types/marketHype.ts").MarketHypeData} MarketHypeData */

/** @typedef {import("./fetchSocialHypeAnalyst.js").HypeDistributionV1} HypeDistributionV1 */
/** @typedef {import("./fetchSocialHypeAnalyst.js").SocialHypeAnalystSections} SocialHypeAnalystSections */

/**
 * @param {HypeDistributionV1|null|undefined} hypeDistribution
 * @returns {MarketHypeData|null}
 */
export function marketHypeDataFromHypeDistribution(hypeDistribution) {
  if (!hypeDistribution?.socialHype) return null;

  const statusKind = hypeDistribution.status?.kind === "active"
    ? "active"
    : hypeDistribution.status?.kind === "teaser"
      ? "teaser"
      : "rumor";

  return {
    status: {
      kind: statusKind,
      label: hypeDistribution.status?.label || "Campaign signal",
      timeLabel: hypeDistribution.status?.timeLabel || "",
    },
    socialHype: {
      mentions24hLabel: hypeDistribution.socialHype.mentions24hLabel || "",
      trackedHashtags: hypeDistribution.socialHype.trackedHashtags || [],
      socialDistribution: hypeDistribution.socialHype.socialDistribution || [],
    },
    searchIntent: {
      trendLabel: hypeDistribution.searchIntent?.trendLabel || "",
      searchKeywords: hypeDistribution.searchIntent?.searchKeywords || [],
      trendingProduct: hypeDistribution.searchIntent?.trendingProduct,
    },
  };
}

/**
 * @param {HypeDistributionV1|null|undefined} hypeDistribution
 * @param {SocialHypeAnalystSections|null|undefined} sections
 * @param {'en'|'es'} [lang]
 */
export function buildHypeReportBody(hypeDistribution, sections, lang = "en") {
  if (!hypeDistribution) return "";

  const brand = hypeDistribution.brandName || "Brand";
  const primary = hypeDistribution.channelIntel?.primaryChannel || sections?.preferredChannel || "—";
  const share = hypeDistribution.channelIntel?.primaryShare ?? 0;
  const preferred = sections?.preferredChannel || hypeDistribution.channelIntel?.preferredChannelForUser || primary;

  const distributionLines = (hypeDistribution.socialHype?.socialDistribution || [])
    .map((row) => `- ${row.platform}: ${row.percentage}%`)
    .join("\n");

  const themes = (sections?.themes || []).map((theme) => `- ${theme}`).join("\n");
  const samples = (hypeDistribution.socialHype?.samplePosts || [])
    .slice(0, 5)
    .map((post) => `- [${post.platform}] ${post.text}${post.url ? ` (${post.url})` : ""}`)
    .join("\n");

  if (lang === "es") {
    return [
      `# Social Hype · ${brand}`,
      "",
      `**Estado:** ${hypeDistribution.status?.label || "—"} · Score ${hypeDistribution.socialHype?.hypeScore ?? 0}/100 · Confianza ${hypeDistribution.socialHype?.confidence || "—"}`,
      "",
      "## Dónde publica la marca",
      sections?.channelVerdict || `${brand} concentra la señal en ${primary} (~${share}%).`,
      "",
      "### Distribución por canal",
      distributionLines || "—",
      "",
      "## Tu canal preferido (misma audiencia)",
      `**Recomendado:** ${preferred}`,
      "",
      sections?.whySameChannel || `Publicar en ${preferred} te alinea con la inversión de atención de ${brand}.`,
      "",
      "## Acción companion",
      sections?.companionAction || `Publicá contenido corto en ${preferred} esta semana.`,
      "",
      "## Temas del buzz",
      themes || "—",
      "",
      "## Muestras",
      samples || "—",
      "",
      "## Riesgos",
      sections?.risks || "Evitá canales sin señal en el mix.",
    ].join("\n");
  }

  return [
    `# Social Hype · ${brand}`,
    "",
    `**Status:** ${hypeDistribution.status?.label || "—"} · Score ${hypeDistribution.socialHype?.hypeScore ?? 0}/100 · Confidence ${hypeDistribution.socialHype?.confidence || "—"}`,
    "",
    "## Where the brand publishes",
    sections?.channelVerdict || `${brand} concentrates signal on ${primary} (~${share}%).`,
    "",
    "### Channel distribution",
    distributionLines || "—",
    "",
    "## Your preferred channel (same audience)",
    `**Recommended:** ${preferred}`,
    "",
    sections?.whySameChannel || `Publishing on ${preferred} aligns you with where ${brand} invests attention.`,
    "",
    "## Companion action",
    sections?.companionAction || `Post short-form content on ${preferred} this week.`,
    "",
    "## Buzz themes",
    themes || "—",
    "",
    "## Samples",
    samples || "—",
    "",
    "## Risks",
    sections?.risks || "Skip channels with no signal in the mix.",
  ].join("\n");
}

export const SOCIAL_HYPE_REPORT_PRESENTATION = {
  kind: "social-hype-v1",
  animateOnOpen: false,
};

/**
 * @param {string} brandName
 * @param {'en'|'es'} [lang]
 */
export function socialHypeDocTitle(brandName, lang = "en") {
  const brand = brandName.trim() || "Brand";
  return lang === "es" ? `Social Hype · ${brand}` : `Social Hype · ${brand}`;
}
