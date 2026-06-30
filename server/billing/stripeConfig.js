/** @returns {string} */
export function getStripeSecretKey() {
  return (
    process.env.STRIPE_SECRET_KEY
    || process.env.STRIPE_API_KEY
    || ""
  ).trim();
}

/** @returns {string} */
export function getStripeWebhookSecret() {
  return (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
}

/** @returns {string} */
export function getStripePriceProMonthly() {
  return (process.env.STRIPE_PRICE_PRO_MONTHLY || "").trim();
}

/** @returns {string} */
export function getStripePriceProAnnual() {
  return (process.env.STRIPE_PRICE_PRO_ANNUAL || "").trim();
}

/** @returns {string} */
export function getAppOrigin() {
  const raw = (
    process.env.APP_URL
    || process.env.VITE_APP_URL
    || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
    || "https://futuranota.com"
  ).trim();
  return raw.replace(/\/$/, "");
}

/** @param {string} [billing] */
export function resolveStripePriceId(billing) {
  return billing === "annual"
    ? getStripePriceProAnnual()
    : getStripePriceProMonthly();
}
