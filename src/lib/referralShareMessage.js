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

/** Invite/promo copy for Payments & Billings — not framed as an affiliate. */
export function buildPromoShareMessage(url, t) {
  const link = String(url || "").trim();
  if (!link) return "";
  return t("referral.promoShareMessage", { url: link });
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rich-text clipboard payload: same message with the affiliate URL as a real hyperlink.
 * Destinations that only accept plain text still get the URL via text/plain.
 *
 * @param {string} plainMessage
 * @param {string} url
 */
export function buildReferralShareMessageHtml(plainMessage, url) {
  const link = String(url || "").trim();
  const plain = String(plainMessage || "");
  if (!plain || !link) return "";

  const escaped = escapeHtml(plain).replace(/\r\n|\r|\n/g, "<br>");
  const href = escapeHtml(link);
  const linked = escaped.split(href).join(`<a href="${href}">${href}</a>`);
  return `<meta charset="utf-8"><div>${linked}</div>`;
}

/**
 * Copies plain + HTML when supported so rich editors paste a clickable link;
 * falls back to plain text for chats and older browsers.
 *
 * @param {string} plainMessage
 * @param {string} url
 */
export async function copyReferralShareMessage(plainMessage, url) {
  const plain = String(plainMessage || "");
  if (!plain) return;

  const html = buildReferralShareMessageHtml(plain, url);
  if (
    html &&
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          // Promise wrappers improve Safari ClipboardItem compatibility.
          "text/plain": Promise.resolve(new Blob([plain], { type: "text/plain" })),
          "text/html": Promise.resolve(new Blob([html], { type: "text/html" })),
        }),
      ]);
      return;
    } catch {
      // Fall through to writeText.
    }
  }

  await navigator.clipboard.writeText(plain);
}
