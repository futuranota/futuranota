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
 * @param {{ urgencyCount?: number, lateStartCount?: number, hasOverlap?: boolean, forceStep?: string | null }} opts
 * @returns {"overdue_check" | "conflict_resolve" | "summary"}
 */
export function resolveRecoveryCurrentStep(opts = {}) {
  const force = String(opts.forceStep || "").trim();
  if (force === "overdue_check" || force === "conflict_resolve" || force === "summary") {
    return force;
  }
  const urgencyCount = Number(opts.urgencyCount) || 0;
  const lateStartCount = Number(opts.lateStartCount) || 0;
  const hasOverlap = Boolean(opts.hasOverlap);
  if (urgencyCount > 0 || lateStartCount > 0) return "overdue_check";
  if (hasOverlap) return "conflict_resolve";
  return "summary";
}

/**
 * @param {{ urgencyCount?: number, hasOverlap?: boolean }} opts
 * @returns {"overdue_check" | "conflict_resolve" | "summary"}
 */
export function resolveRecoveryNextStep(opts = {}) {
  const urgencyCount = Number(opts.urgencyCount) || 0;
  const hasOverlap = Boolean(opts.hasOverlap);
  // After overdue is handled, go to conflict if any; else summary.
  if (hasOverlap) return "conflict_resolve";
  void urgencyCount;
  return "summary";
}

/**
 * Intro bubble when the notify chip is opened (before step viz).
 * @param {{
 *   locale?: string,
 *   urgencyCount?: number,
 *   hasOverlap?: boolean,
 * }} opts
 */
export function buildScheduleRecoveryIntroText(opts = {}) {
  const en = opts.locale === "en";
  const urgencyCount = Number(opts.urgencyCount) || 0;
  const lateStartCount = Number(opts.lateStartCount) || 0;
  const timeIssues = urgencyCount > 0 || lateStartCount > 0;
  const hasOverlap = Boolean(opts.hasOverlap);
  const problems = (timeIssues ? 1 : 0) + (hasOverlap ? 1 : 0);

  if (problems === 0) {
    return en
      ? "I reviewed today’s agenda — nothing urgent to fix before you start."
      : "Revisé tu agenda de hoy — no hay nada urgente que ajustar antes de arrancar.";
  }

  const lines = [];
  if (en) {
    lines.push(problems === 1
      ? "Reviewing today’s agenda I noticed one detail that needs your attention before you start."
      : "Reviewing today’s agenda I noticed two details that need your attention before you start.");
  } else {
    lines.push(problems === 1
      ? "Revisando tu agenda de hoy noté un detalle que requiere tu atención antes de arrancar."
      : "Revisando tu agenda de hoy noté dos detalles que requieren tu atención antes de arrancar.");
  }

  if (timeIssues) {
    lines.push("");
    if (urgencyCount > 0 && lateStartCount > 0) {
      lines.push(en
        ? "First, some windows already ended — and a few blocks started on the clock while still Not started."
        : "Primero, hay ventanas que ya terminaron — y otros bloques ya entraron en su rango con status Sin empezar.");
    } else if (urgencyCount > 0) {
      lines.push(en
        ? "First, I’ve lightly marked in red a few documents whose time windows already ended."
        : "Primero, te he marcado en rojo claro un par de documentos cuyos horarios ya finalizaron.");
    } else {
      lines.push(en
        ? "First, some blocks are already in their time window but still show as Not started."
        : "Primero, hay bloques que ya entraron en su horario y siguen como Sin empezar.");
    }
  }

  if (hasOverlap) {
    lines.push("");
    const prefix = timeIssues
      ? (en ? "Second," : "Segundo,")
      : (en ? "Also," : "Además,");
    lines.push(en
      ? `${prefix} we have a schedule clash concentrated in the afternoon block.`
      : `${prefix} tenemos un choque de horarios concentrado en el bloque de la tarde.`);
  }

  lines.push("");
  lines.push(problems === 1
    ? (en ? "Let’s resolve it." : "Vamos a resolverlo.")
    : (en ? "Let’s resolve them one by one." : "Vamos a resolverlos uno por uno."));

  return lines.join("\n");
}

/**
 * Paso 1 copy — fully expired + late-start active + Easy Link blurbs.
 * @param {{
 *   locale?: string,
 *   overdueTimes?: string[],
 *   urgencyCount?: number,
 *   lateStartLabels?: { label: string, time: string }[],
 *   lateStartCount?: number,
 *   explainEasyLinks?: boolean,
 * }} opts
 */
