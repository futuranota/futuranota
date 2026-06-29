import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} StructuredFact
 * @property {string} [hecho]
 * @property {string} [fact]
 * @property {string} [fecha]
 * @property {string} [date]
 * @property {string} [fuente]
 * @property {string} [source]
 * @property {string} [confianza]
 * @property {string} [confidence]
 * @property {string} [categoria]
 * @property {string} [category]
 */

/**
 * @typedef {Object} ReportSource
 * @property {string} url
 * @property {string} [tipo]
 * @property {string} [type]
 * @property {string} [label]
 */

/**
 * @typedef {Object} CampaignAnalystReport
 * @property {string} primaryQuestion
 * @property {string} openingBrief
 * @property {StructuredFact[]} structuredFacts
 * @property {string} whatsNew
 * @property {string} whatsComing
 * @property {string} strategicRecommendation
 * @property {string[]} businessOpportunities
 * @property {string} customerMarkets
 * @property {string} launchCadence
 * @property {ReportSource[]} sources
 * @property {string} overallConfidence
 * @property {string} confidenceReason
 * @property {string} marketContext
 * @property {string} customerMarkets
 * @property {import("./marketContextBundle.js").MarketAnalysis} [marketAnalysis]
 * @property {import("./fetchMarketingGuide.js").MarketingGuideReport} [marketingGuide]
 * @property {string} toolGuide
 * @property {string} launchScenario
 * @property {boolean} [campaignActive]
 * @property {string} [source]
 */

/**
 * @param {Object} params
 * @param {'en' | 'es'} params.locale
 * @param {string} params.brandName
 * @param {string} params.analystBrief
 * @param {string} [params.primaryQuestion]
 * @param {object} params.detection
 * @param {string[]} [params.ignoredTopics]
 * @returns {Promise<CampaignAnalystReport>}
 */
export async function fetchCampaignAnalystReport({
  locale = "en",
  brandName,
  analystBrief = "",
  primaryQuestion = "",
  detection = {},
  ignoredTopics = [],
}) {
  return apiClient(API_ROUTES.agentAnalyze, {
    method: "POST",
    body: JSON.stringify({
      locale: locale === "es" ? "es" : "en",
      brandName,
      analystBrief,
      primaryQuestion,
      detection,
      ignoredTopics,
    }),
  });
}
