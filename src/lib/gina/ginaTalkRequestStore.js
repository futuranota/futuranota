/**
 * Gina day talk notifications — opt-in for today, then popover per document start.
 *
 * While enabled + webapp open (any tab focus): when a pending doc’s schedule starts,
 * show talk popover. Auto-dismiss after 10 minutes with no action.
 */

export const GINA_TALK_REQUEST_CHANGED = "fn-gina-talk-request-changed";
export const GINA_TALK_REQUEST_STORAGE_KEY = "fn-gina-talk-request-v2";
/** Auto-hide armed popover if user takes no Accept/Decline action. */
export const GINA_TALK_REQUEST_AUTO_DISMISS_MS = 10 * 60 * 1000;

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
  return `${GINA_TALK_REQUEST_STORAGE_KEY}:${uid}`;
}

function notify() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_TALK_REQUEST_CHANGED));
    }
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{
 *   date: string,
 *   enabled: boolean,
 *   decided: boolean,
 *   notifiedDocIds: string[],
 *   activeDocId: string | null,
 *   activeTitle: string | null,
 *   armedAt: string | null,
 *   createdAt: string,
 * } | null}
 */
export function getTalkRequestState(userId, now = new Date()) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.date !== dayKey(now)) return null;
    const enabled = Boolean(parsed.enabled);
    return {
      date: parsed.date,
      enabled,
      decided: Boolean(parsed.decided) || enabled,
      notifiedDocIds: Array.isArray(parsed.notifiedDocIds)
        ? parsed.notifiedDocIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [],
      activeDocId: parsed.activeDocId ? String(parsed.activeDocId) : null,
      activeTitle: parsed.activeTitle ? String(parsed.activeTitle) : null,
      armedAt: parsed.armedAt ? String(parsed.armedAt) : null,
      createdAt: parsed.createdAt || null,
    };
  } catch {
    return null;
  }
}

/** @deprecated use getTalkRequestState */
export function getTalkRequest(userId, now = new Date()) {
  return getTalkRequestState(userId, now);
}

/**
 * @param {string} userId
 * @param {object | null} payload
 */
export function writeTalkRequestState(userId, payload) {
  if (typeof localStorage === "undefined") return;
  const key = storageKey(userId);
  if (!payload) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(payload));
  }
  notify();
}

/** @deprecated */
export function writeTalkRequest(userId, payload) {
  writeTalkRequestState(userId, payload);
}

/**
 * User opted in after being happy with today’s schedule.
 * @param {string} userId
 * @param {Date} [now]
 */
export function enableTalkNotifications(userId, now = new Date()) {
  const existing = getTalkRequestState(userId, now);
  const next = {
    date: dayKey(now),
    enabled: true,
    decided: true,
    notifiedDocIds: existing?.notifiedDocIds || [],
    activeDocId: existing?.activeDocId || null,
    activeTitle: existing?.activeTitle || null,
    armedAt: existing?.armedAt || null,
    createdAt: existing?.createdAt || now.toISOString(),
  };
  writeTalkRequestState(userId, next);
  return next;
}

/**
 * User declined live notifications for today (still unlocks Comenzar / Re-agendar).
 * @param {string} userId
 * @param {Date} [now]
 */
export function skipTalkNotifications(userId, now = new Date()) {
  const existing = getTalkRequestState(userId, now);
  const next = {
    date: dayKey(now),
    enabled: false,
    decided: true,
    notifiedDocIds: existing?.notifiedDocIds || [],
    activeDocId: null,
    activeTitle: null,
    armedAt: null,
    createdAt: existing?.createdAt || now.toISOString(),
  };
  writeTalkRequestState(userId, next);
  return next;
}

/**
 * @param {string} userId
 * @param {Date} [now]
 */
export function isTalkNotificationsEnabled(userId, now = new Date()) {
  return Boolean(getTalkRequestState(userId, now)?.enabled);
}

/**
 * Whether the user already answered the live-notifications offer today.
 * @param {string} userId
 * @param {Date} [now]
 */
export function hasTalkNotificationsDecision(userId, now = new Date()) {
  return Boolean(getTalkRequestState(userId, now)?.decided);
}

/**
 * @param {object} doc
 */
function isCompletedDoc(doc) {
  return Boolean(doc?.completed || doc?.status === "completed");
}

/**
 * Clear an armed popover as if the user declined (doc won’t re-show today).
 * @param {string} userId
 * @param {Date} [now]
 * @param {{ reason?: string }} [opts]
 */
