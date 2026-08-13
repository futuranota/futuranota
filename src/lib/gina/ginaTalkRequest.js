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
      ? "Your next task is ready on the agenda."
      : "Tu siguiente tarea ya está lista en la agenda.",
    titleEmph: en ? "Your" : "Tu",
    titleMuted: en
      ? "next task is ready on the agenda."
      : "siguiente tarea ya está lista en la agenda.",
    accept: en ? "verify" : "verificar",
    decline: en ? "skip" : "omitir",
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
      "Ready to start?",
      "It’s time for your next scheduled block.",
    ].join("\n\n");
  }
  return [
    "¿Estás listo para comenzar?",
    "Es hora de tu siguiente bloque agendado.",
  ].join("\n\n");
}

/**
 * Duration between start and finish — e.g. "2 horas" / "30 minutos".
 * @param {object | null} doc
 * @param {string} [locale]
 */
export function formatTalkRequestAssignedTime(doc, locale = "es") {
  const start = doc?.anchorAt ? new Date(doc.anchorAt) : null;
  const finishRaw = doc?.anchorFinishAt || doc?.dueAt || null;
  const finish = finishRaw ? new Date(finishRaw) : null;
  if (!start || !finish || Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) {
    return "—";
  }
  const minutes = Math.round((finish.getTime() - start.getTime()) / 60000);
  if (minutes <= 0) return "—";
  const en = locale === "en";
  const h = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (h <= 0) {
    return en
      ? `${rem} minute${rem === 1 ? "" : "s"}`
      : `${rem} minuto${rem === 1 ? "" : "s"}`;
  }
  if (rem <= 0) {
    return en
      ? `${h} hour${h === 1 ? "" : "s"}`
      : `${h} hora${h === 1 ? "" : "s"}`;
  }
  return en
    ? `${h} hour${h === 1 ? "" : "s"} ${rem} minute${rem === 1 ? "" : "s"}`
    : `${h} hora${h === 1 ? "" : "s"} ${rem} minuto${rem === 1 ? "" : "s"}`;
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
        { label: "Assigned time", value: "—" },
      ]
      : [
        { label: "Departamento", value: "—" },
        { label: "Documento", value: "—" },
        { label: "horario", value: "—" },
        { label: "tiempo asignado", value: "—" },
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
  const assigned = formatTalkRequestAssignedTime(doc, en ? "en" : "es");
  return en
    ? [
      { label: "Department", value: departmentValue },
      { label: "Document", value: title },
      { label: "Schedule", value: schedule },
      { label: "Assigned time", value: assigned },
    ]
    : [
      { label: "Departamento", value: departmentValue },
      { label: "Documento", value: title },
      { label: "horario", value: schedule },
      { label: "tiempo asignado", value: assigned },
    ];
}

/** Fixed mock to-dos for the notify turn (not live corpus). */
export const GINA_TALK_REQUEST_TODO_MOCK_ES = {
  done: 0,
  total: 3,
  title: "Pendientes en este documento (0/3):",
  items: [
    "Redactar introducción y gancho principal",
    "Añadir enlaces de referencia y afiliados",
    "Revisar formato y subtítulos H2",
  ],
};

export const GINA_TALK_REQUEST_TODO_MOCK_EN = {
  done: 0,
  total: 3,
  title: "Pending in this document (0/3):",
  items: [
    "Draft the introduction and main hook",
    "Add reference and affiliate links",
    "Review formatting and H2 subheads",
  ],
};

/**
 * @param {string} [locale]
 */
export function getTalkRequestTodoMock(locale = "es") {
  return locale === "en" ? GINA_TALK_REQUEST_TODO_MOCK_EN : GINA_TALK_REQUEST_TODO_MOCK_ES;
}

/**
 * @param {string[]} names
 * @param {string} [locale]
 */
export function joinTalkRequestNames(names, locale = "es") {
  const list = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  const conj = locale === "en" ? " and " : " y ";
  if (list.length === 2) return `${list[0]}${conj}${list[1]}`;
  return `${list.slice(0, -1).join(", ")}${conj}${list[list.length - 1]}`;
}

function isClosedNotifyStatus(doc) {
  const status = String(doc?.status || "").trim();
  return status === "completed"
    || status === "submitted"
    || doc?.completed === true;
}

/**
 * Today's docs that start before the notified block and are still open.
 * @param {object[]} docs
 * @param {object | null} current
 * @returns {object[]}
 */
export function listUnfinishedPriorBlocks(docs, current) {
  const list = Array.isArray(docs) ? docs : [];
  const currentId = current?.id != null ? String(current.id) : "";
  const currentStart = current?.anchorAt ? Date.parse(current.anchorAt) : NaN;
  if (!Number.isFinite(currentStart)) return [];
  return list
    .filter((d) => {
      if (!d) return false;
      if (currentId && String(d.id) === currentId) return false;
      if (isClosedNotifyStatus(d)) return false;
      const start = d.anchorAt ? Date.parse(d.anchorAt) : NaN;
      return Number.isFinite(start) && start < currentStart;
    })
    .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")));
}

/**
 * @param {{
 *   locale?: string,
 *   currentTitle?: string,
 *   priorTitles?: string[],
 * }} [opts]
 */
export function buildTalkRequestConditionText(opts = {}) {
  const en = opts.locale === "en";
  const current = String(opts.currentTitle || "").trim()
    || (en ? "this document" : "este documento");
  const priors = (Array.isArray(opts.priorTitles) ? opts.priorTitles : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (!priors.length) {
    return en
      ? "You're all caught up!\nReady to put your full attention on this document?"
      : "¡Todo al día!\n¿Estás listo para enfocar toda tu atención en este documento?";
  }
  const joined = joinTalkRequestNames(priors.map((t) => `[ ${t} ]`), en ? "en" : "es");
  if (en) {
    return [
      "How's the previous block going?",
      `We noticed that ${joined} still isn't marked as completed.`,
      `Want to close it so you can start [ ${current} ]?`,
    ].join("\n");
  }
  return [
    "¿Cómo vas con el bloque anterior?",
    `Notamos que ${joined} aún no está marcado como completado.`,
    `¿Deseas darlo por concluido para arrancar con [ ${current} ]?`,
  ].join("\n");
}

/**
 * @param {string} text
 * @returns {{ match: boolean, docIds: string[] }}
 */
export function parseDaySheetRescheduleIntent(text) {
  const q = String(text || "").trim();
  if (!q.startsWith("GinaDaySheetReschedule:")) {
    return { match: false, docIds: [] };
  }
  const raw = q.slice("GinaDaySheetReschedule:".length);
  const docIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return { match: true, docIds };
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
