/**
 * Schedule recovery signals + copy for Gina (passed slots → mark past due / cascade).
 */

import { DOC_WORK_STATUS } from "../docWorkStatus.js";

/**
 * True when the document's timed block has already ended (or start passed with no finish).
 * @param {object} doc
 * @param {Date} now
 */
export function isPassedSlot(doc, now = new Date()) {
  if (!doc) return false;
  const status = doc.status;
  if (status === DOC_WORK_STATUS.COMPLETED || doc.completed) return false;

  const finishRaw = doc.anchorFinishAt || doc.dueAt || null;
  const startRaw = doc.anchorAt || doc.startedAt || null;
  const finish = finishRaw ? new Date(finishRaw) : null;
  const start = startRaw ? new Date(startRaw) : null;

  if (finish && !Number.isNaN(finish.getTime())) {
    return finish.getTime() < now.getTime();
  }
  if (start && !Number.isNaN(start.getTime())) {
    return start.getTime() < now.getTime();
  }
  return false;
}

/**
 * Docs eligible to be offered "marcar vencidos".
 * @param {object} doc
 * @param {Date} now
 */
export function isMarkablePassedSlot(doc, now = new Date()) {
  if (!isPassedSlot(doc, now)) return false;
  const status = doc.status;
  if (status === DOC_WORK_STATUS.PAST_DUE || doc.isPastDue) return false;
  if (status === DOC_WORK_STATUS.SUBMITTED) return false;
  return true;
}

/**
 * @param {object[]} docs
 * @param {Date} [now]
 */
export function buildPassedSlotSignals(docs, now = new Date()) {
  const list = Array.isArray(docs) ? docs : [];
  const passedSlots = list
    .filter((d) => isPassedSlot(d, now))
    .slice()
    .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")));
  const markableSlots = passedSlots.filter((d) => isMarkablePassedSlot(d, now));
  const firstPending = list
    .slice()
    .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
    .find((d) => {
      if (d.status === DOC_WORK_STATUS.COMPLETED || d.completed) return false;
      return true;
    }) || null;

  return { passedSlots, markableSlots, firstPending };
}

/**
 * @param {object[]} docs
 */
export function mapPassedSlotRows(docs) {
  return (Array.isArray(docs) ? docs : []).map((d) => ({
    id: d.id || null,
    title: d.title || "Untitled",
    status: d.status || null,
    department: d.departmentName || d.department || null,
    category: d.category || null,
    folder: d.parentFolderName || d.folder || null,
    anchorAt: d.anchorAt || null,
    anchorFinishAt: d.anchorFinishAt || null,
  }));
}

function roundUpToQuarterHour(date) {
  const d = new Date(date.getTime());
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const add = (15 - (m % 15)) % 15;
  if (add === 0 && d.getTime() <= date.getTime()) {
    d.setMinutes(m + 15);
  } else {
    d.setMinutes(m + add);
  }
  return d;
}

function durationMs(doc) {
  const start = doc.anchorAt ? new Date(doc.anchorAt) : null;
  const finish = doc.anchorFinishAt ? new Date(doc.anchorFinishAt) : null;
  if (start && finish && !Number.isNaN(start.getTime()) && !Number.isNaN(finish.getTime())) {
    return Math.max(15 * 60 * 1000, finish.getTime() - start.getTime());
  }
  return 60 * 60 * 1000;
}

/**
 * Cascade preview: keep order + durations + rest gaps; start from now.
 * @param {object[]} docs today-scoped docs
 * @param {Date} [now]
 */
export function buildCascadeSchedulePreview(docs, now = new Date()) {
  const sorted = (Array.isArray(docs) ? docs : [])
    .filter((d) => !(d.status === DOC_WORK_STATUS.COMPLETED || d.completed))
    .slice()
    .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")));

  /** @type {number[]} */
  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const aEnd = sorted[i].anchorFinishAt ? new Date(sorted[i].anchorFinishAt) : null;
    const bStart = sorted[i + 1].anchorAt ? new Date(sorted[i + 1].anchorAt) : null;
    if (aEnd && bStart && !Number.isNaN(aEnd.getTime()) && !Number.isNaN(bStart.getTime())) {
      gaps.push(Math.max(0, bStart.getTime() - aEnd.getTime()));
    } else {
      gaps.push(5 * 60 * 1000);
    }
  }

  let cursor = roundUpToQuarterHour(now);
  return sorted.map((d, i) => {
    const dur = durationMs(d);
    const newStart = new Date(cursor.getTime());
    const newFinish = new Date(cursor.getTime() + dur);
    cursor = new Date(newFinish.getTime() + (gaps[i] ?? 0));
    return {
      id: d.id || null,
      title: d.title || "Untitled",
      status: d.status || null,
      department: d.departmentName || d.department || null,
      folder: d.parentFolderName || d.folder || null,
      category: d.category || null,
      anchorAt: d.anchorAt || null,
      anchorFinishAt: d.anchorFinishAt || null,
      proposedAnchorAt: newStart.toISOString(),
      proposedAnchorFinishAt: newFinish.toISOString(),
    };
  });
}

/**
 * Recovery offer under the today schedule table (legacy — prefer brief text).
 * @param {{ firstTitle?: string | null, locale?: string }} opts
 */
export function buildScheduleRecoveryOfferText(opts = {}) {
  return buildScheduleRecoveryBriefText(opts);
}

