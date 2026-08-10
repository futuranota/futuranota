/**
 * Day reference sheet — localStorage (1 anchored doc list per calendar day).
 * Status is always rehydrated live from nodes; store only keeps ordered doc ids.
 * Overnight: yesterday’s sheet stays valid until 06:00 local.
 */

import {
  ginaDayKey,
  isAcceptableGinaDayRitualDate,
} from "./ginaDayRitualDate.js";

export const GINA_DAY_SHEET_CHANGED = "fn-gina-day-sheet-changed";
export const GINA_DAY_SHEET_STORAGE_KEY = "fn-gina-day-sheet-v1";

function dayKey(d = new Date()) {
  return ginaDayKey(d);
}

function storageKey(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  return `${GINA_DAY_SHEET_STORAGE_KEY}:${uid}`;
}

function notify() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_DAY_SHEET_CHANGED));
    }
  } catch {
    /* ignore */
  }
}

function getStorage() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @returns {{
 *   date: string,
 *   docIds: string[],
 *   anchoredAt: string,
 *   source?: string,
 * } | null}
 */
export function getDaySheet(userId, now = new Date()) {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!isAcceptableGinaDayRitualDate(parsed.date, now)) return null;
    const docIds = Array.isArray(parsed.docIds)
      ? parsed.docIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    if (!docIds.length) return null;
    return {
      date: parsed.date,
      docIds,
      anchoredAt: parsed.anchoredAt || null,
      source: parsed.source || "schedule_sheet",
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 * @param {{ docIds: string[], now?: Date, source?: string } | null} payload
 */
export function writeDaySheet(userId, payload) {
  const storage = getStorage();
  if (!storage) return null;
  const key = storageKey(userId);
  if (!payload || !Array.isArray(payload.docIds) || !payload.docIds.length) {
    storage.removeItem(key);
    notify();
    return null;
  }
  const now = payload.now instanceof Date ? payload.now : new Date();
  const next = {
    date: dayKey(now),
    docIds: [...new Set(payload.docIds.map((id) => String(id || "").trim()).filter(Boolean))],
    anchoredAt: now.toISOString(),
    source: payload.source || "schedule_sheet",
  };
  if (!next.docIds.length) {
    storage.removeItem(key);
    notify();
    return null;
  }
  storage.setItem(key, JSON.stringify(next));
  notify();
  return next;
}

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function hasDaySheet(userId, now = new Date()) {
  return Boolean(getDaySheet(userId, now));
}

/**
 * Auto-anchor today's doc ids after the dashboard “qué hay para hoy” ritual
 * finishes clean (or post-recovery day-ready). Enables document-chat chip.
 * @param {string} userId
 * @param {object[]} docs
 * @param {{ now?: Date, source?: string }} [opts]
 */
export function anchorDaySheetFromTodayDocs(userId, docs, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const docIds = (Array.isArray(docs) ? docs : [])
    .slice()
    .sort((a, b) => String(a?.anchorAt || "").localeCompare(String(b?.anchorAt || "")))
    .map((d) => String(d?.id || "").trim())
    .filter(Boolean);
  if (!docIds.length) return null;
  return writeDaySheet(userId, {
    docIds,
    now,
    source: opts.source || "dashboard_today_ritual",
  });
}

/**
 * Clear today's sheet (or any stored entry for user).
 * @param {string} userId
 */
export function clearDaySheet(userId) {
  writeDaySheet(userId, null);
}

export { dayKey as daySheetDayKey };
