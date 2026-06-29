import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} SocialHypeAnalystSections
 * @property {string} channelVerdict
 * @property {string} preferredChannel
 * @property {string} whySameChannel
 * @property {string[]} themes
 * @property {string} companionAction
 * @property {string} risks
 * @property {string} [source]
 */

/**
 * @typedef {Object} HypeDistributionV1
 * @property {string} version
 * @property {string} brandName
 * @property {string} keyword
 * @property {boolean} campaignActive
 * @property {object} status
 * @property {object} socialHype
 * @property {object} searchIntent
 * @property {object} channelIntel
 * @property {Array<{ url: string, type: string, platform: string }>} sources
 * @property {string} collectedAt
 * @property {string[]} collectorSources
 */

/**
 * @typedef {Object} SocialHypeAnalystResponse
 * @property {HypeDistributionV1} hypeDistribution
 * @property {SocialHypeAnalystSections} analystSections
 * @property {string} source
 */

/**
 * @param {{ brandName: string, keyword?: string, locale?: 'en'|'es' }} params
 * @returns {Promise<SocialHypeAnalystResponse>}
 */
export async function fetchSocialHypeAnalyst({ brandName, keyword, locale = "en" }) {
  const payload = {
    brandName,
    keyword,
    locale,
  };

  try {
    return await apiClient(API_ROUTES.agentSocialHypeAnalyst, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.includes("404")) throw err;

    return apiClient(API_ROUTES.socialHypeAnalytics, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}
