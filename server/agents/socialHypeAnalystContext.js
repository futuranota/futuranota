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
    `- Understand where ${brand} publishes today`,
    `- Recommend the same primary channel as the user's preferred medium when it helps them reach the same audience`,
    "",
    "Return JSON only with keys: channelVerdict, preferredChannel, whySameChannel, themes, companionAction, risks.",
  ].join("\n");

  return { system, user };
}

export function clearSocialHypeAnalystContextCache() {
  for (const key of Object.keys(cachedSystemByLocale)) {
    cachedSystemByLocale[key] = undefined;
  }
}
