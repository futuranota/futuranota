/**
 * Test harness: reset today’s Gina day-ritual local state so QA can re-run from scratch.
 */

import { clearDaySheet } from "./ginaDaySheetStore.js";
import { clearDaySheetOfferCount } from "./ginaDaySheetOfferStore.js";
import { clearTalkRequest } from "./ginaTalkRequestStore.js";
import { clearRecoveryNotifySnooze } from "./ginaRecoverySnooze.js";
import { clearDailyReport } from "./ginaDailyReportStore.js";
import { clearOccupiedStrikethrough } from "./ginaOccupiedHoursStore.js";

export const GINA_RESET_DAY_RITUAL_PROTOCOL = "GinaResetDayRitual";

/**
 * Clear day sheet + notifications + offer count + recovery snooze (+ daily report).
 * Does not mutate document schedules or corpus.
 * @param {string} userId
 * @returns {{ cleared: string[] }}
 */
export function resetGinaDayRitualState(userId) {
  const uid = String(userId || "anon").trim() || "anon";
  const cleared = [];
  try {
    clearDaySheet(uid);
    cleared.push("day_sheet");
  } catch { /* ignore */ }
  try {
    clearTalkRequest(uid);
    cleared.push("talk_notifications");
  } catch { /* ignore */ }
  try {
    clearDaySheetOfferCount(uid);
    cleared.push("day_sheet_offer");
  } catch { /* ignore */ }
  try {
    clearRecoveryNotifySnooze(uid);
    cleared.push("recovery_snooze");
  } catch { /* ignore */ }
  try {
    clearDailyReport(uid);
    cleared.push("daily_report");
  } catch { /* ignore */ }
  try {
    clearOccupiedStrikethrough(uid);
    cleared.push("occupied_strikethrough");
  } catch { /* ignore */ }
  return { cleared };
}

/**
 * @param {string} [locale]
 */
export function buildGinaDayRitualResetAck(locale = "es") {
  return locale === "en"
    ? "Reset — today’s day schedule / notifications / recovery snooze are cleared. Ask “what do we have for today?” to start again."
    : "Reset — limpié el horario del día, notificaciones y snooze de hoy. Di “qué tenemos para hoy” para empezar de nuevo.";
}

/**
 * @param {string} text
 */
export function isGinaResetDayRitualIntent(text) {
  const q = String(text || "").trim();
  if (!q) return false;
  if (q === GINA_RESET_DAY_RITUAL_PROTOCOL) return true;
  const fold = q.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return fold === "reset ritual de hoy"
    || fold === "reset horario de hoy"
    || fold === "reset day ritual"
    || fold === "gina reset day ritual"
    || /reset(ear)?\s+(el\s+)?(ritual|horario)\s+(de\s+)?hoy/.test(fold);
}
