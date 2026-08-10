import { completeJson } from "../llmJson.js";
import { collectSocialHypeSignals } from "../discovery/socialHypeCollectors.js";
import { buildHypeDistributionV1 } from "../discovery/normalizeHypeDistribution.js";
import {
  buildSocialHypeAnalystPrompt,
  normalizeSocialHypeLocale,
} from "./socialHypeAnalystContext.js";
import { normalizeLlmUsage } from "../management/apiCostPricing.js";

/**
 * @param {unknown} value
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 */
function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** @type {Record<string, { es: string, en: string }>} */
const PLATFORM_HINTS = {
  Instagram: {
    es: "conversación visual y directa — reels, capturas, comunidad emocional",
    en: "visual, direct conversation — reels, screenshots, emotional community",
  },
  Reddit: {
    es: "conversación analítica y comunitaria — debate, links, opiniones fundamentadas",
    en: "analytical, community debate — threads, links, grounded opinions",
  },
  TikTok: {
    es: "conversación rápida, clip-first, vertical — snack content de 15–60 segundos",
    en: "fast, clip-first, vertical conversation — 15–60 second snack content",
  },
  YouTube: {
    es: "conversación más larga, narrativa y educativa — análisis, reacciones, retención",
    en: "longer, narrative, educational conversation — analysis, reactions, retention",
  },
  "X (Twitter)": {
    es: "pulso en tiempo real — noticias, reacciones calientes, hilos cortos",
    en: "real-time pulse — news, hot takes, short threads",
  },
  Twitter: {
    es: "pulso en tiempo real — noticias, reacciones calientes, hilos cortos",
    en: "real-time pulse — news, hot takes, short threads",
  },
  Prensa: {
    es: "canal institucional — comunicados y cobertura; contexto narrativo, no publicación directa",
    en: "institutional channel — press releases and coverage; narrative context, not direct publishing",
  },
  Press: {
    es: "canal institucional — comunicados y cobertura; contexto narrativo, no publicación directa",
    en: "institutional channel — press releases and coverage; narrative context, not direct publishing",
  },
};

/**
 * @param {string} platform
 * @param {number} percentage
 * @param {string} brand
 * @param {'en'|'es'} lang
 */
function fallbackChannelExplanation(platform, percentage, brand, lang) {
  const hint = PLATFORM_HINTS[platform]?.[lang]
    || (lang === "es" ? "conversación activa en la muestra" : "active conversation in the sample");

  if (lang === "es") {
    return `${platform} concentra el ${percentage}% de la actividad detectada para ${brand}. Lo interesante de este canal es que la conversación es más ${hint}. Pienso que puede servirte si tu contenido encaja con ese formato — tú decides si quieres entrar ahí o abrir una conversación paralela.`;
  }

  return `${platform} holds ${percentage}% of detected activity for ${brand}. What's interesting about this channel is that the conversation is more ${hint}. I think it could work if your content fits that format — you decide whether to join that conversation or start a parallel one.`;
}

/**
 * @param {object} hypeDistribution
 * @param {'en'|'es'} lang
 */
function buildDistributionSummary(hypeDistribution, lang) {
  const rows = (hypeDistribution?.socialHype?.socialDistribution || [])
    .filter((row) => row.percentage > 0);
  if (!rows.length) {
    return lang === "es"
      ? "Aún no hay señal clara por canal en la muestra."
      : "No clear per-channel signal in the sample yet.";
  }

  const top = rows[0];
  const spread = top.percentage < 45 && rows.length > 2;

  if (spread) {
    return lang === "es"
      ? "No hay un solo canal dominante: la atención está repartida. Eso suele pasar cuando una marca activa varios frentes a la vez."
      : "There is no single dominant channel — attention is spread. That often happens when a brand activates several fronts at once.";
  }

  return lang === "es"
    ? `${top.platform} lidera con ~${top.percentage}%, pero otros canales siguen activos en el mix.`
    : `${top.platform} leads at ~${top.percentage}%, but other channels remain active in the mix.`;
}

/**
 * @param {object} hypeDistribution
 * @param {'en'|'es'} lang
 */
