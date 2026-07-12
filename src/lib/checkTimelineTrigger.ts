import type { TimelineReminderData } from "../types/timelineAlert";

export const REMINDER_LEAD_CAP_MS = 30 * 60_000;
export const REMINDER_LEAD_FLOOR_MS = 2 * 60_000;

/** Calendar-day distance from today to target (negative = past). */
export function daysUntilTarget(targetDate: Date, fromDate = new Date()): number {
  const currentMidnight = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  );
  const targetMidnight = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  return Math.ceil((targetMidnight.getTime() - currentMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Adaptive lead before start: cap 30m, floor 2m, else half the gap from previous event.
 */
export function resolveReminderLeadMs(
  startAtMs: number,
  previousStartAtMs?: number | null,
): number {
  if (!Number.isFinite(startAtMs)) return REMINDER_LEAD_CAP_MS;
  if (!Number.isFinite(previousStartAtMs as number) || previousStartAtMs == null) {
    return REMINDER_LEAD_CAP_MS;
  }
  const gap = startAtMs - previousStartAtMs;
  if (!(gap > 0)) return REMINDER_LEAD_CAP_MS;
  return Math.min(
    REMINDER_LEAD_CAP_MS,
    Math.max(REMINDER_LEAD_FLOOR_MS, Math.floor(gap / 2)),
  );
}

/** 24h clock "14:00" local. */
export function formatReminderClock(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Fire only when now is inside (0, lead] before startAt.
 */
export function checkMinuteReminder(params: {
  alertKey: string;
  contentLabel: string;
  workspaceLabel?: string;
  startAt: Date;
  kind: "doc" | "macro";
  leadMs?: number;
  now?: Date;
}): TimelineReminderData | null {
  const now = params.now instanceof Date ? params.now : new Date();
  const startAt = params.startAt;
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return null;
  const leadMs = Number.isFinite(params.leadMs) ? Number(params.leadMs) : REMINDER_LEAD_CAP_MS;
  const remainingMs = startAt.getTime() - now.getTime();
  if (!(remainingMs > 0) || remainingMs > leadMs) return null;
  const minutesRemaining = Math.max(1, Math.ceil(remainingMs / 60_000));
  return {
    alertKey: params.alertKey,
    contentLabel: (params.contentLabel || "Folder").trim() || "Folder",
    workspaceLabel: (params.workspaceLabel || "").trim() || "Timeline",
    minutesRemaining,
    startTimeLabel: formatReminderClock(startAt),
    startAtMs: startAt.getTime(),
    kind: params.kind,
  };
}

/**
 * Legacy day windows (30 / 7 / 1) — still used by the alerts modal list.
 */
export function checkTimelineTrigger(
  targetDate: Date,
  timelineTitle: string,
): import("../types/timelineAlert").TimelineAlertData | null {
  const daysRemaining = daysUntilTarget(targetDate);
  const campaignRef = `Ref: ${timelineTitle}`;

  switch (daysRemaining) {
    case 30:
      return {
        title: "30 days to your event",
        message:
          "Window Open You set an alarm for this event 30 days out. The window is open and the timeline is running. Your event is still distant, but the clock is moving.",
        campaignRef,
      };
    case 7:
      return {
        title: "7 days to your event",
        message:
          "Window Narrowing You set an alarm for this event 7 days out. The notification you scheduled is now active. The window is narrowing and the timeline is approaching",
        campaignRef,
      };
    case 1:
      return {
        title: "Tomorrow is your event",
        message:
          "Final Alert You set an alarm for this moment. 24/hours remain before the event you tracked closes. This is the last notification in this window.",
        campaignRef,
      };
    default:
      return null;
  }
}
