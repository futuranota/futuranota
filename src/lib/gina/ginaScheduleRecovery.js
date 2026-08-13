/**
 * Schedule recovery signals + copy for Gina (passed slots → mark past due / cascade).
 */

import { DOC_WORK_STATUS } from "../docWorkStatus.js";
import { resolveRecoveryOfferMode } from "./ginaTodayTimeTriage.js";

export { resolveRecoveryOfferMode, formatLateStartDelay } from "./ginaTodayTimeTriage.js";

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
 * Paso 1 copy — fully expired + late-start active.
 * Easy Link options render under the viz (RecoveryEasyLinksLegend).
 * @param {{
 *   locale?: string,
 *   overdueTimes?: string[],
 *   overdueTitles?: string[],
 *   urgencyCount?: number,
 *   lateStartLabels?: { label: string, time: string, title?: string }[],
 *   lateStartCount?: number,
 *   recoveryOfferMode?: string,
 * }} opts
 */
export function buildScheduleRecoveryOverdueStepText(opts = {}) {
  const en = opts.locale === "en";
  const titles = Array.isArray(opts.overdueTitles)
    ? opts.overdueTitles.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  const n = Number(opts.urgencyCount) || titles.length || 0;
  const late = Array.isArray(opts.lateStartLabels) ? opts.lateStartLabels : [];
  const lateN = Number(opts.lateStartCount) || late.length || 0;
  const mode = opts.recoveryOfferMode
    || resolveRecoveryOfferMode({ urgencyCount: n, lateStartCount: lateN });

  const boldJoin = (list) => {
    if (!list.length) return "";
    if (list.length === 1) return `**${list[0]}**`;
    if (en) {
      if (list.length === 2) return `**${list[0]}** and **${list[1]}**`;
      return `${list.slice(0, -1).map((t) => `**${t}**`).join(", ")}, and **${list[list.length - 1]}**`;
    }
    if (list.length === 2) return `**${list[0]}** y **${list[1]}**`;
    return `${list.slice(0, -1).map((t) => `**${t}**`).join(", ")} y **${list[list.length - 1]}**`;
  };

  const lines = [];

  if (n > 0) {
    const joined = boldJoin(titles);
    if (en) {
      if (n === 1) {
        lines.push(joined
          ? `The document ${joined} already ended.`
          : "This document already ended.");
      } else {
        lines.push(joined
          ? `The documents ${joined} already ended.`
          : `These ${n} documents already ended.`);
      }
    } else if (n === 1) {
      lines.push(joined
        ? `El documento ${joined} ya pasó de hora.`
        : "Este documento ya pasó de hora.");
    } else {
      lines.push(joined
        ? `Los documentos ${joined} ya pasaron de hora.`
        : `Estos ${n} documentos ya pasaron de hora.`);
    }
  }

  if (lateN > 0) {
    if (lines.length) lines.push("");
    const first = late[0] || {};
    const title = String(first.title || first.label || (en ? "this document" : "este documento")).trim();
    const delay = String(first.delay || "").trim()
      || (en ? "a while" : "un rato");
    const statusNotStarted = en ? "**Not started**" : "**«Sin empezar»**";

    if (mode === "late_start") {
      if (en) {
        if (lateN === 1) {
          lines.push(
            `The document **${title}** is still inside its window but shows ${statusNotStarted}. `
            + `You should have started ${delay} ago. You’re still in time to pick it back up.`,
          );
        } else {
          lines.push(
            `These documents are still inside their windows but show ${statusNotStarted} `
            + `(e.g. **${title}**, about ${delay} late). You’re still in time to pick them back up.`,
          );
        }
      } else if (lateN === 1) {
        lines.push(
          `El documento **${title}** sigue dentro de su ventana pero figura ${statusNotStarted}. `
          + `Deberías haber comenzado hace ${delay}. Aún estás a tiempo para retomarlo.`,
        );
      } else {
        lines.push(
          `Estos documentos siguen dentro de su ventana pero figuran ${statusNotStarted} `
          + `(p. ej. **${title}**, unos ${delay} de retraso). Aún estás a tiempo para retomarlos.`,
        );
      }
    } else if (en) {
      if (lateN === 1) {
        lines.push(
          `Also, the document **${title}** is still inside its window but shows ${statusNotStarted}. `
          + `You should have started ${delay} ago. You’re still in time to pick it back up.`,
        );
      } else {
        lines.push(
          `Also, ${lateN} documents are still inside their windows but show ${statusNotStarted}. `
          + `You’re still in time to pick them back up.`,
        );
      }
    } else if (lateN === 1) {
      lines.push(
        `Además, el documento **${title}** sigue dentro de su ventana pero figura ${statusNotStarted}. `
        + `Deberías haber comenzado hace ${delay}. Aún estás a tiempo para retomarlo.`,
      );
    } else {
      lines.push(
        `Además, ${lateN} documentos siguen dentro de su ventana con ${statusNotStarted}. `
        + `Aún estás a tiempo para retomarlos.`,
      );
    }
  }

  if (!lines.length) {
    return en
      ? "How do you want to handle today’s schedule notes?"
      : "¿Cómo prefieres gestionar los puntos de la agenda de hoy?";
  }

  return lines.join("\n");
}