function buildChannelNuance(hypeDistribution, lang) {
  const rows = (hypeDistribution?.socialHype?.socialDistribution || [])
    .filter((row) => row.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const tiktok = rows.find((row) => row.platform === "TikTok");
  const youtube = rows.find((row) => row.platform === "YouTube");

  if (tiktok && youtube) {
    if (lang === "es") {
      return `TikTok y YouTube tienen presencia activa en este ecosistema — ${tiktok.percentage}% y ${youtube.percentage}% respectivamente. Lo interesante de esos canales es que el formato es diferente: en TikTok manda el clip vertical y el hook inmediato; en YouTube, contenido más largo, más narrativo, más educativo. Pienso que conviene leerlos como complementos, no como excluyentes.`;
    }
    return `TikTok and YouTube both have active presence in this ecosystem — ${tiktok.percentage}% and ${youtube.percentage}% respectively. What's interesting about those channels is that the format differs: TikTok favors vertical clips and instant hooks; YouTube favors longer, more narrative, more educational content. I think it helps to read them as complements, not either/or choices.`;
  }

  const secondary = rows.slice(1, 3);
  if (secondary.length >= 2) {
    const [a, b] = secondary;
    if (lang === "es") {
      return `${a.platform} y ${b.platform} también tienen presencia activa en este ecosistema — ${a.percentage}% y ${b.percentage}% cada uno. Lo interesante es que suelen implicar formatos distintos; pienso que conviene entender qué conversación vive en cada uno antes de elegir dónde sumarte.`;
    }
    return `${a.platform} and ${b.platform} also have active presence in this ecosystem — ${a.percentage}% each. What's interesting is they usually imply different formats; I think it helps to understand what conversation lives on each before choosing where to join.`;
  }

  if (rows.length === 1) {
    return lang === "es"
      ? "Por ahora la muestra concentra señal en un solo canal — eso puede cambiar cuando la campaña escale a otros frentes."
      : "For now the sample concentrates signal on one channel — that may shift as the campaign scales to other fronts.";
  }

  return lang === "es"
    ? "El mix muestra varios canales activos; cada uno suele implicar un formato y un tipo de cliente distinto."
    : "The mix shows several active channels; each usually implies a different format and audience type.";
}

/**
 * @param {unknown} raw
 * @param {object} hypeDistribution
 * @param {'en' | 'es'} lang
 */
function normalizeAnalystSections(raw, hypeDistribution, lang) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const brand = hypeDistribution?.brandName || "Brand";
  const primary = hypeDistribution?.channelIntel?.preferredChannelForUser
    || hypeDistribution?.channelIntel?.primaryChannel
    || "Unknown";
  const share = hypeDistribution?.channelIntel?.primaryShare ?? 0;
  const distribution = hypeDistribution?.socialHype?.socialDistribution || [];

  const themes = Array.isArray(obj.themes)
    ? obj.themes.map((item) => asString(item)).filter(Boolean).slice(0, 8)
    : [];

  const rawInsights = Array.isArray(obj.channelInsights) ? obj.channelInsights : [];
  const channelInsights = distribution
    .filter((row) => row.percentage > 0)
    .map((row) => {
      const match = rawInsights.find(
        (item) => item && typeof item === "object"
          && asString(item.platform).toLowerCase() === row.platform.toLowerCase(),
      );
      return {
        platform: row.platform,
        percentage: asNumber(match?.percentage) ?? row.percentage,
        explanation: asString(match?.explanation)
          || fallbackChannelExplanation(row.platform, row.percentage, brand, lang),
      };
    });

  const greetingIntro = asString(obj.greetingIntro)
    || (lang === "es"
      ? `Hola — gracias por pedir este informe. No te dice dónde *tienes* que publicar; resume dónde **${brand}** está invirtiendo atención social ahora mismo. Tú eliges si quieres entrar en alguna de esas conversaciones o crear una paralela.`
      : `Hi — thanks for requesting this report. It doesn't tell you where you *must* publish; it summarizes where **${brand}** is investing social attention right now. You choose whether to join one of those conversations or start a parallel one.`);

  const distributionSummary = asString(obj.distributionSummary)
    || buildDistributionSummary(hypeDistribution, lang);

  const primaryReading = asString(obj.primaryReading)
    || (lang === "es"
      ? `Pienso que, si tu objetivo es sumarte al tono de conversación que ya genera ${brand}, **${primary}** (~${share}%) es el primer lugar donde yo exploraría contenido — sobre todo si encaja con el formato que domina ese canal. Eso no descarta otros canales del mix; solo refleja dónde la marca ya está gastando más atención en esta muestra.`
      : `I think that if your goal is to join the conversation tone ${brand} already creates, **${primary}** (~${share}%) is the first place I'd explore content — especially if it fits the format that channel favors. That doesn't rule out other channels in the mix; it only reflects where the brand is already spending the most attention in this sample.`);

  const channelNuance = asString(obj.channelNuance)
    || buildChannelNuance(hypeDistribution, lang);

  const conversationIdea = asString(obj.conversationIdea)
    || (lang === "es"
      ? `Tal vez tenga sentido preparar 1–2 piezas alineadas al buzz que ya aparece en la muestra. Si prefieres no mezclarte con esa conversación, podrías abrir una paralela en otro canal del mix. Tú decides cuál quieres habitar.`
      : `It might make sense to prepare 1–2 pieces aligned to the buzz already in the sample. If you'd rather not mix with that conversation, you could open a parallel one on another channel in the mix. You decide which one you want to inhabit.`);

  return {
    greetingIntro,
    distributionSummary,
    channelInsights,
    primaryReading,
    preferredChannel: asString(obj.preferredChannel) || primary,
    channelNuance,
    conversationIdea,
    themes: themes.length ? themes : [brand, "launch", "campaign"],
    source: asString(obj.source) || "groq",
  };
}

