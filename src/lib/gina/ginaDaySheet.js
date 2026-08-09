/**
 * Day reference sheet helpers — rebuild live rows from anchored ids + status.
 */

import { DOC_WORK_STATUS } from "../docWorkStatus.js";
import { getDaySheet } from "./ginaDaySheetStore.js";
import { foldGinaText } from "./ginaTimeScope.js";

/**
 * Order live docs by anchored ids; drop missing; keep live status/schedule.
 * @param {object[]} liveDocs
 * @param {string[]} docIds
 * @returns {object[]}
 */
export function orderDocsByDaySheetIds(liveDocs, docIds) {
  const byId = new Map();
  for (const d of liveDocs || []) {
    if (d?.id) byId.set(String(d.id), d);
  }
  const ordered = [];
  for (const id of docIds || []) {
    const hit = byId.get(String(id));
    if (hit) ordered.push(hit);
  }
  return ordered;
}

/**
 * @param {object} doc
 * @returns {boolean}
 */
export function isDocCompleted(doc) {
  return doc?.status === DOC_WORK_STATUS.COMPLETED || doc?.completed === true;
}

/**
 * Next non-completed doc in sheet order (by list order, then anchorAt).
 * @param {object[]} docs
 * @returns {object | null}
 */
export function pickNextDaySheetDoc(docs) {
  const list = Array.isArray(docs) ? docs : [];
  for (const d of list) {
    if (!isDocCompleted(d)) return d;
  }
  return null;
}

/**
 * Fuzzy title match within sheet docs.
 * @param {object[]} docs
 * @param {string | null} titleHint
 * @returns {{ doc: object | null, ambiguous: object[] }}
 */
export function matchDocInDaySheet(docs, titleHint) {
  const list = Array.isArray(docs) ? docs : [];
  const needle = foldGinaText(titleHint || "");
  if (!needle) {
    const pending = list.filter((d) => !isDocCompleted(d));
    if (pending.length === 1) return { doc: pending[0], ambiguous: [] };
    if (pending.length > 1) return { doc: null, ambiguous: pending.slice(0, 5) };
    return { doc: null, ambiguous: [] };
  }
  const scored = [];
  for (const d of list) {
    const title = foldGinaText(d.title || d.name || "");
    if (!title) continue;
    if (title === needle) scored.push({ d, score: 100 });
    else if (title.includes(needle) || needle.includes(title)) scored.push({ d, score: 80 });
    else {
      const words = needle.split(/\s+/).filter((w) => w.length > 2);
      const hits = words.filter((w) => title.includes(w)).length;
      if (hits > 0 && hits >= Math.ceil(words.length / 2)) {
        scored.push({ d, score: 40 + hits * 10 });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return { doc: null, ambiguous: [] };
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { doc: null, ambiguous: scored.slice(0, 5).map((s) => s.d) };
  }
  return { doc: scored[0].d, ambiguous: [] };
}

/**
 * Progress counts for copy.
 * @param {object[]} docs
 */
export function summarizeDaySheetProgress(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const total = list.length;
  const completed = list.filter(isDocCompleted).length;
  const remaining = total - completed;
  return { total, completed, remaining };
}

/**
 * @param {{ data?: object } | null | undefined} visualization
 * @returns {object[]}
 */
export function flattenDaySheetDocs(visualization) {
  const data = visualization?.data || {};
  if (Array.isArray(data.documents) && data.documents.length) return data.documents;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const out = [];
  for (const group of groups) {
    for (const folder of group.folders || []) {
      for (const doc of folder.documents || []) out.push(doc);
    }
  }
  return out;
}

/**
 * Toggle pending checkbox selection (no status mutation).
 * Completed docs stay locked and are never added to pending.
 * @param {{ type?: string, data?: object } | null | undefined} visualization
 * @param {string} docId
 * @param {boolean} selected
 * @returns {{ type?: string, data?: object } | null | undefined}
 */
export function togglePendingDaySheetSelection(visualization, docId, selected) {
  if (!visualization?.data || !docId) return visualization;
  const id = String(docId);
  const docs = flattenDaySheetDocs(visualization);
  const target = docs.find((d) => String(d?.id) === id);
  if (!target || isDocCompleted(target)) return visualization;

  const prev = Array.isArray(visualization.data.pendingSelectedIds)
    ? visualization.data.pendingSelectedIds.map(String)
    : [];
  let next;
  if (selected) {
    next = prev.includes(id) ? prev : [...prev, id];
  } else {
    next = prev.filter((x) => x !== id);
  }

  return {
    ...visualization,
    data: {
      ...visualization.data,
      pendingSelectedIds: next,
    },
  };
}

/**
 * Clear pending checkbox selection.
 * @param {{ type?: string, data?: object } | null | undefined} visualization
 */
export function clearPendingDaySheetSelection(visualization) {
  if (!visualization?.data) return visualization;
  return {
    ...visualization,
    data: {
      ...visualization.data,
      pendingSelectedIds: [],
    },
  };
}

/**
 * Apply completed to many docs in the viz + clear pending selection.
 * @param {{ type?: string, data?: object } | null | undefined} visualization
 * @param {string[]} docIds
 */
export function applyDaySheetCompletionBatch(visualization, docIds) {
  if (!visualization?.data) return visualization;
  const ids = new Set((docIds || []).map(String).filter(Boolean));
  if (!ids.size) {
    return clearPendingDaySheetSelection(visualization);
  }

  const patchDoc = (doc) => {
    if (!doc || !ids.has(String(doc.id))) return doc;
    return {
      ...doc,
      status: DOC_WORK_STATUS.COMPLETED,
      completed: true,
      struck: true,
    };
  };

  const documents = Array.isArray(visualization.data.documents)
    ? visualization.data.documents.map(patchDoc)
    : visualization.data.documents;

  const groups = Array.isArray(visualization.data.groups)
    ? visualization.data.groups.map((group) => ({
      ...group,
      folders: (group.folders || []).map((folder) => ({
        ...folder,
        documents: (folder.documents || []).map(patchDoc),
      })),
    }))
    : visualization.data.groups;

  const progressSource = Array.isArray(documents) && documents.length
    ? documents
    : (Array.isArray(groups)
      ? groups.flatMap((g) => (g.folders || []).flatMap((f) => f.documents || []))
      : []);
  const progress = summarizeDaySheetProgress(progressSource);
  const nextDocument = pickNextDaySheetDoc(progressSource);

  return {
    ...visualization,
    data: {
      ...visualization.data,
      documents,
      groups,
      progress,
      nextDocumentId: nextDocument?.id || null,
      pendingSelectedIds: [],
    },
  };
}

/**
 * Ack copy after batch complete.
 * @param {{ count: number, nextTitle?: string | null, locale?: string }} opts
 */
export function buildDaySheetBatchCompleteAck(opts = {}) {
  const en = opts.locale === "en";
  const n = Math.max(0, Number(opts.count) || 0);
  const nextTitle = String(opts.nextTitle || "").trim();
  const noun = en
    ? (n === 1 ? "document" : "documents")
    : (n === 1 ? "Documento" : "Documentos");
  const line1 = en
    ? `Done! We checked off **${n}** ${noun}.`
    : `¡Listo! Tachamos **${n}** ${noun}.`;
  if (!nextTitle) {
    const empty = en
      ? "Nothing left pending on today’s schedule."
      : "No queda nada pendiente en el horario del día.";
    return `${line1}\n${empty}`;
  }
  const line2 = en
    ? `You still have **${nextTitle}** pending. Want to keep going, or leave it for later?`
    : `Aún tienes pendiente **${nextTitle}**. ¿Quieres seguir avanzando o lo dejamos para más tarde?`;
  return `${line1}\n${line2}`;
}

/**
 * Action chips while pending selection is non-empty (in-doc only).
 * @param {{ locale?: string }} [opts]
 */
export function buildDaySheetPendingActionChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "day_sheet_apply_complete",
      label: en ? "Mark as completed" : "Marcar como completado",
      text: "GinaDaySheetApplyComplete",
      primary: true,
    },
    {
      id: "day_sheet_discard_selection",
      label: en ? "Discard" : "Descartar",
      text: "GinaDaySheetDiscardSelection",
    },
  ];
}

