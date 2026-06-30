import { getStripe } from "./stripeClient.js";
import {
  getAppOrigin,
  getStripePriceProVerifyOneTime,
  isStripeVerifyCheckoutAvailable,
  isStripeVerifyCheckoutEnabled,
  resolveStripePriceId,
} from "./stripeConfig.js";
import {
  activateProSubscription,
  deactivateProSubscription,
  ensureAffiliateCode,
  findAffiliateByCode,
  grantReferralRewardIfEligible,
  requireServiceSupabase,
} from "./applySubscription.js";
import { getTokensCap } from "../../src/lib/planConfig.js";
import { parseInviteEmails, sendReferralInviteEmails } from "./referralMail.js";

/**
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 */
export function resolveCheckoutEmail(user) {
  const fromUser = (user?.email || "").trim();
  if (fromUser) return fromUser.toLowerCase();

  const meta = user?.user_metadata || {};
  const fromMeta = (
    meta.email
    || meta.preferred_email
    || ""
  ).trim();
  if (fromMeta && fromMeta.includes("@")) return fromMeta.toLowerCase();

  const identityEmail = (user?.identities || [])
    .map((id) => id?.identity_data?.email)
    .find((e) => typeof e === "string" && e.includes("@"));
  if (identityEmail) return identityEmail.trim().toLowerCase();

  return "";
}

/**
 * @param {unknown} err
 */
function isStaleStripeCustomerError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("No such customer")
    || msg.includes("similar object exists in live mode")
    || msg.includes("similar object exists in test mode");
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function clearStripeCustomerId(supabase, userId) {
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * @param {import('stripe').Stripe} stripe
 * @param {string} customerId
 * @param {string} email
 */
async function syncStripeCustomerContact(stripe, customerId, email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    throw new Error("No such customer: deleted");
  }

  const patch = /** @type {import('stripe').Stripe.CustomerUpdateParams} */ ({});
  const currentEmail = (customer.email || "").trim().toLowerCase();
  if (currentEmail !== normalized) {
    patch.email = normalized;
  }
  if (customer.phone) {
    patch.phone = "";
  }

  if (Object.keys(patch).length) {
    await stripe.customers.update(customerId, patch);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} email
 */
async function getOrCreateStripeCustomer(supabase, userId, email) {
  const stripe = getStripe();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (profile?.stripe_customer_id) {
    try {
      await syncStripeCustomerContact(stripe, profile.stripe_customer_id, normalizedEmail);
      return profile.stripe_customer_id;
    } catch (err) {
      if (!isStaleStripeCustomerError(err)) throw err;
      await clearStripeCustomerId(supabase, userId);
    }
  }

  const customer = await stripe.customers.create({
    email: normalizedEmail || undefined,
    metadata: { userId },
  });

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updateErr) throw new Error(updateErr.message);

  return customer.id;
}

/**
 * @param {{ userId: string, email?: string, billing?: string, referralCode?: string, supabase: import('@supabase/supabase-js').SupabaseClient }} params
 */
export async function createCheckoutSession(params) {
  const { userId, email, billing = "monthly", referralCode = "", supabase } = params;
  if (!supabase) {
    throw new Error("Authenticated Supabase client is required");
  }

  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error(
      "Add an email to your account before upgrading (email/password signup or Google sign-in).",
    );
  }

  const customerId = await getOrCreateStripeCustomer(supabase, userId, normalizedEmail);
  const origin = getAppOrigin();
  const stripe = getStripe();
  const successUrl = `${origin}/app/plans?checkout=success`;
  const cancelUrl = `${origin}/app/plans?checkout=canceled`;

  if (billing === "verify") {
    if (!isStripeVerifyCheckoutEnabled()) {
      throw new Error("Pro verify checkout is disabled");
    }
    const verifyPriceId = getStripePriceProVerifyOneTime();
    if (!verifyPriceId) {
      throw new Error("STRIPE_PRICE_PRO_VERIFY_ONETIME is not configured");
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: verifyPriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      payment_method_types: ["card"],
      phone_number_collection: { enabled: false },
      metadata: {
        userId,
        billingInterval: "monthly",
        checkoutKind: "verify_one_time",
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  const priceId = resolveStripePriceId(billing);
  if (!priceId) {
    throw new Error(
      billing === "annual"
        ? "STRIPE_PRICE_PRO_ANNUAL is not configured"
        : "STRIPE_PRICE_PRO_MONTHLY is not configured",
    );
  }

  let referrerUserId = "";
  const code = String(referralCode || "").trim();
  if (code) {
    const affiliate = await findAffiliateByCode(supabase, code);
    if (affiliate?.user_id && affiliate.user_id !== userId) {
      referrerUserId = affiliate.user_id;
    }
  }

  const billingInterval = billing === "annual" ? "annual" : "monthly";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    payment_method_types: ["card"],
    phone_number_collection: { enabled: false },
    metadata: {
      userId,
      billingInterval,
      referralCode: code.toUpperCase(),
      referrerUserId,
    },
    subscription_data: {
      metadata: {
        userId,
        billingInterval,
        referralCode: code.toUpperCase(),
        referrerUserId,
      },
    },
  });

  return { url: session.url, sessionId: session.id };
}

