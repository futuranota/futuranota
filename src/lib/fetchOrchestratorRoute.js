import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} OrchestratorPlan
 * @property {"delegate_campaign_analysis"|"ignore_off_topic"|"error"} intent
 * @property {string|null} brandName
 * @property {string|null} targetDocId
 * @property {string} analystBrief
 * @property {"campaign-analyst"|null} delegateTo
 * @property {string[]} ignoredTopics
 * @property {string} routingNote
 * @property {string} userFacingMessage
 * @property {string|null} errorCode
 * @property {string} [source]
 */

/**
 * @param {Object} params
 * @param {'en' | 'es'} params.locale
 * @param {object} params.canvasContext
 * @returns {Promise<OrchestratorPlan>}
 */
export async function fetchOrchestratorRoute({ locale = "en", canvasContext }) {
  return apiClient(API_ROUTES.agentOrchestrate, {
    method: "POST",
    body: JSON.stringify({
      locale: locale === "es" ? "es" : "en",
      canvasContext,
    }),
  });
}
