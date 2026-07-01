import { dispatchEndpoint } from "../_lib/dispatch.js";
import {
  handleAffiliate,
  handleCancel,
  handleCheckout,
  handleConfirmCheckout,
  handleReferralHistory,
  handleReferralInvite,
  handleVerifyCheckoutStatus,
} from "../_handlers/billing-routes.js";

const routes = {
  checkout: handleCheckout,
  "confirm-checkout": handleConfirmCheckout,
  cancel: handleCancel,
  affiliate: handleAffiliate,
  "referral-history": handleReferralHistory,
  "referral-invite": handleReferralInvite,
  "verify-checkout": handleVerifyCheckoutStatus,
  "test-checkout": handleVerifyCheckoutStatus,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