export function buildScheduleRecoveryOverdueStepText(opts = {}) {
  const en = opts.locale === "en";
  const times = Array.isArray(opts.overdueTimes)
    ? opts.overdueTimes.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  const n = Number(opts.urgencyCount) || times.length || 0;
  const late = Array.isArray(opts.lateStartLabels) ? opts.lateStartLabels : [];
  const lateN = Number(opts.lateStartCount) || late.length || 0;
  const timeList = times.length
    ? (en
      ? times.join(times.length === 2 ? " and " : ", ")
      : times.length === 2
        ? `${times[0]} y ${times[1]}`
        : times.join(", "))
    : "";

  const lines = [];

  if (n > 0) {
    if (en) {
      lines.push(n === 1
        ? `This block${timeList ? ` (${timeList})` : ""} already ended.`
        : `These ${n} blocks${timeList ? ` (${timeList})` : ""} already ended.`);
    } else {
      lines.push(n === 1
        ? `Este bloque${timeList ? ` (${timeList})` : ""} ya pasó de hora.`
        : `Estos ${n} bloques${timeList ? ` (${timeList})` : ""} ya pasaron de hora.`);
    }
  }

  if (lateN > 0) {
    if (lines.length) lines.push("");
    const bits = late.slice(0, 4).map((row) => {
      const name = row.label || row.title || (en ? "a document" : "un documento");
      return row.time ? `${name} ${en ? "at" : "a las"} ${row.time}` : name;
    });
    const joined = en
      ? bits.join(bits.length === 2 ? " and " : ", ")
      : bits.length === 2
        ? `${bits[0]} y ${bits[1]}`
        : bits.join(", ");
    if (en) {
      lines.push(
        `I also noticed you had scheduled to start ${joined}. `
        + `They still show as Not started. If you’re already working on one, tell me which to mark In progress. `
        + `If you haven’t started, you’re more than an hour late on this block.`,
      );
    } else {
      lines.push(
        `Noté que tenías programado iniciar ${joined}. `
        + `Ambos figuran como «Sin empezar». Si ya estás trabajando en alguno, dime cuál para pasarlo a En Progreso. `
        + `Si no has comenzado, registras un retraso de más de una hora en este bloque.`,
      );
    }
  }

  if (!lines.length) {
    return en
      ? "How do you want to handle today’s schedule notes?"
      : "¿Cómo prefieres gestionar los puntos de la agenda de hoy?";
  }

  lines.push("");
  lines.push(en ? "How do you want to proceed?" : "¿Cómo deseas proceder?");

  if (opts.explainEasyLinks !== false) {
    lines.push("");
    if (en) {
      lines.push("**Mark as Completed** — close finished/late blocks; pending work time updates.");
      lines.push("**Archive as Past due** — keep a record, drop them from today’s active view.");
      lines.push("**Move to end of day** — pick a free slot (struck hours are busy/expired).");
      lines.push("**Continue / Later** — leave the plan as-is; I’ll remind you in ~45 minutes.");
    } else {
      lines.push("**Marcar como Completados** — cierra bloques pasados/retrasados; actualiza el trabajo pendiente de hoy.");
      lines.push("**Archivar como Vencidos** — guarda el registro y los retira de la vista activa de hoy.");
      lines.push("**Mover al final del día** — eliges un cupo libre (horas tachadas = ocupadas/vencidas).");
      lines.push("**Seguir / Más tarde** — mantengo el plan; te recuerdo en ~45 minutos.");
    }
  }

  return lines.join("\n");
}

/**
 * Paso 2 copy — conflict.
 * @param {{
 *   locale?: string,
 *   topConflict?: {
 *     displayLabel?: string,
 *     department?: string,
 *     timeLabel?: string,
 *     overlapCount?: number,
 *   } | null,
 *   conflictRangeLabel?: string | null,
 *   invadedLabels?: string[],
 * }} opts
 */
