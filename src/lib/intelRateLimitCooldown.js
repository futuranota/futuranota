/** Default Groq cooldown hint: "1–2 minutes" → 90s */
export const INTEL_RATE_LIMIT_COOLDOWN_SEC = 90;

/**
 * @param {string} [message]
 */
export function isIntelRateLimitError(message, code, status) {
  if (status === 429 || code === "rate_limit") return true;
  const lower = String(message || "").toLowerCase();
  return lower.includes("rate limit")
    || lower.includes("429")
    || lower.includes("límite de requests")
    || lower.includes("cuota");
}

/**
 * Parse "retry after 45" / "retry in 30" from provider error text.
 * @param {string} [message]
 * @returns {number|null}
 */
export function parseRetryAfterSeconds(message) {
  const match = String(message || "").match(/retry(?:\s+after|\s+in)[^0-9]*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const seconds = Number.parseFloat(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/**
 * @param {string} [message]
 */
export function resolveIntelRateLimitCooldownSec(message) {
  return parseRetryAfterSeconds(message) ?? INTEL_RATE_LIMIT_COOLDOWN_SEC;
}

/** @param {number} totalSec @param {number} remainingSec */
export function rateLimitProgress(totalSec, remainingSec) {
  if (totalSec <= 0) return 0;
  return Math.max(0, Math.min(1, remainingSec / totalSec));
}

/** @param {number} sec */
export function formatRateLimitClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
