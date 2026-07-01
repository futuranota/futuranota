import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { usePlanStore } from "../stores/planStore.js";
import { confirmCheckoutSession } from "./billingApi.js";
import { clearStoredReferralCode } from "./referralStorage.js";

/**
 * After Stripe Checkout redirect: sync Pro plan (fallback if webhook is delayed) and clean URL.
 */
export function useStripeCheckoutReturn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fetchProfile = usePlanStore((s) => s.fetchProfile);
  const handledRef = useRef(false);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success" && checkout !== "canceled") return;
    if (handledRef.current) return;
    handledRef.current = true;

    const sessionId = searchParams.get("session_id")?.trim() || "";

    const run = async () => {
      if (checkout === "success") {
        if (sessionId) {
          try {
            await confirmCheckoutSession(sessionId);
          } catch (err) {
            console.warn("confirmCheckoutSession:", err);
          }
        }
        await fetchProfile();
        clearStoredReferralCode();
      }
      setSearchParams({}, { replace: true });
    };

    void run();
  }, [fetchProfile, searchParams, setSearchParams]);
}
