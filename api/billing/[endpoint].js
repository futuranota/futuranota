import { dispatchEndpoint } from "../_lib/dispatch.js";
import { handleAffiliate, handleCancel, handleCheckout, handleReferralHistory, handleReferralInvite } from "../_handlers/billing-routes.js";

const routes = {
  checkout: handleCheckout,
  cancel: handleCancel,
  affiliate: handleAffiliate,
  "referral-history": handleReferralHistory,
  "referral-invite": handleReferralInvite,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
