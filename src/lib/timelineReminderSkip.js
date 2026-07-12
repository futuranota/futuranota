const SKIPPED_KEY = "fn-timeline-reminder-skipped";

/** @param {string} alertKey @param {number} [startAtMs] */
export function reminderOccurrenceKey(alertKey, startAtMs) {
  if (!alertKey) return "";
  if (Number.isFinite(startAtMs)) return `${alertKey}|${startAtMs}`;
  return String(alertKey);
}

/** @returns {string[]} */
export function readSkippedTimelineReminderKeys() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SKIPPED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Persist skip for this schedule occurrence (re-schedules with a new time can remind again).
 * @param {string} alertKey
 * @param {number} [startAtMs]
 */
export function skipTimelineReminderKey(alertKey, startAtMs) {
  if (!alertKey || typeof window === "undefined") return;
  try {
    const next = new Set(readSkippedTimelineReminderKeys());
    next.add(reminderOccurrenceKey(alertKey, startAtMs));
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...next]));
  } catch {
    /* private mode */
  }
}

/** Clear all skipped reminder keys (e.g. when turning alerts back on). */
export function clearSkippedTimelineReminderKeys() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SKIPPED_KEY);
  } catch {
    /* private mode */
  }
}