/**
 * Structured Easy Links legend rows (icons under overdue_check viz).
 * @param {{
 *   locale?: string,
 *   recoveryOfferMode?: string,
 *   urgencyCount?: number,
 *   lateStartCount?: number,
 *   openDocId?: string | null,
 *   openDocTitle?: string | null,
 * }} [opts]
 * @returns {{
 *   id: string,
 *   title: string,
 *   body: string,
 *   icon: string,
 *   iconLabel: string,
 *   actionText?: string | null,
 *   ctaLabel?: string | null,
 *   tier?: "star"|"secondary"|"snooze"|"status"|"card",
 *   control?: "link"|"cta"|"snooze_menu"|"status_menu",
 *   statusKey?: string | null,
 *   statusColor?: string | null,
 * }[]}
 */
export function buildRecoveryEasyLinksLegend(opts = {}) {
  const en = opts.locale === "en";
  const mode = opts.recoveryOfferMode
    || resolveRecoveryOfferMode({
      urgencyCount: opts.urgencyCount,
      lateStartCount: opts.lateStartCount,
    });
  const step = opts.currentStep || null;

  const snoozeRow = {
    id: "recovery_snooze",
    title: en ? "Snooze reminder" : "Posponer Recordatorio",
    body: en
      ? "Keep the plan and I’ll remind you at the time you choose."
      : "Mantiene el plan y te avisa a la hora que elijas.",
    icon: "/uploads/pending.svg",
    iconLabel: en ? "Reminder" : "Recordatorio",
    actionText: null,
    ctaLabel: en ? "Snooze" : "Posponer",
    tier: "snooze",
    control: "snooze_menu",
    statusKey: null,
    statusColor: null,
  };

  /** Overdue: snooze + mark past_due in one card. */
  const snoozeRowOverdue = {
    ...snoozeRow,
    body: en
      ? "We can set the status to «past due», keep the plan, and I’ll remind you at the time you choose."
      : "Podemos cambiar el status a «vencido» manteniendo el plan y te aviso a la hora que elijas.",
    bodyHighlight: en ? "past due" : "vencido",
    statusKey: "past_due",
    statusColor: "#F2F2F2",
  };

  const deleteOverdueRow = {
    id: "delete_overdue_docs",
    title: en ? "Delete files" : "Borrar archivos",
    body: en
      ? "Mark them done — this permanently deletes them and updates today’s pending work."
      : "Dalos por terminados, esto se borrará permanentemente y actualiza tus pendientes de hoy.",
    icon: "/uploads/pas-due.svg",
    iconLabel: en ? "Delete" : "Borrar",
    actionText: en
      ? "Delete today's overdue files"
      : "Borrar archivos vencidos de hoy",
    ctaLabel: en ? "Delete files" : "Borrar archivos",
    tier: "card",
    control: "link",
    statusKey: null,
    statusColor: "#c9b896",
  };

  const rescheduleStar = {
    id: "move_end_of_day",
    title: en ? "Reschedule today" : "Reagendar horario",
    body: en
      ? "Open today’s calendar options and push what’s pending from now, or fit it into free gaps."
      : "Abre las opciones del calendario de hoy y corre lo pendiente desde ahora, o acomódalo en los huecos libres.",
    icon: "/uploads/CalendarDots.svg",
    iconLabel: en ? "Later" : "Más tarde",
    actionText: en
      ? "Reschedule for today"
      : "Reagendar para hoy",
    ctaLabel: en ? "Reschedule" : "Reagendar",
    tier: "star",
    control: "link",
    statusKey: null,
    statusColor: null,
  };

  // After conflict dual-timeline: offer reschedule into today's full calendar listing.
  if (step === "conflict_resolve") {
    return [rescheduleStar, snoozeRow];
  }

  if (mode === "late_start") {
    const openId = String(opts.openDocId || "").trim();
    const openTitle = String(opts.openDocTitle || "").trim();
    /** @type {ReturnType<typeof buildRecoveryEasyLinksLegend>} */
    const rows = [
      {
        id: "move_end_of_day",
        title: en ? "Reschedule today" : "Reagendar hoy",
        body: en
          ? "We push what’s pending from now, or fit it into your free gaps."
          : "Corremos lo pendiente desde este momento o lo acomodamos en tus espacios disponibles.",
        icon: "/uploads/CalendarDots.svg",
        iconLabel: en ? "Later" : "Más tarde",
        actionText: en
          ? "Reschedule for today"
          : "Reagendar para hoy",
        ctaLabel: en ? "Reschedule" : "Reagendar",
        tier: "star",
        control: "link",
        statusKey: null,
        statusColor: null,
      },
    ];
    if (openId) {
      rows.push({
        id: "open_late_start_doc",
        title: openTitle
          ? (en ? `Open ${openTitle}` : `Abrir ${openTitle}`)
          : (en ? "Open document" : "Abrir documento"),
        body: en
          ? "Still time — open and work inside this block."
          : "Aún a tiempo — ábrelo y trabaja dentro de este bloque.",
        icon: "/uploads/pending.svg",
        iconLabel: en ? "Open" : "Abrir",
        actionText: `GinaRevealDocument:${openId}`,
        ctaLabel: en ? "Open" : "Abrir",
        tier: "secondary",
        control: "link",
        statusKey: null,
        statusColor: null,
      });
    }
    rows.push({
      id: "change_status",
      title: en ? "Change status" : "Cambiar Status",
      body: en
        ? "You’re already in the window — change the status if you already started."
        : "Ya estás en la ventana — cambia el status si ya comenzaste.",
      icon: "/uploads/pending.svg",
      iconLabel: en ? "Status" : "Status",
      actionText: null,
      ctaLabel: en ? "Change status" : "Cambiar status",
      tier: "status",
      control: "status_menu",
      statusKey: "in_progress",
      statusColor: "#4DB3FF",
    });
    rows.push(snoozeRow);
    return rows;
  }

  if (mode === "none") return [];

  // expired | mixed: Posponer(+vencido) then Borrar (last), both card-wrapped in UI.
  return [
    rescheduleStar,
    snoozeRowOverdue,
    deleteOverdueRow,
  ];
}

