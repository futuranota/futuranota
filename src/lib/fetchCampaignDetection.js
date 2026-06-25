import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} CampaignDetectionResponse
 * @property {boolean} campaignActive
 * @property {string|null} launchDate
 * @property {string} overview
 * @property {number|null} averageIntervalMonths
 * @property {string|null} lastLaunchDate
 * @property {string} [source]
 * @property {"confirmed_campaign"|"cadence_only"|null} [detectionMode]
 * @property {"watch"|"discard"|"no_data"|null} [cadenceStatus]
 * @property {string|null} [cadenceMessage]
 * @property {number|null} [monthsRemaining]
 * @property {string|null} [estimatedLaunchDate]
 * @property {number|null} [confidence]
 * @property {string|null} [evidenceUrl]
 * @property {string|null} [error]
 * @property {boolean} [noData]
 */

/**
 * @param {Object} params
 * @param {string} params.brandName
 * @param {number} [params.rangeDays]
 * @param {Array<{ domain: string, enabled?: boolean }>} [params.sources]
 * @returns {Promise<CampaignDetectionResponse>}
 */
export async function fetchCampaignDetection({ brandName, rangeDays, sources }) {
  return apiClient(API_ROUTES.campaignDetect, {
    method: "POST",
    body: JSON.stringify({
      brandName,
      rangeDays,
      sources: sources || [],
    }),
  });
}

/** True when a batch scan hit should surface in the main results list. */
export function shouldIncludeInBatchScan(result) {
  if (result.campaignActive || result.detectionMode === "confirmed_campaign") return true;
  if (result.cadenceStatus === "watch") return true;
  return false;
}
