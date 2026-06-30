import { getAuthedUser } from "../../server/supabaseServer.js";
import {
  cancelUserSubscription,
  createCheckoutSession,
  getAffiliateLinkForUser,
} from "../../server/billing/billingActions.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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
    const { user } = await getAuthedUser(fakeReq);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const billing = body.billing === "annual" ? "annual" : "monthly";
    const referralCode = typeof body.referralCode === "string" ? body.referralCode : "";
    const result = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      billing,
      referralCode,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Checkout failed",
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
    const { user } = await getAuthedUser(fakeReq);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await cancelUserSubscription(user.id);
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
    const { user } = await getAuthedUser(fakeReq);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await getAffiliateLinkForUser(user.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Affiliate lookup failed",
    });
  }
}
