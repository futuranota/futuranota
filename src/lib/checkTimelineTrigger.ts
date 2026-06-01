import type { TimelineAlertData } from "../types/timelineAlert";

/**
 * Evaluates timeline proximity and triggers informative alerts at critical windows.
 * Can track general marketing instructions, blueprints, or workflows.
 *
 * @param targetDate - The deadline or target date of the tracked timeline.
 * @param timelineTitle - The custom name of the inserted timeline, blueprint, or instruction set.
 * @returns A TimelineAlertData object if within a critical window (30, 7, 1), otherwise null.
 */
export function checkTimelineTrigger(
  targetDate: Date,
  timelineTitle: string,
): TimelineAlertData | null {
  const currentDate = new Date();

  const currentMidnight = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  const targetMidnight = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  const timeDifference = targetMidnight.getTime() - currentMidnight.getTime();
  const daysRemaining = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

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
