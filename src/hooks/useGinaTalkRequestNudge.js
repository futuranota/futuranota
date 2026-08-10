import { useCallback, useEffect, useRef, useState } from "react";
import { hasDaySheet } from "../lib/gina/ginaDaySheetStore.js";
import { get_today_scope } from "../lib/gina/ginaTools.js";
import {
  clearArmedTalkRequestSoft,
  evaluateTalkRequestDue,
  expireArmedTalkRequestIfStale,
  GINA_TALK_REQUEST_CHANGED,
  isTalkNotificationsEnabled,
  shouldShowTalkRequestPopover,
} from "../lib/gina/ginaTalkRequestStore.js";

const TICK_MS = 15_000;

/**
 * While day-notifications are enabled and the webapp is open (any tab focus),
 * arm the talk popover only when an unchecked doc’s schedule *starts*
 * (edge across ticks) — not for every already-started block (that flashed on chat close).
 *
 * @param {{
 *   userId: string,
 *   buildCtx: () => object,
 *   chatOpen?: boolean,
 * }} opts
 */
export function useGinaTalkRequestNudge({ userId, buildCtx, chatOpen = false }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const uid = userId || "anon";
  /** Previous tick time — used to detect schedule start edges. */
  const lastTickMsRef = useRef(/** @type {number | null} */ (null));
  const didSoftClearStaleRef = useRef(false);

  const refresh = useCallback(() => {
    setPopoverOpen(shouldShowTalkRequestPopover(uid, { now: new Date() }));
  }, [uid]);

  const tick = useCallback(() => {
    const now = new Date();
    const nowMs = now.getTime();

    // One-shot: drop false-positive arms left by the old “any past start” rule.
    if (!didSoftClearStaleRef.current) {
      didSoftClearStaleRef.current = true;
      try { clearArmedTalkRequestSoft(uid, now); } catch { /* ignore */ }
      lastTickMsRef.current = nowMs;
      refresh();
      return;
    }

    const sinceMs = lastTickMsRef.current != null ? lastTickMsRef.current : nowMs;
    lastTickMsRef.current = nowMs;

    expireArmedTalkRequestIfStale(uid, now);

    if (!isTalkNotificationsEnabled(uid, now)) {
      refresh();
      return;
    }
    if (!hasDaySheet(uid, now)) {
      refresh();
      return;
    }
    try {
      const ctx = typeof buildCtx === "function" ? buildCtx() : {};
      const today = get_today_scope({
        ...ctx,
        now,
        userId: uid,
      }, { includeCompleted: true });
      evaluateTalkRequestDue(uid, today.documents || [], now, { sinceMs });
    } catch {
      /* ignore */
    }
    refresh();
  }, [uid, buildCtx, refresh]);

  useEffect(() => {
    refresh();
    const onStore = () => refresh();
    window.addEventListener(GINA_TALK_REQUEST_CHANGED, onStore);
    return () => window.removeEventListener(GINA_TALK_REQUEST_CHANGED, onStore);
  }, [refresh]);

  useEffect(() => {
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVis = () => {
      tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tick]);

  // Hide while chat is open — does not arm-on-close; edge logic prevents stale arms.
  const visible = Boolean(popoverOpen && !chatOpen);

  return { popoverOpen: visible, refreshTalkRequestPopover: refresh };
}