export function buildScheduleRecoveryConflictStepText(opts = {}) {
  const en = opts.locale === "en";
  const conflict = opts.topConflict || null;
  const range = String(
    opts.conflictRangeLabel
    || conflict?.timeLabel
    || conflict?.displayLabel
    || "",
  ).trim();
  const dept = String(conflict?.department || "").trim() || (en ? "Sales" : "Sales");
  const invaded = Array.isArray(opts.invadedLabels)
    ? opts.invadedLabels.filter(Boolean)
    : [];
  const invadedJoin = invaded.length
    ? (en
      ? invaded.join(invaded.length === 2 ? " and " : ", ")
      : invaded.length === 2
        ? `${invaded[0]} y ${invaded[1]}`
        : invaded.join(", "))
    : (en ? "other scheduled work" : "otro trabajo programado");

  if (en) {
    return [
      `Now we have this clash${range ? ` from ${range}` : ""}. Your continuous **${dept}** block overlaps time assigned to ${invadedJoin}.`,
      "",
      "How would you like to clear this block?",
    ].join("\n");
  }
  return [
    `Ahora tenemos este choque${range ? ` de ${range}` : ""}. Tu bloque continuo de **${dept}** invade el tiempo asignado a ${invadedJoin}.`,
    "",
    "¿Cómo te gustaría despejar este bloque?",
  ].join("\n");
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleRecoverySummaryText(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "All set for now — today’s schedule notes are cleared. Want to see the day sheet again?"
    : "Listo por ahora — dejamos atendidos los puntos de la agenda de hoy. ¿Quieres ver el sheet del día otra vez?";
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
      label: en ? "Gina wants to tell you something" : "Gina quiere informarte algo",
      text: en
        ? "Gina wants to tell you something"
        : "Gina quiere informarte algo",
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
 * Recovery offer under the today schedule table (legacy — prefer intro).
 * @param {{ firstTitle?: string | null, locale?: string, urgencyCount?: number, hasOverlap?: boolean }} opts
 */
export function buildScheduleRecoveryOfferText(opts = {}) {
  return buildScheduleRecoveryIntroText(opts);
}

/**
 * Legacy alias — intro + problem framing (tests / older callers).
 */
export function buildScheduleRecoveryBriefText(opts = {}) {
  return buildScheduleRecoveryIntroText(opts);
}

/**
 * Paso 1 chips — Easy Links (live where wired).
 * @param {{ locale?: string, lateStartCount?: number }} [opts]
 */
export function buildScheduleRecoveryOverdueChips(opts = {}) {
  const en = opts.locale === "en";
  const lateN = Number(opts.lateStartCount) || 0;
  /** @type {{ id: string, label: string, text: string, primary?: boolean, comingSoon?: boolean }[]} */
  const chips = [];

  if (lateN > 0) {
    chips.push({
      id: "mark_in_progress_batch",
      label: en ? "Mark late starts In progress" : "Pasar retrasos a En Progreso",
      text: en
        ? "Mark late-start blocks as in progress"
        : "Marcar bloques con inicio tardío como en progreso",
    });
  }

  chips.push(
    {
      id: "mark_completed",
      label: en ? "Mark as Completed" : "Marcar como Completados",
      text: en
        ? "Mark today's expired blocks as completed"
        : "Marcar como completados los bloques vencidos de hoy",
    },
    {
      id: "mark_past_due",
      label: en ? "Archive as Past due" : "Archivar como Vencidos",
      text: en
        ? "Mark today's passed slots as past due"
        : "Marcar como vencidos los horarios pasados de hoy",
      primary: true,
    },
    {
      id: "move_end_of_day",
      label: en ? "Move to end of day" : "Mover al final del día",
      text: en
        ? "Reschedule expired blocks show free slots"
        : "Reagendar bloques vencidos mostrar cupos libres",
    },
    {
      id: "recovery_snooze",
      label: en ? "Continue / Later" : "Seguir / Más tarde",
      text: en
        ? "Snooze schedule recovery reminder"
        : "Posponer recordatorio de recuperación de horario",
    },
  );
  return chips;
}

/**
 * Paso 2 chips.
 * @param {{ locale?: string, topConflict?: { department?: string | null } | null, invadedLabels?: string[] }} [opts]
 */
export function buildScheduleRecoveryConflictChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = String(opts.topConflict?.department || "").trim();
  const invaded = Array.isArray(opts.invadedLabels) ? opts.invadedLabels.filter(Boolean) : [];
  const prioritizeLabel = invaded.length
    ? (en ? `Prioritize ${invaded.join(" & ")}` : `Priorizar ${invaded.join(" y ")}`)
    : (en ? "Prioritize other blocks" : "Priorizar otros bloques");
  return [
    {
      id: "move_conflict_tomorrow",
      label: en
        ? (dept ? `Move ${dept} to tomorrow` : "Move block to tomorrow")
        : (dept ? `Mover ${dept} a mañana` : "Mover bloque a mañana"),
      text: en
        ? "Move overlapping block to tomorrow (coming soon)"
        : "Mover bloque en traslape a mañana (próximamente)",
      comingSoon: true,
      primary: true,
    },
    {
      id: "adjust_conflict_hours",
      label: en
        ? (dept ? `Adjust ${dept} hours` : "Adjust hours")
        : (dept ? `Ajustar horas de ${dept}` : "Ajustar horas"),
      text: en
        ? "Adjust overlapping block hours (coming soon)"
        : "Ajustar horas del bloque en traslape (próximamente)",
      comingSoon: true,
    },
    {
      id: "prioritize_other_blocks",
      label: prioritizeLabel,
      text: en
        ? "Prioritize other blocks (coming soon)"
        : "Priorizar otros bloques (próximamente)",
      comingSoon: true,
    },
    {
      id: "recovery_next",
      label: en ? "Continue / Later" : "Seguir / Más tarde",
      text: en
        ? "Continue to next schedule recovery step"
        : "Seguir al siguiente paso de recuperación",
    },
  ];
}

/**
 * Action chips for the active recovery step.
 * @param {{
 *   locale?: string,
 *   currentStep?: string,
 *   urgencyCount?: number,
 *   hasOverlap?: boolean,
 *   topConflict?: { department?: string | null } | null,
 *   invadedLabels?: string[],
 * }} [opts]
 */
export function buildScheduleRecoveryChips(opts = {}) {
  const en = opts.locale === "en";
  const step = resolveRecoveryCurrentStep({
    urgencyCount: opts.urgencyCount,
    lateStartCount: opts.lateStartCount,
    hasOverlap: opts.hasOverlap || opts.topConflict,
    forceStep: opts.currentStep,
  });

  if (step === "overdue_check") {
    return buildScheduleRecoveryOverdueChips({
      locale: opts.locale,
      lateStartCount: opts.lateStartCount,
    });
  }
  if (step === "conflict_resolve") {
    return buildScheduleRecoveryConflictChips({
      locale: opts.locale,
      topConflict: opts.topConflict,
      invadedLabels: opts.invadedLabels,
    });
  }
  return [
    {
      id: "today_schedule",
      label: en ? "Today's schedule" : "Horarios de hoy",
      text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
      primary: true,
    },
    {
      id: "skip_recovery",
      label: en ? "Done" : "Listo",
      text: en ? "Skip schedule recovery" : "Omitir recuperación de horario",
    },
  ];
}

/**
 * Step body text for funnel / textAfter.
 * @param {{
 *   locale?: string,
 *   currentStep?: string,
 *   urgencyCount?: number,
 *   hasOverlap?: boolean,
 *   overdueTimes?: string[],
 *   topConflict?: object | null,
 *   conflictRangeLabel?: string | null,
 *   invadedLabels?: string[],
 * }} opts
 */
export function buildScheduleRecoveryStepText(opts = {}) {
  const step = resolveRecoveryCurrentStep({
    urgencyCount: opts.urgencyCount,
    lateStartCount: opts.lateStartCount,
    hasOverlap: opts.hasOverlap || opts.topConflict,
    forceStep: opts.currentStep,
  });
  if (step === "overdue_check") {
    return buildScheduleRecoveryOverdueStepText(opts);
  }
  if (step === "conflict_resolve") {
    return buildScheduleRecoveryConflictStepText(opts);
  }
  return buildScheduleRecoverySummaryText(opts);
}

/**
 * Preview copy after choosing a recovery path (before confirm).
 * @param {"mark_past_due" | "postpone_schedule" | "mark_completed" | "mark_in_progress"} intent
 * @param {{ count?: number, locale?: string }} [opts]
 */
export function buildScheduleRecoveryAck(intent, opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count ?? 0;
  if (intent === "mark_completed") {
    return en
      ? `I’ll mark ${n} block(s) as Completed. Confirm before I update.`
      : `Voy a marcar ${n} bloque(s) como Completados. Confirma antes de que actualice.`;
  }
  if (intent === "mark_in_progress") {
    return en
      ? `I’ll mark ${n} late-start block(s) as In progress. Confirm?`
      : `Paso ${n} bloque(s) con inicio tardío a En Progreso. ¿Confirmas?`;
  }
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
 * @param {"mark_past_due" | "postpone_schedule" | "mark_completed" | "mark_in_progress"} intent
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleRecoveryConfirmChips(intent, opts = {}) {
  const en = opts.locale === "en";
  const confirmText = (() => {
    if (intent === "mark_completed") {
      return en ? "Confirm mark as completed" : "Confirmar marcar como completados";
    }
    if (intent === "mark_in_progress") {
      return en ? "Confirm mark as in progress" : "Confirmar marcar en progreso";
    }
    if (intent === "mark_past_due") {
      return en ? "Confirm mark passed slots as past due" : "Confirmar marcar vencidos";
    }
    return en ? "Confirm cascade reschedule" : "Confirmar reagendar en cadena";
  })();
  return [
    {
      id: "confirm_recovery",
      label: en ? "Confirm" : "Confirmar",
      text: confirmText,
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
 * @param {"mark_past_due" | "postpone_schedule" | "mark_completed" | "mark_in_progress"} intent
 * @param {{ count?: number, locale?: string, startLabel?: string | null }} [opts]
 */
export function buildScheduleRecoveryAppliedText(intent, opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count ?? 0;
  if (intent === "mark_completed") {
    return en
      ? `Got it. I marked those blocks as completed. Your pending work time for today updated automatically.`
      : `Entendido. Marqué esos bloques como completados. Tu tiempo pendiente de trabajo para hoy se actualizó automáticamente.`;
  }
  if (intent === "mark_in_progress") {
    return en
      ? `Done — ${n} block(s) are now In progress.`
      : `Listo — ${n} bloque(s) quedaron En Progreso.`;
  }
  if (intent === "mark_past_due") {
    return en
      ? `I archived the past-due blocks. They won’t clutter today’s view, but they’ll stay in your history to tune future estimates.`
      : `Archivé los bloques vencidos. No afectarán tu vista de hoy, pero quedarán guardados en tu historial para ajustar tus estimaciones futuras.`;
  }
  return en
    ? `Done — I shifted ${n} document(s) in cascade for the rest of today.`
    : `Listo — reorganicé ${n} documento(s) en cadena para el resto de hoy.`;
}

/**
 * Copy when opening the free-slot picker.
 * @param {{ locale?: string, hasFreeSlot?: boolean }} [opts]
 */
export function buildReschedulePickerText(opts = {}) {
  const en = opts.locale === "en";
  if (opts.hasFreeSlot === false) {
    return en
      ? "Today looks full — struck hours are occupied or already past. Pick tomorrow, compress (soon), or force-insert at the end of the night."
      : "Hoy parece lleno — las horas tachadas están ocupadas o ya pasaron. Elige mañana, comprimir (próx.) o insertar al final de la noche de todos modos.";
  }
  return en
    ? "I’ll find you a slot. Here are today’s blocks and free gaps. Struck hours are busy or expired — pick a free window today or another date."
    : "Voy a buscarte un espacio. Aquí tienes los bloques de hoy y los cupos disponibles. Las horas tachadas ya están ocupadas o vencidas; puedes seleccionar un hueco libre de hoy o elegir otra fecha.";
}

/**
 * Ack after applying a chosen slot.
 * @param {{ locale?: string, timeLabel?: string, dayLabel?: string }} [opts]
 */
export function buildRescheduleAppliedText(opts = {}) {
  const en = opts.locale === "en";
  const time = String(opts.timeLabel || "").trim();
  const day = String(opts.dayLabel || "").trim();
  if (en) {
    if (day && time) return `Done. I rescheduled the document for ${day} ${time}. Your agenda is updated without overlaps.`;
    if (time) return `Done. I rescheduled the document for today ${time}. Your agenda is updated without overlaps.`;
    return "Done. I rescheduled the document. Your agenda is updated without overlaps.";
  }
  if (day && time) return `Listo. Reagendé el documento para ${day} ${time}. Tu agenda quedó actualizada sin solapamientos.`;
  if (time) return `Listo. Reagendé el documento para hoy ${time}. Tu agenda quedó actualizada sin solapamientos.`;
  return "Listo. Reagendé el documento. Tu agenda quedó actualizada sin solapamientos.";
}

/**
 * Snooze ack + advance.
 * @param {{ locale?: string }} [opts]
 */
export function buildRecoverySnoozeText(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "Okay — I’ll keep the current plan. I’ll remind you about these blocks in the next review (~45 minutes)."
    : "De acuerdo, mantengo el plan actual. Te recordaré el estado de tus bloques en la siguiente revisión (~45 minutos).";
}

/**
 * After recovery applied and day is ready to start.
 * @param {{ firstPendingTitle?: string | null, locale?: string }} [opts]
 */
export function buildDayStartAfterRecoveryText(opts = {}) {
  const en = opts.locale === "en";
  const title = String(opts.firstPendingTitle || "").trim();
  if (!title) {
    return en
      ? "Your schedule is updated. Want me to open the first document?"
      : "Actualicé tu horario. ¿Quieres que te abra el primer documento?";
  }
  return en
    ? `Your day starts with **${title}**. Want me to open the document?`
    : `Tu día empieza por **${title}**. ¿Quieres que te abra el documento?`;
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
