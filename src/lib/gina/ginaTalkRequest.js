/**
 * Copy + protocol for Gina day talk notifications (opt-in → per-doc popover).
 */

import { formatGinaTimeRange } from "./buildGinaVisualization.js";

/** Stable protocol when user taps Accept on the popover. */
export const GINA_TALK_REQUEST_NOTIFY_PROTOCOL = "GinaTalkRequestNotify";

/**
 * Friendly user-bubble text for Accept (also matches the router).
 * Prefer stable protocol so Accept never depends only on localized fold matching.
 * @param {string} [locale]
 * @param {string | null} [docId]
 */
export function buildTalkRequestNotifyPrompt(locale = "es", docId = null) {
  void locale;
  const id = String(docId || "").trim();
  return id
    ? `${GINA_TALK_REQUEST_NOTIFY_PROTOCOL}:${id}`
    : GINA_TALK_REQUEST_NOTIFY_PROTOCOL;
}

/**
 * Visible user-bubble label for Accept (protocol stays in autoRunPrompt).
 * @param {string} [locale]
 */
export function buildTalkRequestNotifyDisplayText(locale = "es") {
  return locale === "en"
    ? "Next document notification"
    : "Notificación próximo documento";
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
    ? "Turn on live alerts? I’ll notify you at the start of each task while you keep this tab open."
    : "¿Activamos avisos en vivo? Te notificaré al inicio de cada tarea mientras mantengas esta pestaña abierta.";
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
    ? "Got it. I’ll notify you on screen every time a new work block starts."
    : "Entendido. Te avisaré en pantalla cada vez que inicie un nuevo bloque de trabajo.";
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
 * Chat body after Accept (short intro; fields go in startDocLines).
 * @param {{ locale?: string }} [opts]
 */
export function buildTalkRequestNotifyText(opts = {}) {
  const en = opts.locale === "en";
  if (en) {
    return [
      "Are you almost ready?",
      "It’s time for the document you scheduled — your block starts now.",
    ].join("\n\n");
  }
  return [
    "¿Estás casi listo?",
    "Ya es hora del documento que agendaste — tu bloque comienza ahora.",
  ].join("\n\n");
}

/**
 * Highlight lines: Departamento / Documento / horario (GinaStartDocReveal).
 * @param {object | null} doc
 * @param {string} [locale]
 * @returns {{ label: string, value: string }[]}
 */
export function buildTalkRequestNotifyStartDocLines(doc, locale = "es") {
  const en = locale === "en";
  if (!doc) {
    return en
      ? [
        { label: "Department", value: "—" },
        { label: "Document", value: "—" },
        { label: "Schedule", value: "—" },
      ]
      : [
        { label: "Departamento", value: "—" },
        { label: "Documento", value: "—" },
        { label: "horario", value: "—" },
      ];
  }
  const title = String(doc.title || doc.name || "").trim()
    || (en ? "document" : "documento");
  const department = String(
    doc.department || doc.departmentName || doc.hierarchy?.department || "",
  ).trim() || "—";
  const categoryRaw = String(
    doc.category || doc.hierarchy?.category || "",
  ).trim();
  const category = (!categoryRaw || categoryRaw === "—" || categoryRaw === "-")
    ? ""
    : categoryRaw;
  const departmentValue = category ? `${department} (${category})` : department;
  const schedule = talkRequestTimeLabel(doc, en ? "en" : "es") || "—";
  return en
    ? [
      { label: "Department", value: departmentValue },
      { label: "Document", value: title },
      { label: "Schedule", value: schedule },
    ]
    : [
      { label: "Departamento", value: departmentValue },
      { label: "Documento", value: title },
      { label: "horario", value: schedule },
    ];
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
    // Keep original id casing (generateId → UPPERCASE); fold capture is lowercased.
    let docId = null;
    if (m[2]) {
      const colon = q.lastIndexOf(":");
      docId = colon >= 0 ? q.slice(colon + 1).trim() || null : null;
    }
    return { match: true, docId };
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