export function dismissActiveTalkRequest(userId, now = new Date(), opts = {}) {
  void opts;
  const cur = getTalkRequestState(userId, now);
  if (!cur?.enabled || !cur.activeDocId) return cur;
  const notified = new Set(cur.notifiedDocIds || []);
  notified.add(String(cur.activeDocId));
  const next = {
    ...cur,
    notifiedDocIds: [...notified],
    activeDocId: null,
    activeTitle: null,
    armedAt: null,
  };
  writeTalkRequestState(userId, next);
  return next;
}

/**
 * If the armed popover is older than AUTO_DISMISS, clear it (same as Decline).
 * @param {string} userId
 * @param {Date} [now]
 * @param {number} [ttlMs]
 * @returns {object | null} state after possible expiry
 */
export function expireArmedTalkRequestIfStale(
  userId,
  now = new Date(),
  ttlMs = GINA_TALK_REQUEST_AUTO_DISMISS_MS,
) {
  const cur = getTalkRequestState(userId, now);
  if (!cur?.enabled || !cur.activeDocId || !cur.armedAt) return cur;
  const armedMs = new Date(cur.armedAt).getTime();
  if (!Number.isFinite(armedMs)) return cur;
  if (now.getTime() - armedMs < ttlMs) return cur;
  return dismissActiveTalkRequest(userId, now, { reason: "auto_dismiss" });
}

/**
 * Find the next due document and arm the popover (if notifications enabled).
 * Also expires a stale armed popover first.
 * @param {string} userId
 * @param {object[]} docs today-scoped docs
 * @param {Date} [now]
 */
export function evaluateTalkRequestDue(userId, docs, now = new Date()) {
  let state = expireArmedTalkRequestIfStale(userId, now);
  if (!state?.enabled) return state;
  if (state.activeDocId) return state;

  const notified = new Set(state.notifiedDocIds || []);
  const nowMs = now.getTime();
  const due = (Array.isArray(docs) ? docs : [])
    .filter((d) => d && d.id && !isCompletedDoc(d) && d.anchorAt)
    .filter((d) => !notified.has(String(d.id)))
    .map((d) => ({
      doc: d,
      startMs: new Date(d.anchorAt).getTime(),
    }))
    .filter((row) => Number.isFinite(row.startMs) && row.startMs <= nowMs)
    .sort((a, b) => a.startMs - b.startMs)[0];

  if (!due) return state;

  const next = {
    ...state,
    activeDocId: String(due.doc.id),
    activeTitle: String(due.doc.title || due.doc.name || "").trim() || null,
    armedAt: now.toISOString(),
  };
  writeTalkRequestState(userId, next);
  return next;
}

/**
 * Popover visible when a doc is armed (and not past auto-dismiss).
 * @param {string} userId
 * @param {{ now?: Date }} [opts]
 */
export function shouldShowTalkRequestPopover(userId, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const cur = expireArmedTalkRequestIfStale(userId, now);
  return Boolean(cur?.enabled && cur.activeDocId);
}

/**
 * @param {string} userId
 * @param {Date} [now]
 * @returns {{ state: object | null, docId: string | null }}
 */
export function acceptTalkRequest(userId, now = new Date()) {
  const cur = getTalkRequestState(userId, now);
  if (!cur?.enabled || !cur.activeDocId) {
    return { state: cur, docId: null };
  }
  const docId = cur.activeDocId;
  const notified = new Set(cur.notifiedDocIds || []);
  notified.add(docId);
  const next = {
    ...cur,
    notifiedDocIds: [...notified],
    activeDocId: null,
    activeTitle: null,
    armedAt: null,
  };
  writeTalkRequestState(userId, next);
  return { state: next, docId };
}

/**
 * Decline this document’s popover (won’t re-show for that doc today).
 * @param {string} userId
 * @param {Date} [now]
 */
export function declineTalkRequest(userId, now = new Date()) {
  return dismissActiveTalkRequest(userId, now, { reason: "decline" });
}

/**
 * @param {string} userId
 */
export function clearTalkRequest(userId) {
  writeTalkRequestState(userId, null);
}

/** @deprecated removed — notifications are opt-in, not auto-queued on day check */
export function queueTalkRequestFromDayCheck(userId, now = new Date()) {
  return getTalkRequestState(userId, now);
}

export { dayKey as talkRequestDayKey };
