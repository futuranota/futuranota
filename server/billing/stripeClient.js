import Stripe from "stripe";
import { getStripeSecretKey } from "./stripeConfig.js";

/** @type {Stripe | null} */
let client = null;

/** @returns {Stripe} */
export function getStripe() {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}
