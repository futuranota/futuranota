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

/** Live one-time Pro price (e.g. $0.02) — real production charge, not Stripe test mode. */
export function getStripePriceProVerifyOneTime() {
  return (
    process.env.STRIPE_PRICE_PRO_VERIFY_ONETIME
    || process.env.STRIPE_PRICE_PRO_TEST_ONETIME
    || process.env.STRIPE_PRICE_PRO_TEST_MONTHLY
    || ""
  ).trim();
}

/** @deprecated use getStripePriceProVerifyOneTime */
export const getStripePriceProTestOneTime = getStripePriceProVerifyOneTime;

/** @returns {boolean} */
export function isStripeVerifyCheckoutEnabled() {
  return (
    process.env.ENABLE_STRIPE_VERIFY_CHECKOUT
    || process.env.ENABLE_STRIPE_TEST_CHECKOUT
    || ""
  ).trim() === "true";
}

/** @deprecated use isStripeVerifyCheckoutEnabled */
export const isStripeTestCheckoutEnabled = isStripeVerifyCheckoutEnabled;

/** Server flag + one-time live price configured (safe to expose to client). */
export function isStripeVerifyCheckoutAvailable() {
  return isStripeVerifyCheckoutEnabled() && Boolean(getStripePriceProVerifyOneTime());
}

/** @deprecated use isStripeVerifyCheckoutAvailable */
export const isStripeTestCheckoutAvailable = isStripeVerifyCheckoutAvailable;

/** @param {unknown} raw */
export function normalizeCheckoutBilling(raw) {
  if (raw === "verify" || raw === "test") return "verify";
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
