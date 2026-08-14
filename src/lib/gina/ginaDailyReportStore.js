/**
 * Pending Daily Report nudge — localStorage (1 per calendar day).
 */

export const GINA_DAILY_REPORT_CHANGED = "fn-gina-daily-report-changed";
export const GINA_DAILY_REPORT_STORAGE_KEY = "fn-gina-daily-report-v1";
/** Active-session wait before showing the popover. */
export const GINA_DAILY_REPORT_DELAY_MS = 30 * 60 * 1000;
/** Off until Daily Report visual is redesigned (end of current Gina polish). */
export const GINA_DAILY_REPORT_POPOVER_ENABLED = false;

function dayKey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function storageKey(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  return `${GINA_DAILY_REPORT_STORAGE_KEY}:${uid}`;
}

function notify() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_DAILY_REPORT_CHANGED));
    }
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{
 *   date: string,
 *   status: "queued"|"ready"|"deferred"|"done",
 *   kind: "conflict" | "celebrate",
 *   createdAt: string,
 *   readyAt: string | null,
 *   conflictCount: number,
 *   occupiedCount: number,
 *   shownAt: string | null,
 * } | null}
 */
export function getPendingDailyReport(userId, now = new Date()) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const today = dayKey(now);
    if (parsed.date !== today) return null;
    if (!parsed.kind) parsed.kind = parsed.conflictCount > 0 ? "conflict" : "celebrate";
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 * @param {object | null} report
 */
export function writePendingDailyReport(userId, report) {
  if (typeof localStorage === "undefined") return;
  const key = storageKey(userId);
  if (!report) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(report));
  }
  notify();
}

/**
 * Queue or refresh a nudge when conflicts exist, or celebrate when day is complete.
 * @param {string} userId
 * @param {{
 *   conflictCount?: number,
 *   occupiedCount?: number,
 *   now?: Date,
 *   delayMs?: number,
 *   kind?: "conflict" | "celebrate",
 * }} opts
 */
export function queueDailyReportNudge(userId, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const kind = opts.kind === "celebrate" ? "celebrate" : "conflict";
  const conflictCount = Number(opts.conflictCount) || 0;
  if (kind === "conflict" && conflictCount <= 0) {
    return getPendingDailyReport(userId, now);
  }

  const existing = getPendingDailyReport(userId, now);
  if (existing?.status === "done") return existing;
  // Celebrate does not override an active conflict nudge.
  if (kind === "celebrate" && existing && existing.kind === "conflict"
    && (existing.status === "queued" || existing.status === "ready" || existing.status === "deferred")) {
    return existing;
  }

  const delayMs = typeof opts.delayMs === "number"
    ? opts.delayMs
    : (kind === "celebrate" ? 0 : GINA_DAILY_REPORT_DELAY_MS);
  const readyAt = new Date(now.getTime() + delayMs).toISOString();
  const next = {
    date: dayKey(now),
    kind,
    status: existing?.status === "deferred" && kind === "conflict" ? "deferred" : "queued",
    createdAt: existing?.createdAt || now.toISOString(),
    readyAt,
    conflictCount: kind === "conflict" ? conflictCount : 0,
    occupiedCount: Number(opts.occupiedCount) || existing?.occupiedCount || 0,
    shownAt: existing?.shownAt || null,
  };
  // Refreshing while still queued/ready resets the clock (conflict 30m / celebrate immediate).
  if (existing?.status === "queued" || existing?.status === "ready" || !existing
    || (kind === "celebrate" && existing?.kind !== "conflict")) {
    next.status = "queued";
    next.readyAt = readyAt;
    next.kind = kind;
  }
  writePendingDailyReport(userId, next);
  return next;
}

/**
 * Mark ready to show (timer elapsed or next-session entry).
 * @param {string} userId
 * @param {Date} [now]
 */
export function markDailyReportReady(userId, now = new Date()) {
  const cur = getPendingDailyReport(userId, now);
  if (!cur || cur.status === "done" || cur.status === "deferred") return cur;
  if (cur.status === "ready") return cur;
  const next = { ...cur, status: "ready" };
  writePendingDailyReport(userId, next);
  return next;
}

/**
 * User chose "verificar de luego".
 */
export function deferDailyReport(userId, now = new Date()) {
  const cur = getPendingDailyReport(userId, now) || {
    date: dayKey(now),
    createdAt: now.toISOString(),
    readyAt: null,
    conflictCount: 0,
    occupiedCount: 0,
    shownAt: null,
  };
  const next = {
    ...cur,
    date: dayKey(now),
    status: "deferred",
    kind: cur.kind || "conflict",
    shownAt: now.toISOString(),
  };
  writePendingDailyReport(userId, next);
  return next;
}

/**
 * User opened the report from popover or chat.
 */
export function markDailyReportOpened(userId, now = new Date()) {
  const cur = getPendingDailyReport(userId, now);
  if (!cur) return null;
  const next = {
    ...cur,
    status: "done",
    shownAt: now.toISOString(),
  };
  writePendingDailyReport(userId, next);
  return next;
}

/**
 * True when popover should appear now (timer done while active, or next session with past readyAt).
 * @param {string} userId
 * @param {{ now?: Date, sessionEntry?: boolean }} [opts]
 */
export function shouldShowDailyReportPopover(userId, opts = {}) {
  if (!GINA_DAILY_REPORT_POPOVER_ENABLED) return false;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const cur = getPendingDailyReport(userId, now);
  if (!cur) return false;
  if (cur.status === "done") return false;
  if (cur.status === "deferred") return false;
  if (cur.status === "ready") return true;
  if (cur.status === "queued") {
    const readyAt = cur.readyAt ? Date.parse(cur.readyAt) : NaN;
    if (!Number.isFinite(readyAt)) return false;
    if (now.getTime() >= readyAt) return true;
    // Next session entry with a queued report that already matured while away
    if (opts.sessionEntry && now.getTime() >= readyAt) return true;
  }
  return false;
}

/**
 * On app/dashboard boot: if queued and readyAt passed, promote to ready.
 */
export function promoteDailyReportOnSessionEntry(userId, now = new Date()) {
  const cur = getPendingDailyReport(userId, now);
  if (!cur || cur.status !== "queued") return cur;
  const readyAt = cur.readyAt ? Date.parse(cur.readyAt) : NaN;
  if (!Number.isFinite(readyAt) || now.getTime() < readyAt) return cur;
  return markDailyReportReady(userId, now);
}

export function clearDailyReport(userId) {
  writePendingDailyReport(userId, null);
}
