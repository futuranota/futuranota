import { useCallback, useEffect, useRef, useState } from "react";
import {
  GINA_DAILY_REPORT_CHANGED,
  GINA_DAILY_REPORT_DELAY_MS,
  GINA_DAILY_REPORT_POPOVER_ENABLED,
  deferDailyReport,
  getPendingDailyReport,
  markDailyReportOpened,
  markDailyReportReady,
  promoteDailyReportOnSessionEntry,
  queueDailyReportNudge,
  shouldShowDailyReportPopover,
} from "../lib/gina/ginaDailyReportStore.js";
import { buildGinaDailyReport } from "../lib/gina/ginaDailyReport.js";

export const GINA_SCHEDULE_SAVED_EVENT = "fn-gina-schedule-saved";
export const GINA_DOC_STATUS_CHANGED_EVENT = "fn-gina-doc-status-changed";

/**
 * @param {object} detail
 */
export function emitGinaScheduleSaved(detail = {}) {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_SCHEDULE_SAVED_EVENT, { detail }));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Manages conflict (30m) + celebrate (immediate) daily-report popovers.
 * @param {{
 *   userId: string,
 *   locale?: string,
 *   buildCtx: () => object,
 * }} opts
 */
export function useGinaDailyReportNudge({ userId, buildCtx }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverKind, setPopoverKind] = useState(/** @type {"conflict" | "celebrate"} */ ("conflict"));
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const uid = userId || "anon";

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncKindFromStore = useCallback(() => {
    const pending = getPendingDailyReport(uid, new Date());
    if (pending?.kind === "celebrate") setPopoverKind("celebrate");
    else if (pending) setPopoverKind("conflict");
  }, [uid]);

  const refreshPopoverVisibility = useCallback((sessionEntry = false) => {
    if (!GINA_DAILY_REPORT_POPOVER_ENABLED) {
      setPopoverOpen(false);
      return;
    }
    if (sessionEntry) {
      promoteDailyReportOnSessionEntry(uid, new Date());
    }
    const show = shouldShowDailyReportPopover(uid, {
      now: new Date(),
      sessionEntry,
    });
    if (show) {
      markDailyReportReady(uid, new Date());
      syncKindFromStore();
      setPopoverOpen(true);
    }
  }, [uid, syncKindFromStore]);

  const armTimerFromStore = useCallback(() => {
    clearTimer();
    if (!GINA_DAILY_REPORT_POPOVER_ENABLED) {
      setPopoverOpen(false);
      return;
    }
    const pending = getPendingDailyReport(uid, new Date());
    if (!pending || pending.status === "done" || pending.status === "deferred") return;
    syncKindFromStore();
    if (pending.status === "ready") {
      setPopoverOpen(true);
      return;
    }
    const readyAt = pending.readyAt ? Date.parse(pending.readyAt) : NaN;
    if (!Number.isFinite(readyAt)) return;
    const delay = Math.max(0, readyAt - Date.now());
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        markDailyReportReady(uid, new Date());
        return;
      }
      markDailyReportReady(uid, new Date());
      syncKindFromStore();
      setPopoverOpen(true);
    }, delay || (pending.kind === "celebrate" ? 0 : GINA_DAILY_REPORT_DELAY_MS));
  }, [uid, clearTimer, syncKindFromStore]);

  const evaluateReportNudge = useCallback(() => {
    if (!GINA_DAILY_REPORT_POPOVER_ENABLED) return;
    try {
      const ctx = typeof buildCtx === "function" ? buildCtx() : {};
      const report = buildGinaDailyReport(ctx);
      if (report.hasConflicts) {
        queueDailyReportNudge(uid, {
          kind: "conflict",
          conflictCount: report.conflictCount,
          occupiedCount: report.occupiedCount,
          now: new Date(),
        });
        armTimerFromStore();
        return;
      }
      if (report.dayComplete) {
        queueDailyReportNudge(uid, {
          kind: "celebrate",
          conflictCount: 0,
          occupiedCount: report.occupiedCount,
          now: new Date(),
          delayMs: 0,
        });
        armTimerFromStore();
      }
    } catch {
      /* ignore */
    }
  }, [uid, buildCtx, armTimerFromStore]);

  useEffect(() => {
    refreshPopoverVisibility(true);
    armTimerFromStore();

    const onSaved = () => evaluateReportNudge();
    const onStatus = () => evaluateReportNudge();
    const onStore = () => {
      const pending = getPendingDailyReport(uid, new Date());
      if (pending?.status === "ready") {
        syncKindFromStore();
        setPopoverOpen(true);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshPopoverVisibility(true);
        armTimerFromStore();
      } else {
        clearTimer();
      }
    };

    window.addEventListener(GINA_SCHEDULE_SAVED_EVENT, onSaved);
    window.addEventListener(GINA_DOC_STATUS_CHANGED_EVENT, onStatus);
    window.addEventListener(GINA_DAILY_REPORT_CHANGED, onStore);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimer();
      window.removeEventListener(GINA_SCHEDULE_SAVED_EVENT, onSaved);
      window.removeEventListener(GINA_DOC_STATUS_CHANGED_EVENT, onStatus);
      window.removeEventListener(GINA_DAILY_REPORT_CHANGED, onStore);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [uid, evaluateReportNudge, refreshPopoverVisibility, armTimerFromStore, clearTimer, syncKindFromStore]);

  const defer = useCallback(() => {
    deferDailyReport(uid, new Date());
    clearTimer();
    setPopoverOpen(false);
  }, [uid, clearTimer]);

  const openChat = useCallback(() => {
    markDailyReportOpened(uid, new Date());
    clearTimer();
    setPopoverOpen(false);
  }, [uid, clearTimer]);

  return {
    popoverOpen,
    popoverKind,
    setPopoverOpen,
    deferDailyReportNudge: defer,
    acknowledgeOpenChat: openChat,
  };
}
