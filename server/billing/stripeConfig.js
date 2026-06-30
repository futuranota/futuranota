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

/** One-time live test price (e.g. $0.02) — STRIPE_PRICE_PRO_TEST_MONTHLY or STRIPE_PRICE_PRO_TEST_ONETIME */
export function getStripePriceProTestOneTime() {
  return (
    process.env.STRIPE_PRICE_PRO_TEST_ONETIME
    || process.env.STRIPE_PRICE_PRO_TEST_MONTHLY
    || ""
  ).trim();
}

/** @returns {boolean} */
export function isStripeTestCheckoutEnabled() {
  return (process.env.ENABLE_STRIPE_TEST_CHECKOUT || "").trim() === "true";
}

/** @param {unknown} raw */
export function normalizeCheckoutBilling(raw) {
  if (raw === "test") return "test";
  if (raw === "annual") return "annual";
  return "monthly";
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
