import { completeJson } from "../llmJson.js";
import { collectSocialHypeSignals } from "../discovery/socialHypeCollectors.js";
import { buildHypeDistributionV1 } from "../discovery/normalizeHypeDistribution.js";
import {
  buildSocialHypeAnalystPrompt,
  normalizeSocialHypeLocale,
} from "./socialHypeAnalystContext.js";

/**
 * @param {unknown} value
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} raw
 * @param {object} hypeDistribution
 * @param {'en' | 'es'} lang
 */
function normalizeAnalystSections(raw, hypeDistribution, lang) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const primary = hypeDistribution?.channelIntel?.preferredChannelForUser
    || hypeDistribution?.channelIntel?.primaryChannel
    || "Unknown";
  const share = hypeDistribution?.channelIntel?.primaryShare ?? 0;

  const themes = Array.isArray(obj.themes)
    ? obj.themes.map((item) => asString(item)).filter(Boolean).slice(0, 5)
    : [];

  return {
    channelVerdict: asString(obj.channelVerdict)
      || (lang === "es"
        ? `${primary} concentra ~${share}% de la señal social detectada para ${hypeDistribution.brandName}.`
        : `${primary} holds ~${share}% of detected social signal for ${hypeDistribution.brandName}.`),
    preferredChannel: asString(obj.preferredChannel) || primary,
    whySameChannel: asString(obj.whySameChannel)
      || (lang === "es"
        ? `Publicar en ${primary} te pone donde ${hypeDistribution.brandName} ya está invirtiendo atención — la audiencia caliente ya mira ese canal.`
        : `Publishing on ${primary} puts you where ${hypeDistribution.brandName} already invests attention — the warm audience is already there.`),
    themes: themes.length ? themes : [hypeDistribution.brandName, "launch", "campaign"],
    companionAction: asString(obj.companionAction)
      || (lang === "es"
        ? `Publicá un clip corto en ${primary} esta semana, alineado al tema de lanzamiento.`
        : `Post a short clip on ${primary} this week, aligned to the launch theme.`),
    risks: asString(obj.risks)
      || (lang === "es"
        ? "Evitá canales con 0% en el mix hasta que aparezca señal."
        : "Skip channels at 0% in the mix until signal appears."),
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

  if (process.env.GROQ_API_KEY) {
    const { system, user } = buildSocialHypeAnalystPrompt(lang, { brandName: brand, hypeDistribution });
    const llm = await completeJson(user, { system });
    analystSections = normalizeAnalystSections(llm?.data, hypeDistribution, lang);
    source = [source, llm?.provider || "groq"].filter(Boolean).join("+");
  }

  return {
    hypeDistribution,
    analystSections,
    source,
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
