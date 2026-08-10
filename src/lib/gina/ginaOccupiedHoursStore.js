/**
 * Gina-gated occupied-hour strikethrough in the document hour picker.
 * Once activated, stays on for the rest of the calendar day (overnight grace like day ritual).
 */

import {
  ginaDayKey,
  isAcceptableGinaDayRitualDate,
} from "./ginaDayRitualDate.js";

export const GINA_OCCUPIED_HOURS_CHANGED = "fn-gina-occupied-hours-changed";
export const GINA_OCCUPIED_HOURS_STORAGE_KEY = "fn-gina-occupied-strikethrough-v1";

function storageKey(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  return `${GINA_OCCUPIED_HOURS_STORAGE_KEY}:${uid}`;
}

function notify() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(GINA_OCCUPIED_HOURS_CHANGED));
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} [userId]
 * @param {Date} [now]
 * @returns {{ date: string, activatedAt: string } | null}
 */
export function getOccupiedStrikethroughState(userId, now = new Date()) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const date = String(parsed.date || "").trim();
    if (!isAcceptableGinaDayRitualDate(date, now)) return null;
    return {
      date,
      activatedAt: parsed.activatedAt ? String(parsed.activatedAt) : null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} [userId]
 * @param {Date} [now]
 */
export function isOccupiedStrikethroughActive(userId, now = new Date()) {
  return Boolean(getOccupiedStrikethroughState(userId, now));
}

/**
 * Unlock occupied-hour strikethrough in pickers for the rest of today.
 * @param {string} [userId]
 * @param {Date} [now]
 */
export function activateOccupiedStrikethroughForToday(userId, now = new Date()) {
  if (typeof localStorage === "undefined") return;
  const n = now instanceof Date ? now : new Date(now);
  const payload = {
    date: ginaDayKey(n),
    activatedAt: n.toISOString(),
  };
  localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  notify();
}

/**
 * Clear activation (tests / ritual reset).
 * @param {string} [userId]
 */
export function clearOccupiedStrikethrough(userId) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(storageKey(userId));
  notify();
}

/**
 * Subscribe for React re-renders when Gina activates strikethrough.
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeOccupiedStrikethrough(listener) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener(GINA_OCCUPIED_HOURS_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GINA_OCCUPIED_HOURS_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
