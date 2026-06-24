import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} CampaignDetectionResponse
 * @property {boolean} campaignActive
 * @property {string|null} launchDate
 * @property {string} overview
 * @property {number} averageIntervalMonths
 * @property {string} lastLaunchDate
 * @property {string} [source]
 */

/**
 * @param {Object} params
 * @param {string} params.brandName
 * @returns {Promise<CampaignDetectionResponse>}
 */
export async function fetchCampaignDetection({ brandName }) {
  return apiClient(API_ROUTES.campaignDetect, {
    method: "POST",
    body: JSON.stringify({ brandName }),
  });
}
