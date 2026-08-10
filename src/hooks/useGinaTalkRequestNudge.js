import { useCallback, useEffect, useRef, useState } from "react";
import { hasDaySheet } from "../lib/gina/ginaDaySheetStore.js";
import {
  isGinaDayRitualOvernight,
} from "../lib/gina/ginaDayRitualDate.js";
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
 * Merge calendar-today docs with yesterday’s when we’re in the overnight window
 * (late blocks like 11:45 PM → 12:00 AM still notify after midnight).
 * @param {object} ctx
 * @param {string} uid
 * @param {Date} now
 * @returns {object[]}
 */
function collectTalkNotifyDocs(ctx, uid, now) {
  const today = get_today_scope({
    ...ctx,
    now,
    userId: uid,
  }, { includeCompleted: true });
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const d of today.documents || []) {
    if (d?.id) byId.set(String(d.id), d);
  }
  if (isGinaDayRitualOvernight(now)) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    y.setHours(12, 0, 0, 0);
    const yesterday = get_today_scope({
      ...ctx,
      now: y,
      userId: uid,
    }, { includeCompleted: true });
    for (const d of yesterday.documents || []) {
      if (d?.id && !byId.has(String(d.id))) byId.set(String(d.id), d);
    }
  }
  return [...byId.values()];
}

/**
 * While day-notifications are enabled and the webapp is open (any tab focus),
 * arm the talk popover when an unchecked doc’s schedule starts (tick edge)
 * or when the user returns within the catch-up window after a start.
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
  /** When the tab became hidden — edge window on return covers the whole hide. */
  const hiddenAtMsRef = useRef(/** @type {number | null} */ (null));

  const refresh = useCallback(() => {
    setPopoverOpen(shouldShowTalkRequestPopover(uid, { now: new Date() }));
  }, [uid]);

  const tick = useCallback((opts = {}) => {
    const now = new Date();
    const nowMs = now.getTime();
    const forceSinceMs = opts.forceSinceMs;

    const sinceMs = forceSinceMs != null && Number.isFinite(forceSinceMs)
      ? Number(forceSinceMs)
      : (lastTickMsRef.current != null ? lastTickMsRef.current : null);
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
      const docs = collectTalkNotifyDocs(ctx, uid, now);
      evaluateTalkRequestDue(uid, docs, now, { sinceMs });
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
      if (typeof document === "undefined") return;
      if (document.hidden) {
        hiddenAtMsRef.current = Date.now();
        return;
      }
      // Returning: treat the whole hidden span as the edge window so a start
      // that fired while away still arms (and sound can play while visible).
      const since = hiddenAtMsRef.current != null
        ? hiddenAtMsRef.current
        : lastTickMsRef.current;
      hiddenAtMsRef.current = null;
      tick({ forceSinceMs: since });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tick]);

  // Hide while chat is open — catch-up still arms; popover waits until chat closes.
  const visible = Boolean(popoverOpen && !chatOpen);

  return { popoverOpen: visible, refreshTalkRequestPopover: refresh };
}
