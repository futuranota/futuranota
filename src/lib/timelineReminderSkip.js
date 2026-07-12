const SKIPPED_KEY = "fn-timeline-reminder-skipped";

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

/** @param {string} alertKey */
export function skipTimelineReminderKey(alertKey) {
  if (!alertKey || typeof window === "undefined") return;
  try {
    const next = new Set(readSkippedTimelineReminderKeys());
    next.add(String(alertKey));
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...next]));
  } catch {
    /* private mode */
  }
}
