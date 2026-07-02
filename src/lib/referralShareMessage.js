import { REFERRAL_REWARD_CREDITS } from "./referralConstants.js";

/**
 * @param {string} url
 * @param {(key: string, vars?: Record<string, string | number>) => string} t
 */
export function buildReferralShareMessage(url, t) {
  const link = String(url || "").trim();
  if (!link) return "";
  return t("referral.shareMessage", {
    url: link,
    credits: REFERRAL_REWARD_CREDITS,
  });
}
