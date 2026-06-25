import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} HorizonScanHit
 * @property {string} brandName
 * @property {string} category
 * @property {boolean} campaignActive
 * @property {string|null} launchDate
 * @property {string} overview
 * @property {number} averageIntervalMonths
 * @property {string} lastLaunchDate
 * @property {string} [source]
 */

/**
 * Open discovery — asks Groq for companies (not limited to any given list)
 * with a launch/campaign expected within `rangeDays` from today.
 * @param {Object} params
 * @param {number} params.rangeDays
 * @param {string} [params.industry]
 * @returns {Promise<{ companies: HorizonScanHit[] }>}
 */
export async function fetchHorizonScan({ rangeDays, industry }) {
  return apiClient(API_ROUTES.horizonScan, {
    method: "POST",
    body: JSON.stringify({ rangeDays, industry }),
  });
}
