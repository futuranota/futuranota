import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} MarketingGuideToolSection
 * @property {string} title
 * @property {string} body
 * @property {string} action
 */

/**
 * @typedef {Object} MarketingGuideReport
 * @property {string} brandContextHook
 * @property {string} openingHook
 * @property {MarketingGuideToolSection} calendarGuide
 * @property {MarketingGuideToolSection} forecastGuide
 * @property {MarketingGuideToolSection} marketHypeGuide
 * @property {MarketingGuideToolSection} searchIntentGuide
 * @property {MarketingGuideToolSection} youtubeGuide
 * @property {string} outcomesClosing
 * @property {string} [source]
 */

/**
 * @param {Object} params
 * @param {'en' | 'es'} params.locale
 * @param {string} params.brandName
 * @param {object} params.detection
 * @param {object} params.analystReport
 * @param {object} [params.marketContextBundle]
 * @returns {Promise<MarketingGuideReport>}
 */
export async function fetchMarketingGuideReport({
  locale = "en",
  brandName,
  detection = {},
  analystReport = {},
  marketContextBundle = null,
}) {
  return apiClient(API_ROUTES.agentMarketingGuide, {
    method: "POST",
    body: JSON.stringify({
      locale: locale === "es" ? "es" : "en",
      brandName,
      detection,
      analystReport,
      marketContextBundle,
    }),
  });
}