/**
 * Patch an in-chat day-sheet visualization after a committed completion flip.
 * @param {{ type?: string, data?: object } | null | undefined} visualization
 * @param {string} docId
 * @param {boolean} nextCompleted
 * @returns {{ type?: string, data?: object } | null | undefined}
 */
export function patchDaySheetVisualizationCompletion(visualization, docId, nextCompleted) {
  if (!visualization?.data || !docId) return visualization;
  const id = String(docId);
  const completed = Boolean(nextCompleted);
  const status = completed ? DOC_WORK_STATUS.COMPLETED : DOC_WORK_STATUS.NOT_STARTED;

  const patchDoc = (doc) => {
    if (!doc || String(doc.id) !== id) return doc;
    return {
      ...doc,
      status,
      completed,
      struck: completed,
    };
  };

  const documents = Array.isArray(visualization.data.documents)
    ? visualization.data.documents.map(patchDoc)
    : visualization.data.documents;

  const groups = Array.isArray(visualization.data.groups)
    ? visualization.data.groups.map((group) => ({
      ...group,
      folders: (group.folders || []).map((folder) => ({
        ...folder,
        documents: (folder.documents || []).map(patchDoc),
      })),
    }))
    : visualization.data.groups;

  const progressSource = Array.isArray(documents) && documents.length
    ? documents
    : (Array.isArray(groups)
      ? groups.flatMap((g) => (g.folders || []).flatMap((f) => f.documents || []))
      : []);
  const progress = summarizeDaySheetProgress(progressSource);
  const nextDocument = pickNextDaySheetDoc(progressSource);

  return {
    ...visualization,
    data: {
      ...visualization.data,
      documents,
      groups,
      progress,
      nextDocumentId: nextDocument?.id || null,
      pendingSelectedIds: Array.isArray(visualization.data.pendingSelectedIds)
        ? visualization.data.pendingSelectedIds.filter((x) => String(x) !== id)
        : [],
    },
  };
}

/**
 * @param {string} userId
 * @param {object[]} liveTodayDocs - from get_today_scope includeCompleted
 * @param {Date} [now]
 */
export function resolveAnchoredDaySheetDocs(userId, liveTodayDocs, now = new Date()) {
  const sheet = getDaySheet(userId, now);
  if (!sheet) return { sheet: null, documents: [] };
  return {
    sheet,
    documents: orderDocsByDaySheetIds(liveTodayDocs, sheet.docIds),
  };
}