/**
 * @param {object} params
 * @param {string} params.brandName
 * @param {string} [params.keyword]
 * @param {'en' | 'es'} [params.locale]
 */
export async function runSocialHypeAnalyst({ brandName, keyword, locale = "en" }) {
  const lang = normalizeSocialHypeLocale(locale);
  const brand = brandName.trim();
  if (!brand) throw new Error("brandName is required");

  const collected = await collectSocialHypeSignals(brand, keyword || brand);
  const hypeDistribution = buildHypeDistributionV1(collected);

  const fallbackSections = normalizeAnalystSections({}, hypeDistribution, lang);

  let analystSections = fallbackSections;
  let source = collected.collectorSources.join("+") || "collectors";
  let llmUsage = null;
  let llmModel = null;
  let llmProvider = null;

  if (process.env.GROQ_API_KEY) {
    const { system, user } = buildSocialHypeAnalystPrompt(lang, { brandName: brand, hypeDistribution });
    const llm = await completeJson(user, { system });
    analystSections = normalizeAnalystSections(llm?.data, hypeDistribution, lang);
    source = [source, llm?.provider || "groq"].filter(Boolean).join("+");
    llmUsage = normalizeLlmUsage(llm?.usage);
    llmModel = llm?.model || null;
    llmProvider = llm?.provider || null;
  }

  const apify = collected.apifyResult || null;

  return {
    hypeDistribution,
    analystSections,
    source,
    usage: {
      llmProvider,
      llmModel,
      llmUsage,
      serperUsed: collected.collectorSources.includes("serper"),
      apify: apify
        ? {
          billed: apify.source === "apify" && apify.billed !== false,
          computeUnits: apify.computeUnits ?? null,
          usageTotalUsd: apify.usageTotalUsd ?? null,
          itemCount: apify.itemCount ?? apify.mentions ?? null,
          actorId: apify.actorId || null,
          source: apify.source,
        }
        : null,
    },
  };
}

/**
 * @param {object} params
 * @param {string} params.brandName
 * @param {string} [params.keyword]
 * @param {'en' | 'es'} [params.locale]
 */
export async function runSocialHypeDistributionScan({ brandName, keyword, locale = "en" }) {
  return runSocialHypeAnalyst({ brandName, keyword, locale });
}

export function socialHypeKeysConfigured() {
  return Boolean(process.env.GROQ_API_KEY || process.env.SERPAPI_KEY || process.env.APIFY_API_TOKEN);
}
