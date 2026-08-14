/**
 * Gina dashboard openings — greeting headline only; body + chips come from opening chips.
 */

import { DOC_WORK_STATUS } from "../docWorkStatus.js";
import { get_today_scope } from "./ginaTools.js";
import { hasTodayAgendaChecked } from "./ginaTodayAgendaCheckStore.js";

/**
 * @param {object} [ctx] gina tools context
 * @returns {boolean}
 */
export function hasCompletedTodayDocs(ctx = {}) {
  try {
    const scope = get_today_scope(ctx, { includeCompleted: true });
    const docs = Array.isArray(scope?.documents) ? scope.documents : [];
    return docs.some((d) => (
      d?.status === DOC_WORK_STATUS.COMPLETED || d?.completed === true
    ));
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   userId?: string | null,
 *   now?: Date,
 *   hasCompletedToday?: boolean,
 *   ctx?: object | null,
 * }} [opts]
 * @returns {"first" | "return" | "progress"}
 */
export function resolveGinaDashboardOpeningMode(opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const uid = String(opts.userId || "anon").trim() || "anon";
  if (!hasTodayAgendaChecked(uid, now)) return "first";
  const completed = typeof opts.hasCompletedToday === "boolean"
    ? opts.hasCompletedToday
    : hasCompletedTodayDocs(opts.ctx || {});
  return completed ? "progress" : "return";
}

/**
 * In-document Call Asistente: lupa wait line, then sync greeting.
 * @param {{ locale?: string, documentTitle?: string | null }} [opts]
 * @returns {{ searchingText: string, greeting: string }}
 */
export function buildGinaDocumentSyncOpening(opts = {}) {
  const en = opts.locale === "en";
  const title = String(opts.documentTitle || "").trim();
  const named = title
    ? (en ? `the document "${title}"` : `el documento "${title}"`)
    : (en ? "this document" : "este documento");
  return {
    searchingText: en ? "one moment please..." : "un momento por favor ...",
    greeting: en
      ? `Hi, I’ve synced this chat with ${named} to help you. What do you need to do today?`
      : `Hola, He sincronizado este chat con ${named} para ayudarte. ¿Qué necesitas hacer hoy?`,
  };
}

/**
 * @param {{
 *   locale?: string,
 *   userName?: string | null,
 *   now?: Date,
 *   salt?: number,
 *   mode?: "first" | "return" | "progress",
 * }} opts
 */
export function pickGinaOpening(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const name = String(opts.userName || "").trim().split(/\s+/)[0] || "";
  const mode = opts.mode === "return" || opts.mode === "progress"
    ? opts.mode
    : "first";
  void opts.now;
  void opts.salt;

  if (mode === "return") {
    if (locale === "en") {
      return name ? `Hello again, ${name}.` : "Hello again.";
    }
    return name ? `Hola de nuevo, ${name}.` : "Hola de nuevo.";
  }

  // first + progress share the classic greeting headline
  if (locale === "en") {
    return name ? `Hi, good day ${name}.` : "Hi, good day.";
  }
  return name ? `Hola, buenas ${name}.` : "Hola, buenas.";
}

/**
 * @param {object | null | undefined} user
 */
export function resolveGinaUserDisplayName(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const raw = meta.full_name || meta.name || meta.display_name || "";
  if (raw && String(raw).trim()) return String(raw).trim();
  const email = user.email || "";
  if (email.includes("@")) return email.split("@")[0];
  return "";
}
