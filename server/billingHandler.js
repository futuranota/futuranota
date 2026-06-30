import { getAuthedUser } from "./supabaseServer.js";
import { readJsonBody, readRawBody } from "./billing/readBody.js";
import {
  cancelUserSubscription,
  createCheckoutSession,
  getAffiliateLinkForUser,
  getReferralHistoryForUser,
  sendReferralInvitesForUser,
  verifyAndProcessWebhook,
} from "./billing/billingActions.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function corsPreflight(res) {
  res.statusCode = 204;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Stripe-Signature");
  res.end();
}

/**
 * Vite dev middleware for /api/billing/*
 */
export function createBillingMiddleware() {
  return async (req, res, next) => {
    const path = req.url?.split("?")[0] || "";

    if (!path.startsWith("/api/billing")) {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      corsPreflight(res);
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      if (path === "/api/billing/webhook" && req.method === "POST") {
        const raw = await readRawBody(req);
        const signature = req.headers["stripe-signature"];
        await verifyAndProcessWebhook(raw, signature);
        sendJson(res, 200, { received: true });
        return;
      }

      if (path === "/api/billing/checkout" && req.method === "POST") {
        const { user } = await getAuthedUser(req);
        if (!user) {
          sendJson(res, 401, { error: "Unauthorized" });
          return;
        }
        const body = await readJsonBody(req);
        const billing = body.billing === "annual" ? "annual" : "monthly";
        const referralCode = typeof body.referralCode === "string" ? body.referralCode : "";
        const result = await createCheckoutSession({
          userId: user.id,
          email: user.email,
          billing,
          referralCode,
        });
        sendJson(res, 200, result);
        return;
      }

      if (path === "/api/billing/cancel" && req.method === "POST") {
        const { user } = await getAuthedUser(req);
        if (!user) {
          sendJson(res, 401, { error: "Unauthorized" });
          return;
        }
        const result = await cancelUserSubscription(user.id);
        sendJson(res, 200, result);
        return;
      }

      if (path === "/api/billing/affiliate" && req.method === "GET") {
        const { user } = await getAuthedUser(req);
        if (!user) {
          sendJson(res, 401, { error: "Unauthorized" });
          return;
        }
        const result = await getAffiliateLinkForUser(user.id);
        sendJson(res, 200, result);
        return;
      }

      if (path === "/api/billing/referral-history" && req.method === "GET") {
        const { user, supabase } = await getAuthedUser(req);
        if (!user || !supabase) {
          sendJson(res, 401, { error: "Unauthorized" });
          return;
        }
        const result = await getReferralHistoryForUser(supabase, user.id);
        sendJson(res, 200, result);
        return;
      }

      if (path === "/api/billing/referral-invite" && req.method === "POST") {
        const { user } = await getAuthedUser(req);
        if (!user) {
          sendJson(res, 401, { error: "Unauthorized" });
          return;
        }
        const body = await readJsonBody(req);
        const emails = typeof body.emails === "string" ? body.emails : "";
        const referrerName = typeof body.referrerName === "string" ? body.referrerName : undefined;
        const result = await sendReferralInvitesForUser({
          userId: user.id,
          emails,
          referrerName,
          referrerEmail: user.email,
        });
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Billing request failed";
      const status = message.includes("signature") ? 400 : 500;
      sendJson(res, status, { error: message });
    }
  };
}
