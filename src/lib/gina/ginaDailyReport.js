/**
 * Daily Report v1 (honest): today's schedule truth + folder % snapshot + pending brief.
 * No invented activity history. No collision copy unless conflicts exist.
 */

import { listOccupiedIntervalsByDate } from "../docScheduleOccupancy.js";
import { resolveFolderStatus, isClosedForScheduleProgress } from "../folderStatus.js";
import { DOC_WORK_STATUS, resolveDocWorkStatus } from "../docWorkStatus.js";
import { formatClock12h, formatClockRange12h } from "../clockFormat.js";
import { get_schedule_conflicts, get_today_scope } from "./ginaTools.js";

const BREAK_MS = 5 * 60 * 1000;

function formatRangeLabel(startIso, finishIso) {
  return formatClockRange12h(startIso, finishIso) || "—";
}

function formatClock(iso) {
  return formatClock12h(iso) || "—";
}

function isClosedStatus(status) {
  return isClosedForScheduleProgress(status);
}

/**
 * Folder % snapshot for documents that appear on today's schedule.
 * `total` = all children in the folder; `percent` / done = scheduled-only progress.
 * @param {object[]} docs
 * @param {Record<string, object>} nodesById
 * @param {Record<string, object>} docsById
 * @returns {{ folderId: string, folder: string, percent: number, done: number, total: number, scheduledTotal: number, todayCount: number }[]}
 */
export function buildFolderProgressForDocuments(docs = [], nodesById = {}, docsById = {}) {
  const list = Array.isArray(docs) ? docs : [];
  /** @type {Map<string, number>} */
  const todayCountByFolder = new Map();
  for (const d of list) {
    const fid = String(
      d?.parentFolderId || d?.folderId || d?.parentDocId || "",
    ).trim();
    if (!fid) continue;
    todayCountByFolder.set(fid, (todayCountByFolder.get(fid) || 0) + 1);
  }
  const out = [];
  for (const [folderId, todayCount] of todayCountByFolder) {
    const st = resolveFolderStatus(nodesById, folderId);
    if (!st.total) continue;
    const folderDoc = docsById[folderId];
    out.push({
      folderId,
      folder: folderDoc?.title || folderDoc?.name || "Folder",
      percent: st.scheduledPercent,
      done: st.scheduledDone,
      total: st.total,
      scheduledTotal: st.scheduledTotal,
      todayCount,
      status: st.status,
    });
  }
  out.sort((a, b) => String(a.folder).localeCompare(String(b.folder)));
  return out;
}

/**
 * @param {import("./ginaTools.js").GinaToolsContext} ctx
 * @param {{ now?: Date }} [opts]
 */
