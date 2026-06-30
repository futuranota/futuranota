const DISMISS_KEY = "fn_referral_banner_dismissed";

export function isReferralBannerDismissed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissReferralBanner() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, "1");
}

export function resetReferralBannerDismiss() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DISMISS_KEY);
}
