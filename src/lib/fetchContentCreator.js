import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @typedef {Object} ContentPlanItem
 * @property {string} text
 */

/**
 * @typedef {Object} ContentCreatorPlan
 * @property {string} listTitle
 * @property {ContentPlanItem[]} items
 * @property {string} platformRecommendation
 * @property {string} nextStepsMessage
 * @property {string} [source]
 */

/**
 * @param {{
 *   instruction: string,
 *   brandContext?: object,
 *   knowledgeContext?: string,
 *   wiredInputs?: object[],
 *   mode?: 'document_plan'|'macro_blog',
 *   macroTitle?: string,
 *   scheduleAt?: string|null,
 *   locale?: 'en'|'es',
 * }} params
 * @returns {Promise<ContentCreatorPlan>}
 */
export async function fetchContentCreator({
  instruction,
  brandContext = {},
  knowledgeContext = "",
  wiredInputs = [],
  mode = "document_plan",
  macroTitle = "",
  scheduleAt = null,
  locale = "en",
}) {
  const payload = {
    instruction,
    brandContext,
    knowledgeContext,
    wiredInputs,
    mode,
    macroTitle,
    scheduleAt,
    locale,
  };

  return apiClient(API_ROUTES.agentContentCreator, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
