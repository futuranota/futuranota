/** @typedef {'free'|'pro'} PlanId */
/** @typedef {'groq'} IntelModelProvider */

/**
 * @typedef {Object} IntelModelDef
 * @property {string} id
 * @property {string} label
 * @property {IntelModelProvider} provider
 * @property {string} apiModel
 * @property {number} creditCost
 * @property {number} tokenCost
 * @property {PlanId[]} plansAllowed
 */

export const DEFAULT_INTEL_MODEL_ID = "groq-llama-70b";

export const CREDIT_TOKEN_UNIT = 10_000;

/** @type {IntelModelDef[]} */
export const INTEL_MODELS = [
  {
    id: "groq-llama-70b",
    label: "Groq Llama 3.3 70B",
    provider: "groq",
    apiModel: "llama-3.3-70b-versatile",
    creditCost: 1,
    tokenCost: 10_000,
    plansAllowed: ["free", "pro"],
  },
  {
    id: "groq-llama-8b",
    label: "Groq Llama 3.1 8B",
    provider: "groq",
    apiModel: "llama-3.1-8b-instant",
    creditCost: 1,
    tokenCost: 10_000,
    plansAllowed: ["free", "pro"],
  },
];

const MODEL_BY_ID = new Map(INTEL_MODELS.map((m) => [m.id, m]));

/**
 * @param {string} [modelId]
 * @returns {IntelModelDef}
 */
export function getIntelModel(modelId) {
  const id = typeof modelId === "string" ? modelId.trim() : "";
  return MODEL_BY_ID.get(id) || MODEL_BY_ID.get(DEFAULT_INTEL_MODEL_ID);
}

/**
 * @param {PlanId|string} [plan]
 * @returns {IntelModelDef}
 */
export function getDefaultIntelModel(plan = "free") {
  const planId = plan === "pro" ? "pro" : "free";
  const preferred = getIntelModel(DEFAULT_INTEL_MODEL_ID);
  if (preferred.plansAllowed.includes(planId)) return preferred;
  return INTEL_MODELS.find((m) => m.plansAllowed.includes(planId)) || preferred;
}

/**
 * @param {PlanId|string} [plan]
 * @returns {IntelModelDef[]}
 */
export function getIntelModelOptions(plan = "free") {
  const planId = plan === "pro" ? "pro" : "free";
  return INTEL_MODELS.filter((m) => m.plansAllowed.includes(planId));
}

/**
 * All catalog models for UI lists (includes plan-locked entries).
 * @param {PlanId|string} [plan]
 * @returns {(IntelModelDef & { selectable: boolean })[]}
 */
export function getIntelModelCatalog(plan = "free") {
  const planId = plan === "pro" ? "pro" : "free";
  return INTEL_MODELS.map((model) => ({
    ...model,
    selectable: model.plansAllowed.includes(planId),
  }));
}

/**
 * @param {IntelModelDef} model
 * @param {PlanId|string} plan
 */
export function isIntelModelAllowedForPlan(model, plan) {
  const planId = plan === "pro" ? "pro" : "free";
  return model.plansAllowed.includes(planId);
}

/**
 * @param {string} [modelId]
 * @param {PlanId|string} [plan]
 * @returns {IntelModelDef}
 */
export function resolveIntelModelForPlan(modelId, plan = "free") {
  const model = getIntelModel(modelId);
  if (isIntelModelAllowedForPlan(model, plan)) return model;
  return getDefaultIntelModel(plan);
}

/**
 * @param {IntelModelDef} model
 */
export function resolveIntelModelApiModel(model) {
  return model.apiModel;
}
