import { Resend } from "resend";
import { getAppOrigin } from "./stripeConfig.js";
import { REFERRAL_REWARD_CREDITS } from "./applySubscription.js";

function getResendClient() {
  const key = (
    process.env.RESEND_API_KEY
    || process.env.RESEND_API
    || ""
  ).trim();
  if (!key) return null;
  return new Resend(key);
}

function getFromAddress() {
  return (
    process.env.REFERRAL_FROM_EMAIL
    || process.env.RESEND_FROM_EMAIL
    || "Futura Nota <onboarding@resend.dev>"
  ).trim();
}

/** @param {string} raw */
export function parseInviteEmails(raw) {
  const parts = String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  const valid = unique.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return valid.slice(0, 10);
}

/**
 * @param {{ to: string[], referralUrl: string, referrerName?: string }} params
 */
export async function sendReferralInviteEmails(params) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { to, referralUrl, referrerName } = params;
  if (!to.length) {
    throw new Error("No valid email addresses");
  }

  const origin = getAppOrigin();
  const name = referrerName || "A friend";
  const subject = `${name} invited you to Futura Nota`;
  const html = `
    <p>${name} thinks you'd like <strong>Futura Nota</strong> — launch planning for makers and founders.</p>
    <p>Sign up with their link and explore Starter free. When you subscribe to <strong>Pro monthly</strong>, they earn <strong>${REFERRAL_REWARD_CREDITS} AI credits</strong>.</p>
    <p><a href="${referralUrl}">${referralUrl}</a></p>
    <p style="color:#666;font-size:12px;">Futura Nota · ${origin}</p>
  `.trim();

  const from = getFromAddress();
  const results = await Promise.allSettled(
    to.map((email) => resend.emails.send({
      from,
      to: email,
      subject,
      html,
    })),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  if (sent === 0) {
    const reason = results[0]?.status === "rejected"
      ? results[0].reason
      : "Send failed";
    throw new Error(reason instanceof Error ? reason.message : String(reason));
  }

  return { sent, failed, total: results.length };
}
