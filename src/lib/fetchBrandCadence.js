import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} BrandCadenceResponse
 * @property {number} averageIntervalMonths
 * @property {string} lastLaunchDate
 * @property {string} [source]
 */

/**
 * @param {Object} params
 * @param {string} params.brandName
 * @param {string} [params.referenceMonthLabel]
 * @returns {Promise<BrandCadenceResponse>}
 */
export async function fetchBrandCadence({ brandName, referenceMonthLabel }) {
  return apiClient(API_ROUTES.brandCadence, {
    method: "POST",
    body: JSON.stringify({ brandName, referenceMonthLabel }),
  });
}
