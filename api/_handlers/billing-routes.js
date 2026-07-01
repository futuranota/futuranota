import { getAuthedUser } from "../../server/supabaseServer.js";
import {
  cancelUserSubscription,
  confirmCheckoutSession,
  createCheckoutSession,
  getAffiliateLinkForUser,
  getReferralHistoryForUser,
  resolveCheckoutEmail,
  sendReferralInvitesForUser,
} from "../../server/billing/billingActions.js";
import {
  isStripeVerifyCheckoutAvailable,
  normalizeCheckoutBilling,
} from "../../server/billing/stripeConfig.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export async function handleVerifyCheckoutStatus(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.status(200).json({ available: isStripeVerifyCheckoutAvailable() });
}

/** @deprecated alias */
export const handleTestCheckoutStatus = handleVerifyCheckoutStatus;

export async function handleCheckout(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user, supabase } = await getAuthedUser(fakeReq);
    if (!user || !supabase) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const billing = normalizeCheckoutBilling(body.billing);
    const referralCode = typeof body.referralCode === "string" ? body.referralCode : "";
    const result = await createCheckoutSession({
      userId: user.id,
      email: resolveCheckoutEmail(user),
      billing,
      referralCode,
      supabase,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Checkout failed",
    });
  }
}

export async function handleConfirmCheckout(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user } = await getAuthedUser(fakeReq);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const result = await confirmCheckoutSession(user.id, sessionId);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Confirm checkout failed",
    });
  }
}

export async function handleCancel(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user, supabase } = await getAuthedUser(fakeReq);
    if (!user || !supabase) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await cancelUserSubscription(user.id, supabase);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Cancel failed",
    });
  }
}

export async function handleAffiliate(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user, supabase } = await getAuthedUser(fakeReq);
    if (!user || !supabase) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await getAffiliateLinkForUser(user.id, supabase);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Affiliate lookup failed",
    });
  }
}

export async function handleReferralHistory(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user, supabase } = await getAuthedUser(fakeReq);
    if (!user || !supabase) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await getReferralHistoryForUser(supabase, user.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Referral history failed",
    });
  }
}

export async function handleReferralInvite(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const fakeReq = { headers: { authorization: token ? `Bearer ${token}` : "" } };
    const { user, supabase } = await getAuthedUser(fakeReq);
    if (!user || !supabase) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const emails = typeof body.emails === "string" ? body.emails : "";
    const referrerName = typeof body.referrerName === "string" ? body.referrerName : undefined;
    const result = await sendReferralInvitesForUser({
      userId: user.id,
      emails,
      referrerName,
      referrerEmail: user.email,
      supabase,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Invite send failed",
    });
  }
}
