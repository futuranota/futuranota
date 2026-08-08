/**
 * Snooze "Gina quiere informarte algo" notify for N minutes (local).
 */

const STORAGE_KEY = "gina-recovery-snooze-v1";
const DEFAULT_MS = 45 * 60 * 1000;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function dayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} userId
 * @param {Date} [now]
 * @param {number} [durationMs]
 */
export function setRecoveryNotifySnooze(userId, now = new Date(), durationMs = DEFAULT_MS) {
  const uid = String(userId || "anon");
  const until = (now instanceof Date ? now : new Date()).getTime() + Math.max(60_000, durationMs);
  const map = readAll();
  map[uid] = { until, day: dayKey(now) };
  writeAll(map);
  return until;
}

/**
 * @param {string} userId
 * @param {Date} [now]
 */
export function isRecoveryNotifySnoozed(userId, now = new Date()) {
  const uid = String(userId || "anon");
  const map = readAll();
  const row = map[uid];
  if (!row || typeof row.until !== "number") return false;
  const clock = now instanceof Date ? now : new Date();
  if (row.day && row.day !== dayKey(clock)) return false;
  return row.until > clock.getTime();
}

/**
 * Clear snooze (e.g. after user opens notify anyway).
 * @param {string} userId
 */
export function clearRecoveryNotifySnooze(userId) {
  const uid = String(userId || "anon");
  const map = readAll();
  delete map[uid];
  writeAll(map);
}
