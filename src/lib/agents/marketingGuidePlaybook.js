import playbookEn from "../../../content/marketing/playbook.en.md?raw";
import playbookEs from "../../../content/marketing/playbook.es.md?raw";
import { resolvePlaybookImageCommandsInText } from "../playbookImageCommand.js";
import { pickPrimaryInterestRegion } from "./marketContextBundle.js";

/** Same presentation kind as Campaign Analyst — triggers typewriter animation in DocBlockStack. */
export const MARKETING_GUIDE_REPORT_PRESENTATION = {
  kind: "analyst-strategic-v2",
  animateOnOpen: true,
  animatedAt: null,
};

/**
 * Collapse extra blank lines, strip horizontal rules and markdown asterisk emphasis.
 * @param {string} text
 */
export function sanitizePlaybookText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/^[\u2500\u2501\-=━_]{3,}\s*$/gm, "")
    .replace(/^-{3,}\s*$/gm, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\*/g, "")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {'en' | 'es'} lang
 */
function loadPlaybookTemplate(lang) {
  return lang === "es" ? playbookEs : playbookEn;
}

/**
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 * @param {import("./marketContextBundle.js").MarketContextBundle|null} [marketContextBundle]
 */
export function buildBrandContextSection(brandName, lang, marketContextBundle) {
  if (!marketContextBundle?.hasVerifiedData) return "";

  const region = pickPrimaryInterestRegion(marketContextBundle);
  if (!region) return "";

  return lang === "es"
    ? `Al entender que tu marca seleccionada ${brandName} muestra mayor índice de interés en ${region}, esto sugiere que en su próximo movimiento una parte relevante de su audiencia podría concentrarse ahí. Úsalo como señal geográfica, no como dato de ventas confirmado.`
    : `Understanding that your selected brand ${brandName} shows its highest interest index in ${region}, this suggests that for their next move a meaningful share of their audience may cluster there. Use it as a geographic signal, not confirmed sales data.`;
}

/**
 * Static Marketing Guide playbook — edit content/marketing/playbook.{en,es}.md
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @param {import("./marketContextBundle.js").MarketContextBundle|null} [marketContextBundle]
 */
function fillPlaybookTemplate(brandName, locale = "en", marketContextBundle = null) {
  const lang = locale === "es" ? "es" : "en";
  const brand = (brandName || "").trim() || (lang === "es" ? "marca" : "brand");
  const template = loadPlaybookTemplate(lang);
  const brandContextSection = buildBrandContextSection(brand, lang, marketContextBundle);

  return template
    .replace(/\{brand\}/g, brand)
    .replace(/\{brandContextSection\}/g, brandContextSection);
}

export function buildMarketingGuidePlaybookBody(brandName, locale = "en", marketContextBundle = null) {
  return sanitizePlaybookText(fillPlaybookTemplate(brandName, locale, marketContextBundle));
}

/**
 * Same as buildMarketingGuidePlaybookBody but resolves `[Imagen …](…)` commands to webp (1:1 size).
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @param {import("./marketContextBundle.js").MarketContextBundle|null} [marketContextBundle]
 * @param {{ quality?: number }} [options]
 */
export async function buildMarketingGuidePlaybookBodyAsync(
  brandName,
  locale = "en",
  marketContextBundle = null,
  options = {},
) {
  const filled = fillPlaybookTemplate(brandName, locale, marketContextBundle);
  const withImages = await resolvePlaybookImageCommandsInText(filled, options);
  return sanitizePlaybookText(withImages);
}

/**
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
export function playbookDocTitle(brandName, lang) {
  const brand = (brandName || "").trim() || (lang === "es" ? "marca" : "brand");
  return `Playbook · ${brand}`;
}
