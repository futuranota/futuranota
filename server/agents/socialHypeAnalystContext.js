import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.join(__dirname, "../../content/agents");

/** @type {Record<string, string | null>} */
const cachedSystemByLocale = {};

/**
 * @param {'en' | 'es'} [locale]
 */
export function normalizeSocialHypeLocale(locale) {
  return locale === "es" ? "es" : "en";
}

/**
 * @param {'en' | 'es'} [locale]
 */
export function loadSocialHypeAnalystSystemContext(locale = "en") {
  const lang = normalizeSocialHypeLocale(locale);
  if (cachedSystemByLocale[lang] !== undefined) {
    return cachedSystemByLocale[lang] || "";
  }
  const filePath = path.join(AGENTS_DIR, `social-hype-analyst.${lang}.md`);
  try {
    cachedSystemByLocale[lang] = fs.readFileSync(filePath, "utf8");
  } catch {
    cachedSystemByLocale[lang] = "";
  }
  return cachedSystemByLocale[lang] || "";
}

/**
 * @param {'en' | 'es'} locale
 * @param {object} params
 * @param {string} params.brandName
 * @param {object} params.hypeDistribution
 */
export function buildSocialHypeAnalystPrompt(locale, { brandName, hypeDistribution }) {
  const lang = normalizeSocialHypeLocale(locale);
  const system = loadSocialHypeAnalystSystemContext(lang);
  const brand = brandName.trim() || "the brand";

  const user = [
    `Brand: ${brand}`,
    `Locale: ${lang}`,
    "",
    "Verified collector payload (do NOT alter percentages):",
    JSON.stringify(hypeDistribution, null, 2),
    "",
    "Problem to solve for the user:",
    `- Cordial greeting + educational report on where ${brand} invests social attention`,
    `- Per-network conversation type (format, audience) — reflective tone, no orders`,
    `- Distribution data will be rendered as a table by the app — interpret the mix in prose only`,
    "",
    "Tone reference: content/agents/social-hype-report-copy-reference.md",
    "",
    "Return JSON only with keys: greetingIntro, distributionSummary, channelInsights, primaryReading, preferredChannel, channelNuance, conversationIdea, themes.",
  ].join("\n");

  return { system, user };
}

export function clearSocialHypeAnalystContextCache() {
  for (const key of Object.keys(cachedSystemByLocale)) {
    cachedSystemByLocale[key] = undefined;
  }
}
