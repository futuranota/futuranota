import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} HorizonScanHit
 * @property {string} brandName
 * @property {"confirmed_campaign"|"cadence_only"} [detectionMode]
 * @property {string} category
 * @property {boolean} campaignActive
 * @property {string|null} announcementDate
 * @property {string|null} launchDate
 * @property {string} overview
 * @property {number|null} averageIntervalMonths
 * @property {string|null} lastLaunchDate
 * @property {number} [confidence]
 * @property {string} [evidenceUrl]
 * @property {string} [ticketTier]
 * @property {string} [source]
 */

/**
 * Verified discovery — Serper snippets + Groq extract-only.
 * @param {Object} params
 * @param {number} params.rangeDays
 * @param {string} [params.industry]
 * @param {Array<{ domain: string, pathPrefix?: string, enabled?: boolean }>} [params.sources]
 * @returns {Promise<{ companies: HorizonScanHit[], meta?: object }>}
 */
export async function fetchHorizonScan({ rangeDays, industry, sources }) {
  return apiClient(API_ROUTES.horizonScan, {
    method: "POST",
    body: JSON.stringify({ rangeDays, industry, sources: sources || [] }),
  });
}
