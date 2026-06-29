import playbookEn from "../../../content/marketing/playbook.en.md?raw";
import playbookEs from "../../../content/marketing/playbook.es.md?raw";
import { resolvePlaybookImageCommandsInText } from "../playbookImageCommand.js";
import { pickPrimaryInterestRegion } from "./marketContextBundle.js";

/** Same presentation kind as Campaign Analyst — static markdown view (no typewriter). */
export const MARKETING_GUIDE_REPORT_PRESENTATION = {
  kind: "marketing-guide-v1",
  animateOnOpen: false,
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
    .replace(/\n[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
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
 * Display name for playbook greeting — first name, email local-part, or fallback.
 * @param {{ user_metadata?: { first_name?: string }, email?: string } | null | undefined} user
 * @param {'en' | 'es'} lang
 */
export function resolvePlaybookAccountName(user, lang = "en") {
  const first = user?.user_metadata?.first_name?.trim();
  if (first) return first;
  const emailLocal = user?.email?.split("@")[0]?.trim();
  if (emailLocal) return emailLocal;
  return lang === "es" ? "equipo" : "there";
}

/** Default agent persona label until named agents ship. */
export const MARKETING_GUIDE_AGENT_NAME = "bot";

/**
 * Static Marketing Guide playbook — edit content/marketing/playbook.{en,es}.md
 * @param {string} brandName
 * @param {'en' | 'es'} [locale]
 * @param {import("./marketContextBundle.js").MarketContextBundle|null} [marketContextBundle]
 * @param {{ accountName?: string, agentName?: string }} [persona]
 */
function fillPlaybookTemplate(brandName, locale = "en", marketContextBundle = null, persona = {}) {
  const lang = locale === "es" ? "es" : "en";
  const brand = (brandName || "").trim() || (lang === "es" ? "marca" : "brand");
  const template = loadPlaybookTemplate(lang);
  const brandContextSection = buildBrandContextSection(brand, lang, marketContextBundle);
  const accountName = (persona.accountName || "").trim()
    || resolvePlaybookAccountName(null, lang);
  const agentName = (persona.agentName || "").trim() || MARKETING_GUIDE_AGENT_NAME;

  return template
    .replace(/\{brand\}/g, brand)
    .replace(/\{accountName\}/g, accountName)
    .replace(/\{agentName\}/g, agentName)
    .replace(/\{brandContextSection\}/g, brandContextSection);
}

export function buildMarketingGuidePlaybookBody(
  brandName,
  locale = "en",
  marketContextBundle = null,
  persona = {},
) {
  return sanitizePlaybookText(fillPlaybookTemplate(brandName, locale, marketContextBundle, persona));
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
  const { accountName, agentName, ...imageOptions } = options;
  const filled = fillPlaybookTemplate(brandName, locale, marketContextBundle, {
    accountName,
    agentName,
  });
  const withImages = await resolvePlaybookImageCommandsInText(filled, imageOptions);
  return sanitizePlaybookText(withImages);
}

/**
 * @param {string} brandName
 * @param {'en' | 'es'} lang
 */
export function playbookDocTitle(_brandName, _lang) {
  return "Marketing Guide";
}
