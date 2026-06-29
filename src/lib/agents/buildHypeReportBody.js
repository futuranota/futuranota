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
 * @param {Array<{ platform: string, percentage: number }>} distribution
 * @param {'en'|'es'} lang
 */
function buildDistributionTable(distribution, lang) {
  if (!distribution.length) return "—";

  const header = lang === "es"
    ? "| Canal | Peso en la muestra |"
    : "| Channel | Sample weight |";

  return [
    header,
    "|-------|-------------------|",
    ...distribution.map((row) => `| ${row.platform} | ${row.percentage}% |`),
  ].join("\n");
}

/**
 * @param {HypeDistributionV1|null|undefined} hypeDistribution
 * @param {'en'|'es'} lang
 */
function buildSignalLine(hypeDistribution, lang) {
  const score = hypeDistribution?.socialHype?.hypeScore ?? 0;
  const confidence = hypeDistribution?.socialHype?.confidence || "—";
  const statusLabel = hypeDistribution?.status?.label || "—";

  const confidenceLabel = lang === "es"
    ? (confidence === "high" ? "alta" : confidence === "medium" ? "media" : confidence === "low" ? "baja" : confidence)
    : confidence;

  if (lang === "es") {
    return `**Señal:** ${statusLabel} · Score ${score}/100 · Confianza en la muestra: ${confidenceLabel}`;
  }

  return `**Signal:** ${statusLabel} · Score ${score}/100 · Sample confidence: ${confidenceLabel}`;
}

/**
 * @param {HypeDistributionV1|null|undefined} hypeDistribution
 * @param {SocialHypeAnalystSections|null|undefined} sections
 * @param {'en'|'es'} [lang]
 */
export function buildHypeReportBody(hypeDistribution, sections, lang = "en") {
  if (!hypeDistribution) return "";

  const brand = hypeDistribution.brandName || "Brand";
  const distribution = (hypeDistribution.socialHype?.socialDistribution || [])
    .filter((row) => row.percentage > 0);

  const distributionTable = buildDistributionTable(distribution, lang);

  const channelBlocks = (sections?.channelInsights?.length
    ? sections.channelInsights
    : distribution.map((row) => ({
      platform: row.platform,
      percentage: row.percentage,
      explanation: "",
    }))
  )
    .map((row) => [
      `### ${row.platform} (~${row.percentage}%)`,
      "",
      row.explanation || "—",
      "",
    ].join("\n"))
    .join("\n");

  const themes = (sections?.themes || []).map((theme) => `- ${theme}`).join("\n");
  const samples = (hypeDistribution.socialHype?.samplePosts || [])
    .slice(0, 6)
    .map((post) => `- [${post.platform}] ${post.text}${post.url ? `\n  ${post.url}` : ""}`)
    .join("\n");

  if (lang === "es") {
    return [
      `# Social Hype · ${brand}`,
      "",
      sections?.greetingIntro
        || `Hola — gracias por pedir este informe. Resume dónde **${brand}** invierte atención social; tú eliges si entrar en alguna conversación o crear una paralela.`,
      "",
      buildSignalLine(hypeDistribution, lang),
      "",
      "## Distribución por canal",
      "",
      distributionTable,
      "",
      sections?.distributionSummary || "—",
      "",
      "## Qué tipo de conversación vive en cada red",
      "",
      channelBlocks || "—",
      "## Mi lectura principal",
      "",
      sections?.primaryReading || "—",
      "",
      "## Matices del mix",
      "",
      sections?.channelNuance || "—",
      "",
      "## Si quieres entrar en la conversación",
      "",
      sections?.conversationIdea || "—",
      "",
      "## Temas que aparecen en el buzz",
      "",
      themes || "—",
      "",
      "## Muestras (fuentes de la muestra)",
      "",
      samples || "—",
      "",
      buildMarketHypeNextStepSection(lang, brand),
    ].join("\n");
  }

  return [
    `# Social Hype · ${brand}`,
    "",
    sections?.greetingIntro
      || `Hi — thanks for requesting this report. It summarizes where **${brand}** invests social attention; you choose whether to join a conversation or start a parallel one.`,
    "",
    buildSignalLine(hypeDistribution, lang),
    "",
    "## Channel distribution",
    "",
    distributionTable,
    "",
    sections?.distributionSummary || "—",
    "",
    "## What conversation lives on each network",
    "",
    channelBlocks || "—",
    "## My main read",
    "",
    sections?.primaryReading || "—",
    "",
    "## Mix nuances",
    "",
    sections?.channelNuance || "—",
    "",
    "## If you want to join the conversation",
    "",
    sections?.conversationIdea || "—",
    "",
    "## Themes in the buzz",
    "",
    themes || "—",
    "",
    "## Samples (sources in the sample)",
    "",
    samples || "—",
    "",
    buildMarketHypeNextStepSection(lang, brand),
  ].join("\n");
}

export const SOCIAL_HYPE_REPORT_PRESENTATION = {
  kind: "social-hype-v1",
  animateOnOpen: true,
  animatedAt: null,
};

/**
 * @param {'en'|'es'} lang
 * @param {string} brand
 */
function buildMarketHypeNextStepSection(lang, brand) {
  if (lang === "es") {
    return [
      "## Siguiente paso · Market Hype",
      "",
      `Ok — si querés llevar estos datos al panel **Market Hype** del selector Intel, andá a esa pestaña y tocá **Insertar datos del informe**. Ahí vas a ver la distribución, hashtags y keywords que acabo de recopilar para **${brand}**.`,
    ].join("\n");
  }

  return [
    "## Next step · Market Hype",
    "",
    `Ok — to bring this data into the **Market Hype** panel in the Intel selector, open that tab and tap **Insert report data**. You'll see the distribution, hashtags, and keywords I just collected for **${brand}**.`,
  ].join("\n");
}

/**
 * @param {string} brandName
 * @param {'en'|'es'} [lang]
 */
export function socialHypeDocTitle(brandName, lang = "en") {
  const brand = brandName.trim() || "Brand";
  return lang === "es" ? `Social Hype · ${brand}` : `Social Hype · ${brand}`;
}
