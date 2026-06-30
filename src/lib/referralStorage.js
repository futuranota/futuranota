const REFERRAL_KEY = "fn_referral_code";

/** @param {URLSearchParams | string | null | undefined} input */
export function captureReferralFromSearch(input) {
  if (typeof window === "undefined") return;
  let ref = "";
  if (input instanceof URLSearchParams) {
    ref = input.get("ref") || "";
  } else if (typeof input === "string") {
    try {
      ref = new URLSearchParams(input).get("ref") || "";
    } catch {
      ref = "";
    }
  }
  const code = ref.trim().toUpperCase();
  if (code) {
    localStorage.setItem(REFERRAL_KEY, code);
  }
}

/** @param {string} [search] */
export function captureReferralFromLocation(search = window.location.search) {
  captureReferralFromSearch(search);
}

export function getStoredReferralCode() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REFERRAL_KEY) || "";
}

export function clearStoredReferralCode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFERRAL_KEY);
}