export function buildGinaDailyReport(ctx = {}, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : (ctx.now instanceof Date ? ctx.now : new Date());
  const today = get_today_scope(ctx, { includeCompleted: true });
  const date = today.date;
  const nodesById = ctx.nodes || {};
  const docsById = ctx.docs || {};

  const occupiedRaw = listOccupiedIntervalsByDate(
    nodesById,
    docsById,
    date,
    { objectId: ctx.objectId || null },
  );

  const { conflicts: rawConflicts } = get_schedule_conflicts({ ...ctx, now });
  const todayConflicts = (rawConflicts || []).filter((c) => c.date === date);

  /** @type {Map<string, string>} */
  const conflictGroupByDoc = new Map();
  todayConflicts.forEach((c, idx) => {
    const groupId = `c${idx + 1}`;
    for (const d of c.documents || []) {
      if (d?.id) conflictGroupByDoc.set(d.id, groupId);
    }
  });

  const occupiedHours = occupiedRaw.map((row) => {
    const node = nodesById[row.id];
    const status = resolveDocWorkStatus(node);
    const finishMs = row.finishMs;
    const timePassed = Number.isFinite(finishMs) && finishMs < now.getTime();
    const completed = status === DOC_WORK_STATUS.COMPLETED;
    return {
      id: row.id,
      title: row.title,
      time: String(row.time || "").replace("-", "–"),
      anchorAt: row.start,
      anchorFinishAt: row.finish,
      status,
      struck: timePassed || completed,
      conflictGroupId: conflictGroupByDoc.get(row.id) || null,
      hasConflict: conflictGroupByDoc.has(row.id),
    };
  });

  const todayDocs = Array.isArray(today.documents) ? today.documents : [];

  const pendingBrief = todayDocs
    .filter((d) => !isClosedStatus(d.status))
    .slice()
    .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
    .map((d) => ({
      id: d.id,
      title: d.title,
      time: d.time || formatRangeLabel(d.anchorAt, d.anchorFinishAt),
      status: d.status || null,
      folder: d.parentFolderName || d.folder || d.hierarchy?.folder || null,
    }));

  /** Folders that have at least one today-scheduled doc. */
  const folderProgress = buildFolderProgressForDocuments(
    todayDocs,
    nodesById,
    docsById,
  );
  // Also include folders that only appear via occupied intervals (no timed today doc title).
  const folderIds = new Set(folderProgress.map((f) => f.folderId));
  for (const row of occupiedRaw) {
    const node = nodesById[row.id];
    if (node?.parentDocId) folderIds.add(node.parentDocId);
  }
  for (const folderId of folderIds) {
    if (folderProgress.some((f) => f.folderId === folderId)) continue;
    const st = resolveFolderStatus(nodesById, folderId);
    if (!st.total) continue;
    const folderDoc = docsById[folderId];
    folderProgress.push({
      folderId,
      folder: folderDoc?.title || folderDoc?.name || "Folder",
      percent: st.scheduledPercent,
      done: st.scheduledDone,
      total: st.total,
      scheduledTotal: st.scheduledTotal,
      todayCount: 0,
      status: st.status,
    });
  }
  folderProgress.sort((a, b) => String(a.folder).localeCompare(String(b.folder)));

  const conflicts = todayConflicts.map((c, idx) => {
    const docs = (c.documents || []).map((d) => ({
      id: d.id,
      title: d.title,
      folder: d.folder || null,
      timeLabel: d.time,
    }));
    return {
      id: `c${idx + 1}`,
      date: c.date,
      documents: docs,
      overlapTime: c.overlapTime,
      severity: c.severity || "medium",
    };
  });

  /** Move the later-starting doc to finish(earlier) + 5m, keep duration. */
  const proposals = [];
  const seenMove = new Set();
  for (const c of todayConflicts) {
    const pair = c.documents || [];
    if (pair.length < 2) continue;
    const enriched = pair.map((d) => {
      const full = todayDocs.find((x) => x.id === d.id)
        || occupiedRaw.find((x) => x.id === d.id);
      const start = full?.anchorAt || full?.start || null;
      const finish = full?.anchorFinishAt || full?.finish || null;
      return {
        id: d.id,
        title: d.title || full?.title || "Document",
        anchorAt: start,
        anchorFinishAt: finish,
        startMs: start ? Date.parse(start) : NaN,
        finishMs: finish ? Date.parse(finish) : NaN,
      };
    }).filter((d) => d.id && Number.isFinite(d.startMs));

    if (enriched.length < 2) continue;
    enriched.sort((a, b) => a.startMs - b.startMs);
    const earlier = enriched[0];
    const later = enriched[1];
    if (seenMove.has(later.id)) continue;
    seenMove.add(later.id);

    const dur = Number.isFinite(later.finishMs) && later.finishMs > later.startMs
      ? later.finishMs - later.startMs
      : 60 * 60 * 1000;
    const newStartMs = (Number.isFinite(earlier.finishMs) ? earlier.finishMs : earlier.startMs) + BREAK_MS;
    const newFinishMs = newStartMs + dur;
    const proposedAnchorAt = new Date(newStartMs).toISOString();
    const proposedAnchorFinishAt = new Date(newFinishMs).toISOString();

    proposals.push({
      id: later.id,
      title: later.title,
      keepId: earlier.id,
      keepTitle: earlier.title,
      fromTime: formatRangeLabel(later.anchorAt, later.anchorFinishAt),
      toTime: formatRangeLabel(proposedAnchorAt, proposedAnchorFinishAt),
      proposedAnchorAt,
      proposedAnchorFinishAt,
      conflictGroupId: conflictGroupByDoc.get(later.id) || null,
    });
  }

  const occupiedCount = occupiedHours.length;
  const pendingCount = pendingBrief.length;
  const struckCount = occupiedHours.filter((r) => r.struck).length;
  const dayComplete = occupiedCount > 0 && pendingCount === 0;

  let lastFinishMs = NaN;
  let lastFinishIso = null;
  for (const row of occupiedRaw) {
    if (Number.isFinite(row.finishMs) && (!Number.isFinite(lastFinishMs) || row.finishMs > lastFinishMs)) {
      lastFinishMs = row.finishMs;
      lastFinishIso = row.finish;
    }
  }
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const hasRoomToday = occupiedCount > 0
    && !dayComplete
    && Number.isFinite(lastFinishMs)
    && lastFinishMs < endOfDay.getTime();
  const roomHint = hasRoomToday && lastFinishIso
    ? (now.getTime() < lastFinishMs
      ? null
      : `after:${formatClock(lastFinishIso)}`)
    : null;

  const hasConflicts = conflicts.length > 0;
  const isEmpty = occupiedCount === 0
    && pendingCount === 0
    && folderProgress.length === 0
    && !hasConflicts
    && !dayComplete;

  return {
    date,
    dateLabel: date,
    occupiedHours,
    pendingBrief,
    folderProgress,
    conflicts,
    proposals,
    conflictCount: conflicts.length,
    occupiedCount,
    pendingCount,
    struckCount,
    hasConflicts,
    hasRoomToday,
    roomHint,
    lastFinishAt: lastFinishIso,
    dayComplete,
    isEmpty,
    today,
  };
}

