import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore.js';
import { hasPendingProCheckout, isAutoProCheckoutRedirectPaused } from './pendingCheckout.js';
import { tryRedirectPendingProCheckout } from './redirectPendingProCheckout.js';

/**
 * After auth, redirect Pro signups to Stripe. Never silently fall through to Starter.
 * @param {{ enabled?: boolean }} [opts]
 */
export function usePendingProCheckoutRedirect(opts = {}) {
  const { enabled = true } = opts;
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const attemptedRef = useRef(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!enabled || authLoading || !user) return;
    if (attemptedRef.current) return;
    if (!hasPendingProCheckout(user)) return;
    if (isAutoProCheckoutRedirectPaused()) return;

    attemptedRef.current = true;
    setRedirecting(true);
    setCheckoutError(null);

    void tryRedirectPendingProCheckout(user).then(({ redirected, pending, error }) => {
      if (redirected) return;
      setRedirecting(false);
      if (pending && error) {
        setCheckoutError(error);
        attemptedRef.current = false;
      }
    });
  }, [authLoading, enabled, user]);

  const retryCheckout = async () => {
    setRedirecting(true);
    setCheckoutError(null);
    const { redirected, pending, error } = await tryRedirectPendingProCheckout(user);
    if (redirected) return;
    setRedirecting(false);
    if (pending && error) setCheckoutError(error);
  };

  return { checkoutError, redirecting, retryCheckout };
}