/** @param {string} userId @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function cancelUserSubscription(userId, supabase) {
  if (!supabase) {
    throw new Error("Authenticated Supabase client is required");
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!profile?.stripe_subscription_id) {
    throw new Error("No active Stripe subscription to cancel");
  }

  const stripe = getStripe();
  await stripe.subscriptions.cancel(profile.stripe_subscription_id);
  await deactivateProSubscription(supabase, userId);
  return { canceled: true, immediate: true };
}

/** @param {string} userId @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function getAffiliateLinkForUser(userId, supabase) {
  if (!supabase) {
    throw new Error("Authenticated Supabase client is required");
  }
  const code = await ensureAffiliateCode(supabase, userId);
  const origin = getAppOrigin();
  return {
    code,
    url: `${origin}/signup?ref=${encodeURIComponent(code)}`,
    testCheckoutAvailable: isStripeVerifyCheckoutAvailable(),
    verifyCheckoutAvailable: isStripeVerifyCheckoutAvailable(),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function getReferralHistoryForUser(supabase, userId) {
  const { data, error } = await supabase
    .from("referrals")
    .select("id, reward_credits, created_at")
    .eq("referrer_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return {
    total: data?.length ?? 0,
    items: data ?? [],
  };
}

/**
 * @param {{ userId: string, emails: string, referrerName?: string, referrerEmail?: string, supabase: import('@supabase/supabase-js').SupabaseClient }} params
 */
export async function sendReferralInvitesForUser(params) {
  const { userId, emails, referrerName, referrerEmail, supabase } = params;
  if (!supabase) {
    throw new Error("Authenticated Supabase client is required");
  }
  const to = parseInviteEmails(emails);
  if (!to.length) {
    throw new Error("Enter at least one valid email address");
  }
  if (referrerEmail && to.some((e) => e === referrerEmail.toLowerCase())) {
    throw new Error("You cannot invite your own email");
  }

  const { url } = await getAffiliateLinkForUser(userId, supabase);
  return sendReferralInviteEmails({
    to,
    referralUrl: url,
    referrerName: referrerName || referrerEmail?.split("@")[0],
  });
}

/** @param {string} subscriptionId */
async function resolveBillingIntervalFromSubscription(subscriptionId) {
  if (!subscriptionId) return "monthly";
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const priceId = sub.items?.data?.[0]?.price?.id;
  const annualId = getStripePriceProAnnual();
  if (priceId && annualId && priceId === annualId) return "annual";
  const monthlyId = getStripePriceProMonthly();
  if (priceId && monthlyId && priceId === monthlyId) return "monthly";
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  return interval === "year" ? "annual" : "monthly";
}

/**
 * @param {import('stripe').Stripe.Event} event
 */
export async function processStripeWebhookEvent(event) {
  const supabase = requireServiceSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = /** @type {import('stripe').Stripe.Checkout.Session} */ (event.data.object);
      const userId = session.metadata?.userId || session.client_reference_id;
      if (!userId) break;

      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

      await activateProSubscription(supabase, userId, {
        customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        subscriptionId,
        billingStatus: "active",
      });

      const billingInterval = session.metadata?.billingInterval
        || await resolveBillingIntervalFromSubscription(subscriptionId);
      const referrerUserId = session.metadata?.referrerUserId || "";
      const isVerifyOneTime = session.metadata?.checkoutKind === "verify_one_time"
        || session.metadata?.checkoutKind === "test_one_time";
      if (referrerUserId && !isVerifyOneTime) {
        await grantReferralRewardIfEligible(supabase, {
          referrerUserId,
          referredUserId: userId,
          subscriptionId,
          billingInterval,
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = /** @type {import('stripe').Stripe.Invoice} */ (event.data.object);
      if (invoice.billing_reason !== "subscription_cycle") break;

      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
      if (!subscriptionId) break;

      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const cap = getTokensCap("pro");
      const now = new Date().toISOString();
      await supabase
        .from("profiles")
        .update({
          plan: "pro",
          tokens_balance: cap,
          tokens_period_start: now,
          billing_status: "active",
          updated_at: now,
        })
        .eq("user_id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = /** @type {import('stripe').Stripe.Subscription} */ (event.data.object);
      const userId = sub.metadata?.userId;
      if (!userId) break;
      await deactivateProSubscription(supabase, userId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = /** @type {import('stripe').Stripe.Subscription} */ (event.data.object);
      const userId = sub.metadata?.userId;
      if (!userId) break;

      if (sub.status === "active" || sub.status === "trialing") {
        await activateProSubscription(supabase, userId, {
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
          billingStatus: sub.status,
        });
      } else if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
        await deactivateProSubscription(supabase, userId);
      }
      break;
    }

    default:
      break;
  }

  return { received: true };
}

/**
 * @param {Buffer | string} rawBody
 * @param {string | string[] | undefined} signature
 */
export async function verifyAndProcessWebhook(rawBody, signature) {
  const stripe = getStripe();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  if (!signature || typeof signature !== "string") {
    throw new Error("Missing Stripe-Signature header");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  return processStripeWebhookEvent(event);
}