/**
 * Status menu options (late-start Easy Links). Silent apply — does not rewrite the legend UI.
 * Per-row status in tables uses {@link buildSheetRowStatusMenuOptions} instead.
 * @param {{ locale?: string, recoveryOfferMode?: string }} [opts]
 */
export function buildRecoveryChangeStatusMenuOptions(opts = {}) {
  const en = opts.locale === "en";
  void opts.recoveryOfferMode;
  return [
    {
      id: "status_in_progress",
      label: en ? "In progress" : "En Progreso",
      text: "GinaSilentMarkInProgress",
    },
  ];
}

/**
 * Per-row status options inside schedule / reschedule tables.
 * @param {{ locale?: string, docId?: string }} [opts]
 */
export function buildSheetRowStatusMenuOptions(opts = {}) {
  const en = opts.locale === "en";
  const docId = String(opts.docId || "").trim();
  const protocol = (status) => (
    docId ? buildGinaSilentSetDocStatusProtocol(status, docId) : ""
  );
  return [
    {
      id: "row_status_completed",
      status: DOC_WORK_STATUS.COMPLETED,
      label: en ? "Completed" : "Completado",
      text: protocol(DOC_WORK_STATUS.COMPLETED),
    },
    {
      id: "row_status_past_due",
      status: DOC_WORK_STATUS.PAST_DUE,
      label: en ? "Past due" : "Archivar / Vencido",
      text: protocol(DOC_WORK_STATUS.PAST_DUE),
    },
    {
      id: "row_status_in_progress",
      status: DOC_WORK_STATUS.IN_PROGRESS,
      label: en ? "In progress" : "En Progreso",
      text: protocol(DOC_WORK_STATUS.IN_PROGRESS),
    },
    {
      id: "row_status_not_started",
      status: DOC_WORK_STATUS.NOT_STARTED,
      label: en ? "Not started" : "Sin empezar",
      text: protocol(DOC_WORK_STATUS.NOT_STARTED),
    },
  ].filter((o) => Boolean(o.text));
}

