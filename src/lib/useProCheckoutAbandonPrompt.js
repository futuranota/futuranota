import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { startProCheckout } from "./billingApi.js";
import { clearPendingProCheckout, readPendingProCheckout } from "./pendingCheckout.js";
import { usePlanStore } from "../stores/planStore.js";

/**
 * After Stripe cancel during Pro signup funnel: ask before treating user as Starter.
 */
export function useProCheckoutAbandonPrompt() {
  const [searchParams, setSearchParams] = useSearchParams();
  const profilePlan = usePlanStore((s) => s.profile.plan);
  const handledRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [billing, setBilling] = useState("monthly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    if (searchParams.get("checkout") !== "canceled") return;

    const pending = readPendingProCheckout();
    if (!pending || profilePlan === "pro") return;

    handledRef.current = true;
    setBilling(pending.billing);
    setOpen(true);
    setSearchParams({}, { replace: true });
  }, [profilePlan, searchParams, setSearchParams]);

  const handleCompletePayment = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await startProCheckout(billing, { cancelReturn: "app" });
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
    clearPendingProCheckout();
    setOpen(false);
  };

  return {
    open,
    busy,
    billing,
    handleCompletePayment,
    handleContinueStarter,
  };
}

/** @returns {boolean} */
export function shouldSkipStripeCanceledCleanup() {
  return Boolean(readPendingProCheckout());
}