/**
 * Group folders that share the same completion percent.
 * @param {{ folder: string, percent: number }[]} folders
 * @returns {{ percent: number, names: string[] }[]}
 */
export function groupFoldersByPercent(folders = []) {
  /** @type {Map<number, string[]>} */
  const map = new Map();
  for (const f of folders) {
    if (!f?.folder) continue;
    const pct = Number.isFinite(f.percent) ? Math.round(f.percent) : 0;
    const list = map.get(pct) || [];
    list.push(f.folder);
    map.set(pct, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([percent, names]) => ({ percent, names }));
}

/**
 * Bubble copy for daily report — professional synthetic summary.
 * @param {{
 *   locale?: string,
 *   isEmpty?: boolean,
 *   dayComplete?: boolean,
 *   conflictCount?: number,
 *   occupiedCount?: number,
 *   pendingCount?: number,
 *   struckCount?: number,
 *   folderProgress?: { folder: string, percent: number }[],
 *   hasRoomToday?: boolean,
 *   lastFinishAt?: string | null,
 *   hasDetails?: boolean,
 * }} opts
 */
export function buildDailyReportOfferText(opts = {}) {
  const en = opts.locale === "en";
  if (opts.isEmpty) {
    return en
      ? "Nothing to report for today yet."
      : "Hoy no hay movimiento que reportar todavía.";
  }

  if (opts.dayComplete && !(opts.conflictCount > 0)) {
    return en
      ? "You closed every scheduled item for today — well done. That’s a full day."
      : "Completaste todas tus tareas programadas de hoy — excelente. Cerraste el día.";
  }

  const conflictN = opts.conflictCount || 0;
  if (conflictN > 0) {
    const details = opts.hasDetails !== false
      ? (en ? " Review the details below." : " Revisa los detalles a continuación.")
      : "";
    if (en) {
      return (
        `I found ${conflictN === 1 ? "one schedule collision" : `${conflictN} schedule collisions`} in today’s blocks. `
        + `They’re highlighted in the list. Want me to move them?${details}`
      );
    }
    return (
      `Identifiqué ${conflictN === 1 ? "una colisión de horario" : `${conflictN} colisiones de horario`} en los bloques de hoy. `
      + `Las marqué en la lista. ¿Quieres que las mueva?${details}`
    );
  }

  const occupied = opts.occupiedCount || 0;
  const struck = typeof opts.struckCount === "number"
    ? opts.struckCount
    : 0;
  const stillAhead = Math.max(0, occupied - struck);
  const pending = typeof opts.pendingCount === "number"
    ? opts.pendingCount
    : stillAhead;
  // In the summary line, "pendientes" = blocks still ahead on the clock (not yet vencidos).
  const pendingInSummary = stillAhead;
  const folders = Array.isArray(opts.folderProgress) ? opts.folderProgress : [];
  const groups = groupFoldersByPercent(folders);
  const lines = [];

  lines.push(en ? "Here’s the summary I prepared for today:" : "Te preparé el resumen de hoy:");

  if (occupied > 0) {
    if (en) {
      const parts = [`I reviewed today’s agenda — you have ${occupied} scheduled block${occupied === 1 ? "" : "s"}`];
      if (struck > 0) {
        parts.push(`${struck} ${struck === 1 ? "has" : "have"} already passed`);
      }
      if (pendingInSummary > 0) {
        parts.push(`${pendingInSummary} ${pendingInSummary === 1 ? "remains" : "remain"} pending`);
      }
      if (parts.length === 1) {
        lines.push(`${parts[0]}.`);
      } else if (parts.length === 2) {
        lines.push(`${parts[0]}, of which ${parts[1]}.`);
      } else {
        lines.push(`${parts[0]}, of which ${parts[1]} and ${parts[2]}.`);
      }
    } else {
      const parts = [`Revisé tu agenda — tienes ${occupied} bloque${occupied === 1 ? "" : "s"} programado${occupied === 1 ? "" : "s"}`];
      if (struck > 0) {
        parts.push(`${struck} ya ${struck === 1 ? "está vencido" : "están vencidos"}`);
      }
      if (pendingInSummary > 0) {
        parts.push(`${pendingInSummary} continúan pendiente${pendingInSummary === 1 ? "" : "s"}`);
      }
      if (parts.length === 1) {
        lines.push(`${parts[0]}.`);
      } else if (parts.length === 2) {
        lines.push(`${parts[0]}, de los cuales ${parts[1]}.`);
      } else {
        lines.push(`${parts[0]}, de los cuales ${parts[1]} y ${parts[2]}.`);
      }
    }
  } else if (pending > 0) {
    lines.push(en
      ? `I still see ${pending === 1 ? "1 pending item" : `${pending} pending items`} for today.`
      : `Todavía veo ${pending === 1 ? "1 pendiente" : `${pending} pendientes`} para hoy.`);
  }

  for (const g of groups) {
    const names = g.names.join(", ");
    if (g.names.length === 1) {
      lines.push(en
        ? `Associated project (${names}) stands at ${g.percent}% progress.`
        : `El proyecto asociado (${names}) registra ${g.percent}% de avance.`);
    } else {
      lines.push(en
        ? `Associated projects (${names}) stand at ${g.percent}% progress.`
        : `Los proyectos asociados (${names}) registran ${g.percent}% de avance.`);
    }
  }

  if (opts.hasRoomToday && opts.lastFinishAt) {
    const clock = formatClock(opts.lastFinishAt);
    lines.push(en
      ? `You still have room in your agenda after ${clock}.`
      : `Cuentas con espacio disponible en tu agenda después de las ${clock}.`);
  }

  const hasBody = occupied > 0 || pending > 0 || groups.length > 0 || (opts.hasRoomToday && opts.lastFinishAt);
  if (!hasBody) {
    return en
      ? "Nothing to report for today yet."
      : "Hoy no hay movimiento que reportar todavía.";
  }

  if (opts.hasDetails !== false) {
    lines.push(en
      ? "Review the details below:"
      : "Revisa los detalles a continuación:");
  }

  return lines.join(" ");
}

/**
 * @param {{ locale?: string, hasConflicts?: boolean, isEmpty?: boolean }} opts
 */
export function buildDailyReportChips(opts = {}) {
  const en = opts.locale === "en";
  /** @type {{ id: string, label: string, text: string, primary?: boolean }[]} */
  const chips = [];

  if (opts.isEmpty) {
    chips.push({
      id: "what_today",
      label: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
      primary: true,
    });
    return chips;
  }

  if (opts.hasConflicts) {
    chips.push({
      id: "move_conflicts",
      label: en ? "Move conflicting times" : "Mover horarios en conflicto",
      text: en
        ? "Move conflicting schedules for today"
        : "Mover horarios en conflicto de hoy",
      primary: true,
    });
    chips.push({
      id: "keep_conflicts",
      label: en ? "Leave them" : "Dejarlos así",
      text: en ? "Leave conflicting schedules as they are" : "Dejar horarios en conflicto así",
    });
  }
  chips.push({
    id: "today_schedule",
    label: en ? "Today's schedule" : "Horarios de hoy",
    text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
  });
  return chips;
}

/**
 * @param {{ locale?: string, count?: number }} opts
 */
export function buildDailyReportMovePreviewText(opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count || 0;
  return en
    ? `I’ll shift ${n} conflicting document(s) with a 5-minute break after the earlier block. Confirm the preview before updating.`
    : `Moveré ${n} documento(s) en conflicto dejando 5 min de break tras el bloque que empieza antes. Confirma la vista previa antes de actualizar.`;
}

/**
 * @param {{ locale?: string }} opts
 */
export function buildDailyReportMoveConfirmChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "confirm_move_conflicts",
      label: en ? "Confirm" : "Confirmar",
      text: en ? "Confirm move conflicting schedules" : "Confirmar mover horarios en conflicto",
      primary: true,
    },
    {
      id: "skip_move_conflicts",
      label: en ? "Skip" : "Saltarlo",
      text: en ? "Skip moving conflicting schedules" : "Saltar mover horarios en conflicto",
    },
  ];
}

export function buildDailyReportAppliedText(opts = {}) {
  const en = opts.locale === "en";
  const n = opts.count || 0;
  return en
    ? `Done — I moved ${n} conflicting schedule(s).`
    : `Listo — moví ${n} horario(s) en conflicto.`;
}

/**
 * @param {string} [locale]
 * @param {{ kind?: "conflict" | "celebrate" }} [opts]
 */
export function buildDailyReportPopoverCopy(locale = "es", opts = {}) {
  const en = locale === "en";
  if (opts.kind === "celebrate") {
    return {
      title: en
        ? "You wrapped today’s schedule. I’d love to congratulate you."
        : "Cerraste los schedules de hoy. Quiero felicitarte.",
      accept: en ? "Open chat" : "Abrir chat",
      decline: en ? "Check later" : "Verificar de luego",
    };
  }
  return {
    title: en
      ? "I found something in today’s schedules to show you."
      : "Tengo algo que enseñarte en los horarios de hoy.",
    accept: en ? "Open chat" : "Abrir chat",
    decline: en ? "Check later" : "Verificar de luego",
  };
}
