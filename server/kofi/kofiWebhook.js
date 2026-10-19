import { timingSafeEqual } from "node:crypto";

/** Audience from the Mailchimp embed used for supporter emails. */
export const KOFI_MAILCHIMP = {
  jsonUrl: "https://ticketradius.us1.list-manage.com/subscribe/post-json",
  u: "a8c21b422d28dbeec55f9f9ce",
  id: "cab54655b9",
  fId: "00ded0e0f0",
  honeypotName: "b_a8c21b422d28dbeec55f9f9ce_cab54655b9",
  tags: "3182391",
};

const seenMessageIds = new Set();
const MAX_SEEN = 500;

/**
 * @param {unknown} body
 * @param {string | null | undefined} raw
 */
export function parseKofiData(body, raw) {
  if (body && typeof body === "object") {
    const record = /** @type {Record<string, unknown>} */ (body);
    if (typeof record.data === "string" && record.data.trim()) {
      return JSON.parse(record.data);
    }
    if (record.data && typeof record.data === "object") return record.data;
    if (typeof record.verification_token === "string") return record;
  }

  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  if (text.startsWith("{")) return JSON.parse(text);

  const data = new URLSearchParams(text).get("data");
  if (!data) return null;
  return JSON.parse(data);
}

/**
 * @param {string | undefined} received
 * @param {string} expected
 */
export function verificationTokensMatch(received, expected) {
  const left = Buffer.from(String(received || ""));
  const right = Buffer.from(String(expected || ""));
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} tierName
 */
export function classifyKofiPayment(payload, tierName) {
  const type = String(payload.type || "");
  const tier = String(payload.tier_name || "").trim().toLowerCase();
  const wanted = String(tierName || "Bronze").trim().toLowerCase();
  const email = String(payload.email || "").trim();
  const first = payload.is_first_subscription_payment === true;

  if (type !== "Subscription") return { subscribe: false, reason: "not_subscription" };
  if (tier !== wanted) return { subscribe: false, reason: "tier_mismatch" };
  if (!first) return { subscribe: false, reason: "not_first_payment" };
  if (!email) return { subscribe: false, reason: "missing_email" };
  return { subscribe: true, email };
}

/**
 * @param {Set<string>} seen
 * @param {string} messageId
 */
function rememberMessage(seen, messageId) {
  seen.add(messageId);
  if (seen.size <= MAX_SEEN) return;
  const oldest = seen.values().next().value;
  if (oldest) seen.delete(oldest);
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, "").trim();
}

/**
 * @param {string} email
 */
export async function subscribeKofiSupporter(email) {
  const params = new URLSearchParams({
    u: KOFI_MAILCHIMP.u,
    id: KOFI_MAILCHIMP.id,
    f_id: KOFI_MAILCHIMP.fId,
    EMAIL: email,
    tags: KOFI_MAILCHIMP.tags,
    c: "kofiCb",
  });
  params.set(KOFI_MAILCHIMP.honeypotName, "");

  const response = await fetch(`${KOFI_MAILCHIMP.jsonUrl}?${params.toString()}`);
  const text = await response.text();
  const jsonText = text.replace(/^[^(]*\(/, "").replace(/\)\s*;?\s*$/, "");
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("Mailchimp returned an unreadable response");
  }

  const msg = stripHtml(data?.msg);
  const already = /already subscribed/i.test(msg);
  if (data?.result === "success" || already) {
    return { result: already ? "exists" : "success", msg };
  }
  throw new Error(msg || "Mailchimp rejected the subscribe");
}

/**
 * @param {{ body?: unknown, raw?: string | null, env?: NodeJS.ProcessEnv, subscribe?: (email: string) => Promise<{ result: string, msg?: string }>, seen?: Set<string> }} input
 */
export async function handleKofiWebhook({
  body = null,
  raw = null,
  env = process.env,
  subscribe = subscribeKofiSupporter,
  seen = seenMessageIds,
} = {}) {
  const expected = String(env.KOFI_VERIFICATION_TOKEN || "").trim();
  if (!expected) {
    return { status: 500, body: { error: "Ko-fi webhook is not configured" } };
  }

  let payload;
  try {
    payload = parseKofiData(body, raw);
  } catch {
    return { status: 400, body: { error: "Invalid payload" } };
  }
  if (!payload || typeof payload !== "object") {
    return { status: 400, body: { error: "Invalid payload" } };
  }

  if (!verificationTokensMatch(payload.verification_token, expected)) {
    return { status: 400, body: { error: "Invalid verification token" } };
  }

  const messageId = String(payload.message_id || "");
  if (messageId && seen.has(messageId)) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  const tierName = String(env.KOFI_TIER_NAME || "Bronze");
  const action = classifyKofiPayment(payload, tierName);
  if (!action.subscribe) {
    if (messageId) rememberMessage(seen, messageId);
    return { status: 200, body: { received: true, subscribed: false, reason: action.reason } };
  }

  try {
    const result = await subscribe(action.email);
    if (messageId) rememberMessage(seen, messageId);
    return {
      status: 200,
      body: { received: true, subscribed: true, mailchimp: result.result },
    };
  } catch {
    return { status: 500, body: { error: "Could not save supporter email" } };
  }
}