/**
 * Silent per-doc status: GinaSilentSetDocStatus:<status>:<docId>
 * @param {string} status
 * @param {string} docId
 */
export function buildGinaSilentSetDocStatusProtocol(status, docId) {
  const s = String(status || "").trim().toLowerCase();
  const id = String(docId || "").trim();
  if (!s || !id) return "";
  return `GinaSilentSetDocStatus:${s}:${id}`;
}

/**
 * @param {string} text
 * @returns {{ status: string, docId: string } | null}
 */
export function parseGinaSilentSetDocStatus(text) {
  const m = String(text || "").trim().match(
    /^GinaSilentSetDocStatus:(not_started|reserved|flexible|in_progress|submitted|past_due|completed):(.+)$/i,
  );
  if (!m) return null;
  return {
    status: String(m[1] || "").toLowerCase(),
    docId: String(m[2] || "").trim(),
  };
}

/**
 * Snooze menu options for recovery remind-later.
 * @param {{ locale?: string }} [opts]
 */
export function buildRecoverySnoozeMenuOptions(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "snooze_15m",
      label: en ? "15 min" : "15 min",
      text: en
        ? "Snooze schedule recovery reminder 15m"
        : "Posponer recordatorio de recuperación 15m",
    },
    {
      id: "snooze_30m",
      label: en ? "30 min" : "30 min",
      text: en
        ? "Snooze schedule recovery reminder 30m"
        : "Posponer recordatorio de recuperación 30m",
    },
    {
      id: "snooze_60m",
      label: en ? "+1 hour" : "+1 hora",
      text: en
        ? "Snooze schedule recovery reminder 60m"
        : "Posponer recordatorio de recuperación 60m",
    },
    {
      id: "snooze_next_gap",
      label: en ? "Until next free gap" : "Hasta el próximo hueco libre",
      text: en
        ? "Snooze schedule recovery reminder until free gap"
        : "Posponer recordatorio de recuperación hasta hueco libre",
    },
    {
      id: "snooze_exact",
      label: en ? "Pick exact time…" : "Elegir hora exacta…",
      text: null,
      exactTime: true,
    },
  ];
}

/**
 * Build exact-time snooze protocol (HH:MM local).
 * @param {string} hhmm
 * @param {{ locale?: string }} [opts]
 */
