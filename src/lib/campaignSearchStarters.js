import startersFile from "../../content/admin/campaign-search-starters.json";

/**
 * @returns {{ starters: string[], defaultIndex: number }}
 */
export function getCampaignSearchStarters() {
  const starters = Array.isArray(startersFile?.starters)
    ? startersFile.starters.filter((s) => typeof s === "string" && s.trim())
    : [];
  const rawIndex = Number(startersFile?.defaultIndex);
  const defaultIndex = Number.isFinite(rawIndex) && starters.length > 0
    ? Math.max(0, Math.min(rawIndex, starters.length - 1))
    : 0;
  return { starters, defaultIndex };
}

/**
 * @param {string} template
 * @param {string} [brandName]
 */
export function formatCampaignStarter(template, brandName = "") {
  const brand = brandName.trim();
  const replacement = brand || "{brand}";
  return String(template).replace(/\{brand\}/gi, replacement);
}

/**
 * Default textarea seed for Intel Campaign tab.
 * @param {string} [brandName]
 * @param {(name: string) => string} [fallback]
 */
export function getDefaultCampaignSearchQuery(brandName, fallback) {
  const { starters, defaultIndex } = getCampaignSearchStarters();
  const template = starters[defaultIndex];
  if (template) return formatCampaignStarter(template, brandName);
  if (typeof fallback === "function") return fallback(brandName);
  return typeof fallback === "string" ? fallback : "";
}
