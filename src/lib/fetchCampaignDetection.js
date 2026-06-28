import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} CampaignLaunchSignal
 * @property {string} phrase
 * @property {string|null} dateHint
 * @property {string} url
 * @property {string} quote
 */

/**
 * @typedef {Object} CampaignCitation
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} domain
 * @property {string} source
 * @property {string} body
 */

/**
 * @typedef {Object} MarketInterest
 * @property {string} keyword
 * @property {number|null} interestChangePercent
 * @property {string[]} topRegions
 * @property {"dataforseo"|"unavailable"} source
 */

/**
 * @typedef {Object} CampaignDetectionResponse
 * @property {boolean} campaignActive
 * @property {string|null} launchDate
 * @property {string} overview
 * @property {string} [deepReport]
 * @property {CampaignLaunchSignal[]} [launchSignals]
 * @property {CampaignCitation[]} [citations]
 * @property {MarketInterest} [marketInterest]
 * @property {number|null} averageIntervalMonths
 * @property {string|null} lastLaunchDate
 * @property {string} [source]
 * @property {"confirmed_campaign"|"cadence_only"|"no_data"|null} [detectionMode]
 * @property {"watch"|"discard"|"no_data"|null} [cadenceStatus]
 * @property {string|null} [cadenceMessage]
 * @property {number|null} [monthsRemaining]
 * @property {string|null} [estimatedLaunchDate]
 * @property {number|null} [confidence]
 * @property {string|null} [evidenceUrl]
 * @property {string|null} [error]
 * @property {boolean} [noData]
 * @property {"deep"} [mode]
 */

/**
 * @param {Object} params
 * @param {string} params.brandName
 * @param {number} [params.rangeDays]
 * @param {Array<{ domain: string, enabled?: boolean }>} [params.sources]
 * @param {"deep"} [params.mode]
 * @param {string} [params.officialDomain]
 * @param {string} [params.userQuery]
 * @param {string} [params.analystBrief]
 * @param {'en' | 'es'} [params.locale]
 * @returns {Promise<CampaignDetectionResponse>}
 */
export async function fetchCampaignDetection({
  brandName,
  rangeDays,
  sources,
  mode,
  officialDomain,
  userQuery,
  analystBrief,
  locale,
}) {
  return apiClient(API_ROUTES.campaignDetect, {
    method: "POST",
    body: JSON.stringify({
      brandName,
      rangeDays,
      sources: sources || [],
      mode,
      officialDomain,
      userQuery,
      analystBrief,
      locale: locale === "es" ? "es" : "en",
    }),
  });
}

/** True when a batch scan hit should surface in the main results list. */
export function shouldIncludeInBatchScan(result) {
  if (result.campaignActive || result.detectionMode === "confirmed_campaign") return true;
  if (result.cadenceStatus === "watch") return true;
  return false;
}