/**
 * Gate chips after a clean schedule sheet (notify + omit).
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleRecoveryGateChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "recovery_notify",
      label: en ? "Assistance has something to tell you" : "Assistance requiere informarte algo",
      text: en
        ? "Assistance has something to tell you"
        : "Assistance requiere informarte algo",
      primary: true,
    },
    {
      id: "skip_recovery",
      label: en ? "Skip" : "Omitir",
      text: en ? "Skip schedule recovery" : "Omitir recuperación de horario",
    },
  ];
}

/**
 * Step-2 brief after the user opens the notify chip (first person).
 * @param {{ firstTitle?: string | null, locale?: string }} opts
 */
export function buildScheduleRecoveryBriefText(opts = {}) {
  const en = opts.locale === "en";
  const first = opts.firstTitle
    ? `“${opts.firstTitle}”`
    : (en ? "the first document" : "el primer documento");

  if (en) {
    return (
      `I reviewed the content table and the current schedule — I want to flag that these documents are already a bit behind.\n`
      + `Want to adjust them?\n`
      + `**Nota:** If you mark them past due, I clear the current list and you can review them in the folders later to catch up. `
      + `**Por ejemplo:** if you prefer a cascade, I keep this same order starting from ${first} and shift the rest for today.\n`
      + `Want me to help you change them?\n`
      + `(Pick an option below to apply)`
    );
  }
  return (
    `Revisé la tabla de contenido y el horario actual — quiero señalarte que estos documentos ya van un poco atrasados.\n`
    + `¿Quieres ajustarlos?\n`
    + `**Nota:** Si los marcas como vencidos, limpio la lista actual y las revisas en los folders más adelante para ponerte al día. `
    + `**Por ejemplo:** si prefieres regenerar una cadena, mantengo este mismo orden iniciando desde ${first} y desplazo el resto para hoy.\n`
    + `¿Quieres que te ayude a modificarlos?\n`
    + `(Selecciona una opción abajo para aplicar)`
  );
}

/**
 * Action chips after the recovery brief (mark / cascade / omit).
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleRecoveryChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "mark_past_due",
      label: en ? "Mark as past due" : "Marcar como vencidos",
      text: en
        ? "Mark today's passed slots as past due"
        : "Marcar como vencidos los horarios pasados de hoy",
      primary: true,
    },
    {
      id: "postpone_schedule",
      label: en ? "Cascade reschedule" : "Reagendar en cadena",
      text: en
        ? "Postpone today's passed schedule keeping order"
        : "Posponer horario de hoy manteniendo el orden",
    },
    {
      id: "skip_recovery",
      label: en ? "Skip" : "Omitir",
      text: en ? "Skip schedule recovery" : "Omitir recuperación de horario",
    },
  ];
}

/**
 * Preview copy after choosing a recovery path (before confirm).
 * @param {"mark_past_due" | "postpone_schedule"} intent
 * @param {{ count?: number, locale?: string }} [opts]
 */
export function buildScheduleRecoveryAck(intent, opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count ?? 0;
  if (intent === "mark_past_due") {
    return en
      ? `I found ${n} document(s) whose time block already ended. `
        + `I’ll move them to Past due for your review — confirm the preview before I update.`
      : `Encontré ${n} documento(s) cuyo horario ya concluyó. `
        + `Los paso a Vencido para tu revisión — confirma la vista previa antes de que actualice.`;
  }
  return en
    ? `I’ll reorganize your agenda from this moment. I’ll keep the original task order, `
      + `plus their durations and break times. Review the preview below before I apply the changes.`
    : `Voy a reorganizar tu agenda a partir de este momento. Conservo el orden original de las tareas, `
      + `así como sus duraciones y tiempos de descanso. Revisa la vista previa a continuación antes de que aplique los cambios.`;
}

/**
 * @param {"mark_past_due" | "postpone_schedule"} intent
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleRecoveryConfirmChips(intent, opts = {}) {
  const en = opts.locale === "en";
  const isMark = intent === "mark_past_due";
  return [
    {
      id: "confirm_recovery",
      label: en ? "Confirm" : "Confirmar",
      text: isMark
        ? (en ? "Confirm mark passed slots as past due" : "Confirmar marcar vencidos")
        : (en ? "Confirm cascade reschedule" : "Confirmar reagendar en cadena"),
      primary: true,
    },
    {
      id: "skip_recovery",
      label: en ? "Skip" : "Omitir",
      text: en ? "Skip schedule recovery" : "Omitir recuperación de horario",
    },
  ];
}

/**
 * After confirm applied.
 * @param {"mark_past_due" | "postpone_schedule"} intent
 * @param {{ count?: number, locale?: string }} [opts]
 */
export function buildScheduleRecoveryAppliedText(intent, opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count ?? 0;
  if (intent === "mark_past_due") {
    return en
      ? `Done — I marked ${n} document(s) Past due for your review.`
      : `Listo — marqué ${n} documento(s) como Vencido para tu revisión.`;
  }
  return en
    ? `Done — I shifted ${n} document(s) in cascade for the rest of today.`
    : `Listo — reorganicé ${n} documento(s) en cadena para el resto de hoy.`;
}

export function buildGinaWarmGoodbyeReply(locale = "es") {
  return locale === "en"
    ? "Thank you — I’m here whenever you need anything."
    : "Gracias a ti, cualquier cosa que necesites aquí estoy.";
}

export function isGinaWarmGoodbye(text) {
  const q = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!q) return false;
  if (/\bgracias\b/.test(q) && /\b(resto\s+del\s+dia|buen\s+(resto|dia)|que\s+tengas)\b/.test(q)) {
    return true;
  }
  if (/\bthanks\b/.test(q) && /\b(rest\s+of\s+(the\s+)?day|good\s+day)\b/.test(q)) {
    return true;
  }
  return false;
}
