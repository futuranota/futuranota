/**
 * Confirmed provider tariffs for Phase A dynamic cost (see api-cost-roadmap).
 * Groq: USD per 1M tokens. Apify: USD per compute unit.
 */

export const APIFY_USD_PER_CU = 0.2;

/** @type {Record<string, { inputPerMTok: number, outputPerMTok: number }>} */
export const GROQ_MODEL_PRICES = {
  "llama-3.1-8b-instant": { inputPerMTok: 0.75, outputPerMTok: 1.5 },
  "llama-3.3-70b-versatile": { inputPerMTok: 1.05, outputPerMTok: 2.1 },
};

const DEFAULT_GROQ_PRICE = GROQ_MODEL_PRICES["llama-3.3-70b-versatile"];

/**
 * @param {string} [model]
 */
export function getGroqModelPrice(model) {
  const key = typeof model === "string" ? model.trim() : "";
  return GROQ_MODEL_PRICES[key] || DEFAULT_GROQ_PRICE;
}

/**
 * @param {{ inputTokens?: number|null, outputTokens?: number|null, model?: string|null }} opts
 * @returns {number}
 */
export function estimateGroqCostUsd(opts = {}) {
  const inputTokens = Math.max(0, Number(opts.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(opts.outputTokens) || 0);
  const price = getGroqModelPrice(opts.model);
  return (inputTokens / 1e6) * price.inputPerMTok + (outputTokens / 1e6) * price.outputPerMTok;
}

/**
 * Prefer Apify usageTotalUsd; else computeUnits × $0.20.
 * @param {{ usageTotalUsd?: number|null, computeUnits?: number|null }} opts
 * @returns {number|null}
 */
export function estimateApifyCostUsd(opts = {}) {
  if (opts.usageTotalUsd != null && Number.isFinite(Number(opts.usageTotalUsd))) {
    return Number(opts.usageTotalUsd);
  }
  if (opts.computeUnits != null && Number.isFinite(Number(opts.computeUnits))) {
    return Number(opts.computeUnits) * APIFY_USD_PER_CU;
  }
  return null;
}

/**
 * Normalize Groq/OpenAI-style usage object.
 * @param {unknown} usage
 * @returns {{ inputTokens: number, outputTokens: number } | null}
 */
export function normalizeLlmUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const u = /** @type {Record<string, unknown>} */ (usage);
  const inputTokens = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const outputTokens = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens)) return null;
  return {
    inputTokens: Math.max(0, inputTokens || 0),
    outputTokens: Math.max(0, outputTokens || 0),
  };
}