export function buildRecoverySnoozeExactProtocol(hhmm, opts = {}) {
  const en = opts.locale === "en";
  const t = String(hhmm || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(t)) return "";
  return en
    ? `Snooze schedule recovery reminder until ${t}`
    : `Posponer recordatorio de recuperación hasta ${t}`;
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
      id: "move_end_of_day",
      label: en ? "Reschedule" : "Reagendar",
      text: en
        ? "Reschedule for today"
        : "Reagendar para hoy",
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
 * @param {{
 *   locale?: string,
 *   lateStartCount?: number,
 *   urgencyCount?: number,
 *   recoveryOfferMode?: string,
 *   openDocId?: string | null,
 *   openDocTitle?: string | null,
 * }} [opts]
 */
export function buildScheduleRecoveryOverdueChips(opts = {}) {
  const en = opts.locale === "en";
  const lateN = Number(opts.lateStartCount) || 0;
  const urgencyN = Number(opts.urgencyCount) || 0;
  const mode = opts.recoveryOfferMode
    || resolveRecoveryOfferMode({ urgencyCount: urgencyN, lateStartCount: lateN });
  /** @type {{ id: string, label: string, text: string, primary?: boolean, comingSoon?: boolean }[]} */
  const chips = [];

  if (lateN > 0 && mode !== "late_start") {
    chips.push({
      id: "mark_in_progress_batch",
      label: en ? "Mark late starts In progress" : "Pasar a En Progreso",
      text: en
        ? "Mark late-start blocks as in progress"
        : "Marcar bloques con inicio tardío como en progreso",
      primary: false,
    });
  }

  if (mode === "late_start") {
    const openId = String(opts.openDocId || "").trim();
    const openTitle = String(opts.openDocTitle || "").trim();
    chips.push({
      id: "move_end_of_day",
      label: en ? "Reschedule" : "Reagendar",
      text: en
        ? "Reschedule for today"
        : "Reagendar para hoy",
      primary: true,
    });
    if (openId) {
      chips.push({
        id: "open_late_start_doc",
        label: openTitle
          ? (en ? `Open ${openTitle}` : `Abrir ${openTitle}`)
          : (en ? "Open document" : "Abrir documento"),
        text: `GinaRevealDocument:${openId}`,
      });
    }
    return chips;
  }

  // expired | mixed — Posponer(+vencido) via Easy Links; chips mirror primary actions
  chips.push(
    {
      id: "move_end_of_day",
      label: en ? "Reschedule" : "Reagendar",
      text: en
        ? "Reschedule for today"
        : "Reagendar para hoy",
      primary: true,
    },
    {
      id: "delete_overdue_docs",
      label: en ? "Delete files" : "Borrar archivos",
      text: en
        ? "Delete today's overdue files"
        : "Borrar archivos vencidos de hoy",
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
  return [
    {
      id: "move_end_of_day",
      label: en ? "Reschedule today" : "Reagendar horario",
      text: en
        ? "Reschedule for today"
        : "Reagendar para hoy",
      primary: true,
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
      urgencyCount: opts.urgencyCount,
      recoveryOfferMode: opts.recoveryOfferMode,
      openDocId: opts.openDocId,
      openDocTitle: opts.openDocTitle,
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
 * @param {"mark_past_due" | "postpone_schedule" | "mark_completed" | "mark_in_progress" | "delete_docs"} intent
 * @param {{ count?: number, locale?: string }} [opts]
 */
export function buildScheduleRecoveryAck(intent, opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count ?? 0;
  if (intent === "delete_docs") {
    return en
      ? `I’ll permanently delete ${n} overdue file(s) and update today’s pending work. Confirm before I remove them.`
      : `Voy a borrar permanentemente ${n} archivo(s) vencido(s) y actualizar tus pendientes de hoy. Confirma antes de que los elimine.`;
  }
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
 * @param {"mark_past_due" | "postpone_schedule" | "mark_completed" | "mark_in_progress" | "delete_docs"} intent
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleRecoveryConfirmChips(intent, opts = {}) {
  const en = opts.locale === "en";
  const confirmText = (() => {
    if (intent === "delete_docs") {
      return en ? "Confirm delete overdue files" : "Confirmar borrar archivos vencidos";
    }
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
 * @param {"mark_past_due" | "postpone_schedule" | "mark_completed" | "mark_in_progress" | "delete_docs"} intent
 * @param {{ count?: number, locale?: string, startLabel?: string | null }} [opts]
 */
export function buildScheduleRecoveryAppliedText(intent, opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count ?? 0;
  if (intent === "delete_docs") {
    return en
      ? `Done — permanently deleted ${n} file(s) and refreshed today’s pending list.`
      : `Listo — borré permanentemente ${n} archivo(s) y actualicé tus pendientes de hoy.`;
  }
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
 * Fork chips after “Reagendar para hoy”: cascade vs free gaps.
 * @param {{ locale?: string }} [opts]
 */
export function buildRescheduleForkChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "reschedule_cascade",
      label: en ? "Cascade from now" : "Mover en cascada desde ahora",
      text: en
        ? "Cascade schedule blocks from now"
        : "Mover en cascada los bloques desde ahora",
      primary: true,
    },
    {
      id: "reschedule_gaps",
      label: en ? "Fit into free gaps" : "Encajar en huecos libres",
      text: en
        ? "Reschedule expired blocks show free slots"
        : "Reagendar bloques vencidos mostrar cupos libres",
    },
  ];
}

/**
 * Intro when choosing how to reschedule today.
 * @param {{ locale?: string }} [opts]
 */
export function buildRescheduleForkText(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "How do you want to reschedule?\n\n**Cascade from now**: Keep each card’s duration and push the queue forward from now (you can edit before applying).\n\n**Fit into free gaps**: Place each block into an open slot without auto-shifting the rest."
    : "¿Cómo quieres reagendar?\n\n**Mover en cascada desde ahora**: Respeta la duración de cada ficha y empuja la cola desde ahora (puedes editar antes de aplicar).\n\n**Encajar en huecos libres**: Coloca cada bloque en un cupo libre sin mover el resto automáticamente.";
}

/**
 * Copy when opening the free-slot / cascade picker (Gina facilitates; user chooses).
 * @param {{ locale?: string, hasFreeSlot?: boolean, noCupo?: boolean, activeTitle?: string | null, mode?: "gaps"|"cascade" }} [opts]
 */
export function buildReschedulePickerText(opts = {}) {
  const en = opts.locale === "en";
  if (opts.mode === "cascade") {
    return en
      ? "Adjusted schedule for you:\nEdit the hours directly if you need to, then tap Apply changes. You can also update each block’s status individually."
      : "Horario ajustado para ti:\nModifica las horas directamente si lo necesitas y pulsa Aplicar cambios. También puedes actualizar el estado de cada bloque de forma individual.";
  }
  if (opts.noCupo || opts.hasFreeSlot === false) {
    const title = String(opts.activeTitle || "").trim();
    if (en) {
      return title
        ? `No free window left today for **${title}**. Struck hours are busy or already past — pick tomorrow, compress (soon), or insert at the end of the night.`
        : "No free window left today for this block. Struck hours are busy or already past — pick tomorrow, compress (soon), or insert at the end of the night.";
    }
    return title
      ? `Sin cupo libre hoy para **${title}**. Las horas tachadas están ocupadas o ya pasaron — elige mañana, comprimir (próx.) o insertar al final de la noche.`
      : "Sin cupo libre hoy para este bloque. Las horas tachadas están ocupadas o ya pasaron — elige mañana, comprimir (próx.) o insertar al final de la noche.";
  }
  return en
    ? "Here are the blocks to reschedule. Pick one, check the struck hours (busy or already past), and assign a free slot. When you finish one, we continue with the next."
    : "Aquí están los bloques a reagendar. Elige uno, mira las horas tachadas (ocupadas o ya pasadas) y asígnale un cupo libre. Cuando termines uno, seguimos con el siguiente.";
}

/**
 * Progress line after assigning one doc in the loop.
 * @param {{ locale?: string, title?: string, timeLabel?: string, nextTitle?: string | null, remaining?: number }} [opts]
 */
export function buildRescheduleProgressText(opts = {}) {
  const en = opts.locale === "en";
  const title = String(opts.title || "").trim() || (en ? "the document" : "el documento");
  const time = String(opts.timeLabel || "").trim();
  const next = String(opts.nextTitle || "").trim();
  const left = Number(opts.remaining) || 0;
  if (en) {
    const done = time
      ? `Done — **${title}** is now ${time}.`
      : `Done — **${title}** is updated.`;
    if (left <= 0) return done;
    return next
      ? `${done} Next: pick a free slot for **${next}**.`
      : `${done} ${left} block(s) left — pick the next one.`;
  }
  const done = time
    ? `Listo — **${title}** quedó en ${time}.`
    : `Listo — **${title}** quedó actualizado.`;
  if (left <= 0) return done;
  return next
    ? `${done} Siguiente: elige el cupo para **${next}**.`
    : `${done} Quedan ${left} bloque(s) — elige el siguiente.`;
}

/**
 * Ack after applying the last chosen slot (loop finished).
 * @param {{
 *   locale?: string,
 *   timeLabel?: string,
 *   dayLabel?: string,
 *   count?: number,
 *   withoutOverlaps?: boolean,
 * }} [opts]
 */
export function buildRescheduleAppliedText(opts = {}) {
  const en = opts.locale === "en";
  const n = Math.max(1, Number(opts.count) || 1);
  if (en) {
    const noun = n === 1 ? "file" : "files";
    return `Done:\nI rescheduled the schedule for ${n} ${noun} and your agenda is updated.`;
  }
  const noun = n === 1 ? "archivo" : "archivos";
  return `Listo:\nReagendé el horario de ${n} ${noun} y tu agenda quedó actualizada.`;
}

/**
 * After a user-confirmed reschedule apply, never re-open conflict_resolve
 * in the same turn — next beat is the day sheet with the new times.
 * @param {{ forceDayReady?: boolean, hasOverlap?: boolean }} [opts]
 * @returns {"conflict_resolve" | "day_ready"}
 */
export function resolvePostMutationRecoveryFollowUp(opts = {}) {
  if (opts.forceDayReady) return "day_ready";
  return opts.hasOverlap ? "conflict_resolve" : "day_ready";
}

/**
 * Build protocol for batch reschedule commit (displayText stays friendly).
 * @param {{ id: string, startIso: string, finishIso: string }[]} applies
 * @param {string[]} [sessionMoveDocIds]
 * @returns {string}
 */
export function buildRescheduleBatchApplyProtocol(applies, sessionMoveDocIds = []) {
  const rows = (Array.isArray(applies) ? applies : [])
    .map((a) => {
      const id = String(a?.id || "").trim();
      const start = String(a?.startIso || "").trim();
      const finish = String(a?.finishIso || "").trim();
      if (!id || !start || !finish) return "";
      return `${id}|${start}|${finish}`;
    })
    .filter(Boolean);
  if (!rows.length) return "";
  const session = (Array.isArray(sessionMoveDocIds) ? sessionMoveDocIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .join(",");
  const body = session ? `${rows.join(";")}|${session}` : rows.join(";");
  return `Aplicar cambios reagendados ${body}`;
}

/**
 * Parse batch / single reschedule apply protocol from user text.
 * @param {string} text
 * @returns {{
 *   match: boolean,
 *   batchApplies: { id: string, startIso: string, finishIso: string }[],
 *   applyDocId: string | null,
 *   applyStartIso: string | null,
 *   applyFinishIso: string | null,
 *   sessionMoveDocIds: string[] | null,
 * }}
 */
export function parseRescheduleApplyProtocol(text) {
  const raw = String(text || "").trim();
  const empty = {
    match: false,
    batchApplies: [],
    applyDocId: null,
    applyStartIso: null,
    applyFinishIso: null,
    sessionMoveDocIds: null,
  };
  if (!raw) return empty;

  const batchMatch = raw.match(
    /\b(?:aplicar\s+cambios\s+reagendados|apply\s+reschedule\s+changes)\s+(.+)$/i,
  );
  if (batchMatch) {
    let body = String(batchMatch[1] || "").trim();
    let sessionMoveDocIds = null;
    // Optional trailing |sessionIds (session ids have no "T" ISO marker).
    const sessionSep = body.lastIndexOf("|");
    if (sessionSep > 0) {
      const maybeSession = body.slice(sessionSep + 1).trim();
      if (maybeSession && !maybeSession.includes("T") && !maybeSession.includes(";")) {
        sessionMoveDocIds = maybeSession.split(",").map((s) => s.trim()).filter(Boolean);
        body = body.slice(0, sessionSep).trim();
      }
    }
    const batchApplies = body.split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const parts = chunk.split("|").map((s) => s.trim()).filter(Boolean);
        if (parts.length < 3) return null;
        return { id: parts[0], startIso: parts[1], finishIso: parts[2] };
      })
      .filter(Boolean);
    if (!batchApplies.length) return empty;
    return {
      match: true,
      batchApplies,
      applyDocId: batchApplies[0].id,
      applyStartIso: batchApplies[0].startIso,
      applyFinishIso: batchApplies[0].finishIso,
      sessionMoveDocIds,
    };
  }

  const applyMatch = raw.match(
    /\b(?:aplicar\s+cupo\s+reagendado|apply\s+reschedule\s+slot)\s+(\S+)/i,
  );
  if (!applyMatch) return empty;
  const parts = String(applyMatch[1] || "").split("|").filter(Boolean);
  let applyDocId = null;
  let applyStartIso = null;
  let applyFinishIso = null;
  let sessionMoveDocIds = null;
  if (parts.length >= 4) {
    applyDocId = parts[0];
    applyStartIso = parts[1];
    applyFinishIso = parts[2];
    sessionMoveDocIds = parts[3].split(",").map((s) => s.trim()).filter(Boolean);
  } else if (parts.length === 3) {
    applyDocId = parts[0];
    applyStartIso = parts[1];
    applyFinishIso = parts[2];
  } else if (parts.length === 2) {
    applyStartIso = parts[0];
    applyFinishIso = parts[1];
  }
  return {
    match: true,
    batchApplies: applyDocId && applyStartIso && applyFinishIso
      ? [{ id: applyDocId, startIso: applyStartIso, finishIso: applyFinishIso }]
      : [],
    applyDocId,
    applyStartIso,
    applyFinishIso,
    sessionMoveDocIds,
  };
}

/**
 * Snooze ack + advance.
 * @param {{ locale?: string, minutes?: number | null, untilLabel?: string | null, markPastDue?: boolean }} [opts]
 */
export function buildRecoverySnoozeText(opts = {}) {
  const en = opts.locale === "en";
  const untilLabel = String(opts.untilLabel || "").trim();
  const minutes = Number(opts.minutes);
  const markPastDue = Boolean(opts.markPastDue);
  const pastDueBit = markPastDue
    ? (en
      ? " I marked those blocks as Past due."
      : " Pasé esos bloques a Vencido.")
    : "";
  if (untilLabel) {
    return en
      ? `Okay — I’ll keep the current plan and remind you at ${untilLabel}.${pastDueBit}`
      : `De acuerdo, mantengo el plan actual y te aviso a las ${untilLabel}.${pastDueBit}`;
  }
  if (Number.isFinite(minutes) && minutes > 0) {
    if (minutes >= 60 && minutes % 60 === 0) {
      const hours = minutes / 60;
      return en
        ? `Okay — I’ll keep the current plan. I’ll remind you in ${hours} hour${hours === 1 ? "" : "s"}.${pastDueBit}`
        : `De acuerdo, mantengo el plan actual. Te recordaré en ${hours} hora${hours === 1 ? "" : "s"}.${pastDueBit}`;
    }
    return en
      ? `Okay — I’ll keep the current plan. I’ll remind you in ${minutes} minutes.${pastDueBit}`
      : `De acuerdo, mantengo el plan actual. Te recordaré en ${minutes} minutos.${pastDueBit}`;
  }
  return en
    ? `Okay — I’ll keep the current plan. I’ll remind you about these blocks in the next review.${pastDueBit}`
    : `De acuerdo, mantengo el plan actual. Te recordaré el estado de tus bloques en la siguiente revisión.${pastDueBit}`;
}

/**
 * Parse snooze protocol from user/chip text.
 * @param {string} text
 * @returns {{ match: boolean, minutes?: number | null, untilHhmm?: string | null, untilFreeGap?: boolean }}
 */
export function parseRecoverySnoozeProtocol(text) {
  const raw = String(text || "").trim();
  const q = raw.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const isSnooze = /\bposponer\s+recordatorio\s+de\s+recuperacion\b/.test(q)
    || /\bsnooze\s+schedule\s+recovery\s+reminder\b/.test(q);
  if (!isSnooze) return { match: false };

  if (/\bhasta\s+hueco\s+libre\b/.test(q) || /\buntil\s+free\s+gap\b/.test(q)) {
    return { match: true, untilFreeGap: true, minutes: null, untilHhmm: null };
  }
  const until = q.match(/\bhasta\s+(\d{1,2}:\d{2})\b/) || q.match(/\buntil\s+(\d{1,2}:\d{2})\b/);
  if (until?.[1]) {
    return { match: true, untilHhmm: until[1], minutes: null, untilFreeGap: false };
  }
  const mins = q.match(/\b(\d+)\s*m\b/) || q.match(/\b(\d+)\s*min/);
  if (mins?.[1]) {
    return { match: true, minutes: Number(mins[1]), untilHhmm: null, untilFreeGap: false };
  }
  // Legacy bare snooze → 30m default (no more fixed 45).
  return { match: true, minutes: 30, untilHhmm: null, untilFreeGap: false };
}

/**
 * Ack after cascade/gaps apply when the day is ready (no infographic).
 * @param {{ locale?: string }} [opts]
 */
export function buildRescheduleDayReadyText(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "Perfect — your schedule is readjusted and ready."
    : "Perfecto, ahora tu horario está reajustado y listo.";
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
