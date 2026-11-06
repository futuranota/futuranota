import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { startProCheckout } from "./billingApi.js";
import {
  resolvePendingProCheckout,
  skipPendingProCheckout,
  pauseAutoProCheckoutRedirect,
  clearAutoProCheckoutRedirectPause,
} from "./pendingCheckout.js";
import { usePlanStore } from "../stores/planStore.js";
import { useAuthStore } from "../stores/authStore.js";

/**
 * After Stripe cancel during Pro signup funnel: ask before treating user as Starter.
 */
export function useProCheckoutAbandonPrompt() {
  const [searchParams, setSearchParams] = useSearchParams();
  const profilePlan = usePlanStore((s) => s.profile.plan);
  const user = useAuthStore((s) => s.user);
  const handledRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    if (searchParams.get("checkout") !== "canceled") return;

    const pending = resolvePendingProCheckout(user);
    if (!pending || profilePlan === "pro") return;

    handledRef.current = true;
    pauseAutoProCheckoutRedirect();
    setOpen(true);
    setSearchParams({}, { replace: true });
  }, [profilePlan, searchParams, setSearchParams, user]);

  const handleCompletePayment = async () => {
    if (busy) return;
    setBusy(true);
    try {
      clearAutoProCheckoutRedirectPause();
      const { url } = await startProCheckout("monthly", { cancelReturn: "app" });
      if (url) {
        window.location.href = url;
        return;
      }
    } catch (err) {
      console.error("Pro checkout retry failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleContinueStarter = () => {
    skipPendingProCheckout();
    setOpen(false);
  };

  return {
    open,
    busy,
    handleCompletePayment,
    handleContinueStarter,
  };
}
