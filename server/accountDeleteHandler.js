import { getAuthedUser, createServiceSupabase } from "./supabaseServer.js";
import { getStripe } from "./billing/stripeClient.js";
import { deactivateProSubscription } from "./billing/applySubscription.js";

/** Confirm phrase the client must send (case-sensitive). */
export const DELETE_ACCOUNT_CONFIRM = "DELETE";

/**
 * Best-effort wipe of user-owned rows. Missing tables / RLS gaps are ignored.
 * Children before parents where FKs are likely.
 */
const USER_DATA_TABLES = [
  "canvas_connections",
  "canvas_nodes",
  "groupings",
  "timelines",
  "nodes",
  "folders",
  "campaigns",
  "companies",
  "prompt_steps",
  "prompt_files",
  "prompt_collections",
  "prompt_storage_objects",
  "lazy_todos",
  "url_tables",
  "referrals",
  "affiliates",
  "api_usage_events",
  "profiles",
];

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 32_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}

/**
 * Cancel Stripe sub if present (never throws for "no subscription").
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {string} userId
 */
async function softCancelStripe(service, userId) {
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_subscription_id, plan")
    .eq("user_id", userId)
    .maybeSingle();

  const subId = profile?.stripe_subscription_id;
  if (!subId) {
    await deactivateProSubscription(service, userId).catch(() => {});
    return { canceled: false, reason: "none" };
  }

  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(subId);
  } catch (err) {
    console.warn("[account-delete] Stripe cancel:", err?.message || err);
  }
  await deactivateProSubscription(service, userId).catch(() => {});
  return { canceled: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} service
 * @param {string} userId
 * @param {string} [email]
 */
async function wipeUserRows(service, userId, email) {
  const wiped = [];
  const skipped = [];

  for (const table of USER_DATA_TABLES) {
    try {
      let query = service.from(table).delete();
      if (table === "referrals") {
        const a = await service.from(table).delete().eq("referrer_user_id", userId);
        const b = await service.from(table).delete().eq("referred_user_id", userId);
        if (a.error && b.error) {
          skipped.push({ table, error: a.error.message });
        } else {
          wiped.push(table);
        }
        continue;
      }
      if (table === "affiliates") {
        query = query.eq("user_id", userId);
      } else if (table === "api_usage_events") {
        const byId = await service.from(table).delete().eq("user_id", userId);
        if (email) {
          await service.from(table).delete().is("user_id", null).ilike("user_email", email);
        }
        if (byId.error) {
          skipped.push({ table, error: byId.error.message });
        } else {
          wiped.push(table);
        }
        continue;
      } else {
        query = query.eq("user_id", userId);
      }
      const { error } = await query;
      if (error) skipped.push({ table, error: error.message });
      else wiped.push(table);
    } catch (err) {
      skipped.push({ table, error: err instanceof Error ? err.message : "failed" });
    }
  }

  return { wiped, skipped };
}

/**
 * @param {{ headers?: Record<string, string|string[]|undefined>, body?: object }} reqLike
 */
export async function processDeleteAccountRequest(reqLike) {
  const { user } = await getAuthedUser({ headers: reqLike.headers || {} });
  if (!user) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const confirm = String(reqLike.body?.confirm || "").trim();
  if (confirm !== DELETE_ACCOUNT_CONFIRM) {
    return {
      status: 400,
      body: {
        error: `Type ${DELETE_ACCOUNT_CONFIRM} to confirm account deletion`,
      },
    };
  }

  const service = createServiceSupabase();
  if (!service) {
    return {
      status: 503,
      body: { error: "Account deletion is temporarily unavailable" },
    };
  }

  const stripe = await softCancelStripe(service, user.id);
  const wipe = await wipeUserRows(service, user.id, user.email || "");

  const { error: authError } = await service.auth.admin.deleteUser(user.id);
  if (authError) {
    console.warn("[account-delete] auth.admin.deleteUser:", authError.message);
    return {
      status: 500,
      body: {
        error: authError.message || "Could not delete auth user",
        stripe,
        wipe,
      },
    };
  }

  return {
    status: 200,
    body: {
      deleted: true,
      stripe,
      wipe: { tables: wipe.wiped.length, skipped: wipe.skipped.length },
    },
  };
}

export function createAccountDeleteMiddleware() {
  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0].replace(/\/+$/, "") || "/";
    if (path !== "/api/users/delete-account") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await processDeleteAccountRequest({
        headers: req.headers,
        body,
      });
      sendJson(res, result.status, result.body);
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : "Account deletion failed",
      });
    }
  };
}
