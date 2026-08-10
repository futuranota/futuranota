import { useCallback, useEffect, useState } from "react";
import { hasDaySheet } from "../lib/gina/ginaDaySheetStore.js";
import { get_today_scope } from "../lib/gina/ginaTools.js";
import {
  evaluateTalkRequestDue,
  expireArmedTalkRequestIfStale,
  GINA_TALK_REQUEST_CHANGED,
  isTalkNotificationsEnabled,
  shouldShowTalkRequestPopover,
} from "../lib/gina/ginaTalkRequestStore.js";

const TICK_MS = 15_000;

/**
 * While day-notifications are enabled and the webapp is open (any tab focus),
 * arm the talk popover whenever a pending document’s schedule has started.
 * Auto-dismisses after 10 minutes with no Accept/Decline.
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

  const refresh = useCallback(() => {
    setPopoverOpen(shouldShowTalkRequestPopover(uid, { now: new Date() }));
  }, [uid]);

  const tick = useCallback(() => {
    const now = new Date();
    // Expire first even if notifs off / no day sheet — clears stale armed UI.
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
      // Arm even when this tab is in the background (document.hidden).
      evaluateTalkRequestDue(uid, today.documents || [], now);
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
    // When returning to the tab, catch up immediately (timers may have been throttled).
    const onVis = () => {
      tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tick]);

  // Hide while chat is open (same as daily report / prior talk popover).
  const visible = Boolean(popoverOpen && !chatOpen);

  return { popoverOpen: visible, refreshTalkRequestPopover: refresh };
}
