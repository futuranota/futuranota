/**
 * Copy + protocol for Gina day talk notifications (opt-in → per-doc popover).
 */

import { formatGinaTimeRange } from "./buildGinaVisualization.js";

/** Stable protocol when user taps Accept on the popover. */
export const GINA_TALK_REQUEST_NOTIFY_PROTOCOL = "GinaTalkRequestNotify";

/**
 * Friendly user-bubble text for Accept (also matches the router).
 * @param {string} [locale]
 * @param {string | null} [docId]
 */
export function buildTalkRequestNotifyPrompt(locale = "es", docId = null) {
  const id = String(docId || "").trim();
  const base = locale === "en"
    ? "Next document notification"
    : "Notificación próximo documento";
  return id ? `${base}:${id}` : base;
}

/**
 * @param {string} [locale]
 */
export function buildTalkRequestPopoverCopy(locale = "es") {
  const en = locale === "en";
  return {
    title: en
      ? "Gina is requesting to talk to you ..."
      : "Gina quiere hablar contigo ...",
    accept: en ? "accept" : "accept",
    decline: en ? "Decline" : "Decline",
  };
}

/**
 * Offer after user is happy with today’s schedule.
 * @param {string} [locale]
 */
export function buildTalkNotificationsOfferText(locale = "es") {
  return locale === "en"
    ? "Turn on live alerts? I’ll notify you when each task starts while you keep this tab open."
    : "¿Activamos avisos en vivo? Te notificaré el inicio de cada tarea mientras mantengas esta pestaña abierta.";
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildTalkNotificationsEnableChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "enable_day_notifications",
      label: en ? "enable notifications" : "activar notificaciones",
      text: en
        ? "Enable notifications for today while I work"
        : "Actívame las notificaciones para hoy mientras trabajo",
      primary: true,
    },
    {
      id: "skip_day_notifications",
      label: en ? "I’ll check on my own" : "prefiero chequear por mi cuenta",
      text: en
        ? "I prefer to check on my own"
        : "Prefiero chequear por mi cuenta",
    },
  ];
}

/**
 * @param {string} [locale]
 */
export function buildTalkNotificationsEnabledAck(locale = "es") {
  return locale === "en"
    ? "Done — I’ll notify you when each task starts while this tab stays open."
    : "Listo — te aviso al inicio de cada tarea mientras mantengas esta pestaña abierta.";
}

/**
 * @param {string} [locale]
 */
export function buildTalkNotificationsSkippedAck(locale = "es") {
  return locale === "en"
    ? "Got it — you can check the day schedule whenever you want."
    : "Va — puedes chequear el horario del día cuando quieras.";
}

/**
 * Chat body after Accept.
 * @param {{
 *   locale?: string,
 *   nextTitle?: string | null,
 *   nextTimeLabel?: string | null,
 * }} [opts]
 */
export function buildTalkRequestNotifyText(opts = {}) {
  const en = opts.locale === "en";
  const title = String(opts.nextTitle || "").trim();
  const time = String(opts.nextTimeLabel || "").trim();
  const nextLine = title
    ? (en
      ? `Your next document **${title}**${time ? ` (${time})` : ""} starts soon — this is just a notification.`
      : `Tu próximo documento **${title}**${time ? ` (${time})` : ""} comienza pronto — esto es solo una notificación.`)
    : (en
      ? "Your next document starts soon — this is just a notification."
      : "Tu próximo documento comienza pronto — esto es solo una notificación.");

  if (en) {
    return [
      "Did you finish your current task?",
      nextLine,
      "If you already finished, you can always reopen **Day schedule** to check off and start again.",
    ].join("\n\n");
  }
  return [
    "¿Ya terminaste en tu task actual?",
    nextLine,
    "Si ya terminaste, siempre puedes reabrir el **Horario del día** para tachar y comenzar de nuevo.",
  ].join("\n\n");
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildTalkRequestNotifyChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "talk_request_thanks",
      label: en ? "Ok thanks" : "Ok gracias",
      text: en ? "Ok thanks" : "Ok gracias",
      primary: true,
    },
  ];
}

/**
 * @param {object | null} doc
 * @param {string} [locale]
 */
export function talkRequestTimeLabel(doc, locale = "es") {
  if (!doc) return null;
  const clock = String(doc.timeClock || doc.timeLabel || doc.time || "").trim();
  if (clock) return clock;
  return formatGinaTimeRange(
    doc.anchorAt,
    doc.anchorFinishAt || doc.dueAt,
    locale === "en" ? "en" : "es",
  ) || null;
}

/**
 * @param {string} text
 * @returns {{ match: boolean, docId: string | null }}
 */
export function parseTalkRequestNotifyIntent(text) {
  const q = String(text || "").trim();
  if (!q) return { match: false, docId: null };
  if (q.startsWith(`${GINA_TALK_REQUEST_NOTIFY_PROTOCOL}:`)) {
    return {
      match: true,
      docId: q.slice(GINA_TALK_REQUEST_NOTIFY_PROTOCOL.length + 1).trim() || null,
    };
  }
  if (q === GINA_TALK_REQUEST_NOTIFY_PROTOCOL) {
    return { match: true, docId: null };
  }
  const fold = q.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const m = fold.match(/^(notificacion proximo documento|next document notification)(?::([a-z0-9_-]+))?$/i);
  if (m) {
    return { match: true, docId: m[2] ? String(m[2]).trim() : null };
  }
  return { match: false, docId: null };
}

/**
 * @param {string} text
 */
export function isGinaTalkRequestNotifyIntent(text) {
  return parseTalkRequestNotifyIntent(text).match;
}

/**
 * @param {string} text
 */
export function isEnableTalkNotificationsIntent(text) {
  const fold = String(text || "").trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!fold) return false;
  return /activame las notificaciones para hoy/.test(fold)
    || /activar notificaciones para hoy/.test(fold)
    || /^activar notificaciones$/.test(fold)
    || /enable notifications for today/.test(fold)
    || /^enable notifications$/.test(fold)
    || /notify me today while i work/.test(fold);
}

/**
 * @param {string} text
 */
export function isSkipTalkNotificationsIntent(text) {
  const fold = String(text || "").trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return fold === "prefiero chequear por mi cuenta"
    || fold === "i prefer to check on my own"
    || fold === "no, gracias, sin notificaciones"
    || fold === "no gracias, sin notificaciones"
    || fold === "no thanks, skip notifications";
}

/**
 * Soft ack for “Ok gracias”.
 * @param {string} [locale]
 */
export function buildTalkRequestThanksText(locale = "es") {
  return locale === "en"
    ? "Got it — I’m here whenever you need anything."
    : "Va — aquí estoy cuando me necesites.";
}

/**
 * @param {string} text
 */
export function isTalkRequestThanksIntent(text) {
  const q = String(text || "").trim().toLowerCase();
  return q === "ok gracias"
    || q === "ok thanks"
    || q === "ok, gracias"
    || q === "ok, thanks";
}
