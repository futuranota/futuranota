import {
  CREDIT_TOKEN_UNIT,
  DEFAULT_INTEL_MODEL_ID,
  INTEL_MODELS as BASE_INTEL_MODELS,
  getDefaultIntelModel,
  getIntelModelOptions,
  isIntelModelAllowedForPlan,
  resolveIntelModelApiModel,
  resolveIntelModelForPlan,
} from "../src/lib/intelModels.js";

export {
  CREDIT_TOKEN_UNIT,
  DEFAULT_INTEL_MODEL_ID,
  getDefaultIntelModel,
  getIntelModelOptions,
  isIntelModelAllowedForPlan,
  resolveIntelModelApiModel,
  resolveIntelModelForPlan,
};

const API_MODEL_ENV = {
  "groq-llama-70b": process.env.GROQ_MODEL,
  "groq-llama-8b": process.env.GROQ_FALLBACK_MODEL,
};

export const INTEL_MODELS = BASE_INTEL_MODELS.map((model) => ({
  ...model,
  apiModel: API_MODEL_ENV[model.id] || model.apiModel,
}));

/**
 * Models whose provider API key is configured on the server.
 * @param {typeof INTEL_MODELS} [models]
 */
export function filterIntelModelsByConfiguredProviders(models = INTEL_MODELS) {
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());

  return models.filter((model) => model.provider === "groq" && hasGroq);
}

/**
 * @param {string} [plan]
 */
export function getActiveIntelModelsForPlan(plan = "free") {
  const planId = plan === "pro" ? "pro" : "free";
  return filterIntelModelsByConfiguredProviders().map((model) => ({
    id: model.id,
    label: model.label,
    provider: model.provider,
    creditCost: model.creditCost,
    tokenCost: model.tokenCost,
    selectable: model.plansAllowed.includes(planId),
  }));
}

const MODEL_BY_ID = new Map(INTEL_MODELS.map((m) => [m.id, m]));

/**
 * @param {string} [modelId]
 */
export function getIntelModel(modelId) {
  const id = typeof modelId === "string" ? modelId.trim() : "";
  return MODEL_BY_ID.get(id) || MODEL_BY_ID.get(DEFAULT_INTEL_MODEL_ID);
}
