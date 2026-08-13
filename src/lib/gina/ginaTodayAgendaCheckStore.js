/**
 * Persist whether the user already checked today’s agenda (any today / day-sheet query).
 * Same overnight grace as other Gina day-ritual stores (&lt; 06:00 keeps yesterday).
 */

import {
  ginaDayKey,
  isAcceptableGinaDayRitualDate,
} from "./ginaDayRitualDate.js";

export const GINA_TODAY_AGENDA_CHECK_STORAGE_KEY = "fn-gina-today-agenda-check-v1";
export const GINA_TODAY_AGENDA_CHECK_CHANGED = "fn-gina-today-agenda-check-changed";

function storageKey(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  return `${GINA_TODAY_AGENDA_CHECK_STORAGE_KEY}:${uid}`;
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

function notify() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_TODAY_AGENDA_CHECK_CHANGED));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Families that count as “checked today’s agenda”.
 * @param {string | null | undefined} family
 */
export function isTodayAgendaCheckFamily(family) {
  const f = String(family || "").trim();
  if (!f) return false;
  return f === "today"
    || f === "day_sheet"
    || f === "day_sheet_next"
    || f === "day_sheet_skip_save"
    || f === "day_sheet_complete"
    || f === "day_sheet_complete_confirm";
}

/**
 * @param {string} userId
 * @param {Date} [now]
 * @returns {boolean}
 */
export function hasTodayAgendaChecked(userId, now = new Date()) {
  try {
    const storage = getStorage();
    if (!storage) return false;
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    if (!isAcceptableGinaDayRitualDate(parsed.date, now)) return false;
    return Boolean(parsed.checked);
  } catch {
    return false;
  }
}

/**
 * @param {string} userId
 * @param {Date} [now]
 */
export function markTodayAgendaChecked(userId, now = new Date()) {
  const storage = getStorage();
  if (!storage) return null;
  const n = now instanceof Date ? now : new Date(now);
  const next = {
    date: ginaDayKey(n),
    checked: true,
    checkedAt: n.toISOString(),
  };
  storage.setItem(storageKey(userId), JSON.stringify(next));
  notify();
  return next;
}

/**
 * @param {string} userId
 * @param {string | null | undefined} family
 * @param {Date} [now]
 */
export function markTodayAgendaCheckedFromFamily(userId, family, now = new Date()) {
  if (!isTodayAgendaCheckFamily(family)) return null;
  return markTodayAgendaChecked(userId, now);
}

/**
 * @param {string} userId
 */
export function clearTodayAgendaChecked(userId) {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(storageKey(userId));
  notify();
}
