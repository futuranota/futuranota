/**
 * Gina Fase 1 — read-only scope tools (company-wide).
 * Pure functions over a snapshot context (docs/nodes/departments).
 */

import { resolveFolderStatus } from "../folderStatus.js";
import { resolveDocWorkStatus, DOC_WORK_STATUS } from "../docWorkStatus.js";
import { findDepartmentById } from "../departments.js";

/**
 * @typedef {{
 *   docs?: Record<string, object> | object[],
 *   nodes?: Record<string, object> | object[],
 *   departments?: object[] | Record<string, object>,
 *   objectId?: string | null,
 *   now?: Date | string | number,
 * }} GinaToolsContext
 */

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : Object.values(value);
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(d) {
  const x = toDate(d);
  if (!x) return null;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a, b) {
  return dayKey(a) && dayKey(a) === dayKey(b);
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isFolderDoc(doc) {
  if (!doc) return false;
  // Campaign/folder docs live in docsStore; child work units are nodes.
  return Boolean(doc.id) && !doc.parentDocId;
}

function filterFoldersForObject(docs, objectId) {
  return asList(docs).filter((doc) => {
    if (!doc?.id) return false;
    if (objectId && doc.parentObjectId && doc.parentObjectId !== objectId) return false;
    return true;
  });
}

function filterNodesForObject(nodes, docs, objectId) {
  const folderIds = new Set(filterFoldersForObject(docs, objectId).map((d) => d.id));
  return asList(nodes).filter((n) => {
    if (!n?.id) return false;
    if (!n.parentDocId) return false;
    if (objectId && n.objectId && n.objectId !== objectId) {
      // also allow via parent folder membership
      if (!folderIds.has(n.parentDocId)) return false;
    } else if (objectId && !n.objectId && !folderIds.has(n.parentDocId)) {
      return false;
    }
    return folderIds.has(n.parentDocId) || !objectId;
  });
}

function deptMap(departments) {
  const list = asList(departments);
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const d of list) {
    if (d?.id) map.set(d.id, d);
  }
  return map;
}

function folderTitle(doc) {
  return String(doc?.title || doc?.name || "Untitled").trim();
}

function nodeTitle(node) {
  return String(node?.title || node?.name || "Untitled").trim();
}

function isInsideFrame(folder, anchorAt) {
  const start = toDate(folder?.scheduleStartAt);
  const finish = toDate(folder?.scheduleFinishAt);
  const at = toDate(anchorAt);
  if (!start || !finish || !at) return false;
  const day = startOfDay(at).getTime();
  return day >= startOfDay(start).getTime() && day <= startOfDay(finish).getTime();
}

function enrichDocument(node, folder, departments, now) {
  const status = resolveDocWorkStatus(node);
  const anchorAt = node.anchorAt || null;
  const anchorFinishAt = node.anchorFinishAt || null;
  const at = toDate(anchorAt);
  const today = startOfDay(now);
  const isPastDue = status === DOC_WORK_STATUS.PAST_DUE
    || (
      status !== DOC_WORK_STATUS.COMPLETED
      && status !== DOC_WORK_STATUS.RESERVED
      && at
      && startOfDay(at).getTime() < today.getTime()
      && status === DOC_WORK_STATUS.IN_PROGRESS
    );
  const dept = folder?.departmentId
    ? findDepartmentById(departments, folder.departmentId)
    : null;
  return {
    id: node.id,
    title: nodeTitle(node),
    parentFolderId: node.parentDocId || null,
    parentFolderName: folder ? folderTitle(folder) : null,
    departmentId: folder?.departmentId || null,
    departmentName: dept?.category || null,
    category: folder?.category || null,
    anchorAt,
    anchorFinishAt,
    status,
    completed: status === DOC_WORK_STATUS.COMPLETED,
    isInsideFrame: folder ? isInsideFrame(folder, anchorAt) : false,
    isPastDue: Boolean(isPastDue) || status === DOC_WORK_STATUS.PAST_DUE,
    isToday: at ? sameDay(at, now) : false,
  };
}

function buildDocIndex(ctx) {
  const now = toDate(ctx.now) || new Date();
  const departments = asList(ctx.departments);
  const folders = filterFoldersForObject(ctx.docs, ctx.objectId);
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const nodes = filterNodesForObject(ctx.nodes, ctx.docs, ctx.objectId);
  const documents = nodes.map((n) => enrichDocument(n, folderById.get(n.parentDocId), departments, now));
  return { now, departments, folders, folderById, documents };
}

/** TOOL 1 */
export function get_all_company_folders(ctx = {}) {
  const { folders, documents, now } = buildDocIndex(ctx);
  const depts = asList(ctx.departments);
  return folders.map((folder) => {
    const kids = documents.filter((d) => d.parentFolderId === folder.id);
    const st = resolveFolderStatus(ctx.nodes, folder.id);
    const dept = folder.departmentId ? findDepartmentById(depts, folder.departmentId) : null;
    return {
      id: folder.id,
      name: folderTitle(folder),
      departmentId: folder.departmentId || null,
      departmentName: dept?.category || null,
      category: folder.category || null,
      scheduleStartAt: folder.scheduleStartAt || null,
      scheduleFinishAt: folder.scheduleFinishAt || null,
      hasSchedule: Boolean(folder.scheduleStartAt && folder.scheduleFinishAt),
      folderStatus: st.status,
      childDocuments: kids.length,
      childCompleted: kids.filter((k) => k.completed).length,
      asOf: dayKey(now),
    };
  });
}

/** TOOL 2 */
export function get_all_company_documents(ctx = {}) {
  return buildDocIndex(ctx).documents;
}

/** TOOL 3 */
export function get_documents_by_date_range(ctx = {}, startDate, endDate) {
  const { documents, now } = buildDocIndex(ctx);
  const start = startOfDay(toDate(startDate) || now);
  const end = startOfDay(toDate(endDate) || start);
  const inRange = documents.filter((d) => {
    const at = toDate(d.anchorAt);
    if (!at) return false;
    const day = startOfDay(at).getTime();
    return day >= start.getTime() && day <= end.getTime();
  });
  const tomorrow = addDays(startOfDay(now), 1);
  return {
    range: `${dayKey(start)} - ${dayKey(end)}`,
    totalDocuments: inRange.length,
    breakdown: {
      today: inRange.filter((d) => sameDay(d.anchorAt, now)).length,
      tomorrow: inRange.filter((d) => sameDay(d.anchorAt, tomorrow)).length,
      laterThisWeek: inRange.filter((d) => {
        const at = toDate(d.anchorAt);
        if (!at) return false;
        return startOfDay(at).getTime() > tomorrow.getTime();
      }).length,
    },
    documents: inRange.map((d) => ({
      date: dayKey(d.anchorAt),
      id: d.id,
      title: d.title,
      status: d.status,
      folder: d.parentFolderName,
      department: d.departmentName,
      category: d.category,
    })),
  };
}

/** TOOL 4 */
export function get_incomplete_documents(ctx = {}) {
  const { documents, now } = buildDocIndex(ctx);
  const incomplete = documents.filter((d) => d.status !== DOC_WORK_STATUS.COMPLETED);
  const pastDue = [];
  const upcoming = [];
  const reserved = [];
  for (const d of incomplete) {
    if (d.status === DOC_WORK_STATUS.RESERVED) {
      reserved.push(d);
      continue;
    }
    if (d.isPastDue || d.status === DOC_WORK_STATUS.PAST_DUE) {
      const at = toDate(d.anchorAt);
      const daysOverdue = at
        ? Math.max(0, Math.round((startOfDay(now) - startOfDay(at)) / 86400000))
        : 0;
      pastDue.push({
        id: d.id,
        title: d.title,
        folder: d.parentFolderName,
        dueDate: dayKey(d.anchorAt),
        daysOverdue,
        status: d.status,
      });
      continue;
    }
    const at = toDate(d.anchorAt);
    const daysUntilDue = at
      ? Math.round((startOfDay(at) - startOfDay(now)) / 86400000)
      : null;
    upcoming.push({
      id: d.id,
      title: d.title,
      folder: d.parentFolderName,
      dueDate: dayKey(d.anchorAt),
      daysUntilDue,
      status: d.status,
    });
  }
  return { pastDue, upcoming, reserved: reserved.map((d) => ({
    id: d.id,
    title: d.title,
    folder: d.parentFolderName,
    dueDate: dayKey(d.anchorAt),
    status: d.status,
  })) };
}

/** TOOL 5 */
export function get_documents_by_status(ctx = {}, status) {
  const want = String(status || "").trim().toLowerCase();
  const { documents } = buildDocIndex(ctx);
  const list = documents.filter((d) => String(d.status || "") === want);
  return {
    status: want,
    total: list.length,
    documents: list.map((d) => ({
      id: d.id,
      title: d.title,
      folder: d.parentFolderName,
      department: d.departmentName,
      category: d.category,
      startedAt: d.anchorAt,
      dueAt: d.anchorFinishAt,
    })),
  };
}

/** TOOL 6 */
export function get_folder_children_summary(ctx = {}, folderId) {
  const { folders, documents, now } = buildDocIndex(ctx);
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) {
    return { error: "folder_not_found", folderId };
  }
  const kids = documents.filter((d) => d.parentFolderId === folder.id);
  const finish = toDate(folder.scheduleFinishAt);
  const daysRemaining = finish
    ? Math.round((startOfDay(finish) - startOfDay(now)) / 86400000)
    : null;
  const aggregated = {
    total: kids.length,
    completed: kids.filter((k) => k.status === DOC_WORK_STATUS.COMPLETED).length,
    inProgress: kids.filter((k) => k.status === DOC_WORK_STATUS.IN_PROGRESS).length,
    notStarted: kids.filter((k) => k.status === DOC_WORK_STATUS.NOT_STARTED || k.status == null).length,
    pastDue: kids.filter((k) => k.isPastDue || k.status === DOC_WORK_STATUS.PAST_DUE).length,
    reserved: kids.filter((k) => k.status === DOC_WORK_STATUS.RESERVED).length,
    submitted: kids.filter((k) => k.status === DOC_WORK_STATUS.SUBMITTED).length,
  };
  return {
    folderId: folder.id,
    folderName: folderTitle(folder),
    departmentId: folder.departmentId || null,
    category: folder.category || null,
    hasSchedule: Boolean(folder.scheduleStartAt && folder.scheduleFinishAt),
    schedule: {
      start: dayKey(folder.scheduleStartAt),
      finish: dayKey(folder.scheduleFinishAt),
      daysRemaining,
    },
    documents: kids.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      dueDate: dayKey(d.anchorAt),
      isPastDue: d.isPastDue,
    })),
    aggregated,
  };
}

/** TOOL 7 */
export function get_today_scope(ctx = {}) {
  const { documents, now } = buildDocIndex(ctx);
  const todayDocs = documents.filter((d) => d.isToday);
  const byStatus = {
    notStarted: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.NOT_STARTED || d.status == null).length,
    inProgress: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.IN_PROGRESS).length,
    submitted: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.SUBMITTED).length,
    pastDue: todayDocs.filter((d) => d.isPastDue || d.status === DOC_WORK_STATUS.PAST_DUE).length,
    completed: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.COMPLETED).length,
  };
  /** @type {Map<string, { folder: string, documents: number, statuses: string[] }>} */
  const folderMap = new Map();
  for (const d of todayDocs) {
    const key = d.parentFolderName || "—";
    const cur = folderMap.get(key) || { folder: key, documents: 0, statuses: [] };
    cur.documents += 1;
    if (d.status) cur.statuses.push(d.status);
    folderMap.set(key, cur);
  }
  let nextDeadline = null;
  const timed = todayDocs
    .filter((d) => d.anchorFinishAt)
    .slice()
    .sort((a, b) => String(a.anchorFinishAt).localeCompare(String(b.anchorFinishAt)));
  if (timed[0]) {
    nextDeadline = {
      id: timed[0].id,
      title: timed[0].title,
      folder: timed[0].parentFolderName,
      time: timed[0].anchorFinishAt,
    };
  }
  return {
    date: dayKey(now),
    totalDocumentsToday: todayDocs.length,
    breakdown: byStatus,
    byFolder: [...folderMap.values()].map((f) => ({
      folder: f.folder,
      documents: f.documents,
      status: f.statuses[0] || null,
    })),
    documents: todayDocs,
    nextDeadline,
  };
}

function weekBounds(now, weekOffset = 0) {
  const base = startOfDay(now);
  const day = base.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(base, mondayOffset + weekOffset * 7);
  const sunday = addDays(monday, 6);
  return { monday, sunday };
}

/** TOOL 8 */
export function get_week_scope(ctx = {}, weekOffset = 0) {
  const { now } = buildDocIndex(ctx);
  const { monday, sunday } = weekBounds(now, Number(weekOffset) || 0);
  const range = get_documents_by_date_range(ctx, dayKey(monday), dayKey(sunday));
  const byDay = {};
  for (const d of range.documents) {
    const key = d.date || "unknown";
    if (!byDay[key]) byDay[key] = { count: 0, statuses: [] };
    byDay[key].count += 1;
    if (d.status) byDay[key].statuses.push(d.status);
  }
  const byFolderMap = new Map();
  for (const d of range.documents) {
    const f = d.folder || "—";
    byFolderMap.set(f, (byFolderMap.get(f) || 0) + 1);
  }
  const incomplete = get_incomplete_documents(ctx);
  return {
    week: range.range,
    weekOffset: Number(weekOffset) || 0,
    totalDocuments: range.totalDocuments,
    byDay,
    byFolder: [...byFolderMap.entries()].map(([folder, documents]) => ({ folder, documents })),
    pastDueFromLastWeek: incomplete.pastDue.length,
    documents: range.documents,
  };
}

/** TOOL 9 — product past_due status primarily */
export function get_past_due_documents(ctx = {}) {
  const { documents, now } = buildDocIndex(ctx);
  const list = documents.filter(
    (d) => d.status === DOC_WORK_STATUS.PAST_DUE || d.isPastDue,
  );
  return {
    totalPastDue: list.length,
    documents: list.map((d) => {
      const at = toDate(d.anchorAt);
      const daysOverdue = at
        ? Math.max(0, Math.round((startOfDay(now) - startOfDay(at)) / 86400000))
        : 0;
      return {
        id: d.id,
        title: d.title,
        folder: d.parentFolderName,
        department: d.departmentName,
        category: d.category,
        dueDate: dayKey(d.anchorAt),
        daysOverdue,
        status: d.status,
      };
    }),
  };
}

function intervalsOverlap(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

/** TOOL 10 */
export function get_schedule_conflicts(ctx = {}) {
  const { documents } = buildDocIndex(ctx);
  const timed = documents.filter((d) => d.anchorAt && d.anchorFinishAt);
  /** @type {object[]} */
  const conflicts = [];
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const a = timed[i];
      const b = timed[j];
      if (!sameDay(a.anchorAt, b.anchorAt)) continue;
      const a0 = toDate(a.anchorAt).getTime();
      const a1 = toDate(a.anchorFinishAt).getTime();
      const b0 = toDate(b.anchorAt).getTime();
      const b1 = toDate(b.anchorFinishAt).getTime();
      if (!intervalsOverlap(a0, a1, b0, b1)) continue;
      const overlapStart = new Date(Math.max(a0, b0));
      const overlapEnd = new Date(Math.min(a1, b1));
      conflicts.push({
        date: dayKey(a.anchorAt),
        documents: [
          { id: a.id, title: a.title, time: `${a.anchorAt} - ${a.anchorFinishAt}`, folder: a.parentFolderName },
          { id: b.id, title: b.title, time: `${b.anchorAt} - ${b.anchorFinishAt}`, folder: b.parentFolderName },
        ],
        overlapTime: `${overlapStart.toISOString()} - ${overlapEnd.toISOString()}`,
        severity: "medium",
      });
    }
  }
  return { conflicts };
}

/** TOOL 11 */
export function get_document_detail(ctx = {}, documentId) {
  const { documents, folderById, departments } = buildDocIndex(ctx);
  const doc = documents.find((d) => d.id === documentId);
  if (!doc) return { error: "document_not_found", documentId };
  const folder = folderById.get(doc.parentFolderId);
  const raw = asList(ctx.nodes).find((n) => n.id === documentId);
  const body = String(raw?.content || raw?.body || "").slice(0, 800);
  const todos = Array.isArray(raw?.todos) ? raw.todos : [];
  const dept = folder?.departmentId ? findDepartmentById(departments, folder.departmentId) : null;
  return {
    id: doc.id,
    title: doc.title,
    folder: folder
      ? {
        id: folder.id,
        name: folderTitle(folder),
        hasSchedule: Boolean(folder.scheduleStartAt && folder.scheduleFinishAt),
        frameStart: dayKey(folder.scheduleStartAt),
        frameFinish: dayKey(folder.scheduleFinishAt),
        department: dept?.category || null,
        category: folder.category || null,
      }
      : null,
    schedule: {
      date: dayKey(doc.anchorAt),
      startTime: doc.anchorAt,
      finishTime: doc.anchorFinishAt,
      isToday: doc.isToday,
      isPastDue: doc.isPastDue,
      isInsideFrame: doc.isInsideFrame,
    },
    status: doc.status,
    completed: doc.completed,
    body,
    todos,
  };
}

/** TOOL 12 */
export function get_gina_scope(ctx = {}, timeframe = "today") {
  const tf = String(timeframe || "today").toLowerCase();
  let core;
  if (tf === "tomorrow") {
    const { now } = buildDocIndex(ctx);
    const t = addDays(startOfDay(now), 1);
    core = get_documents_by_date_range(ctx, dayKey(t), dayKey(t));
  } else if (tf === "this_week" || tf === "week") {
    core = get_week_scope(ctx, 0);
  } else if (tf === "next_week") {
    core = get_week_scope(ctx, 1);
  } else if (tf === "all") {
    core = {
      folders: get_all_company_folders(ctx),
      incomplete: get_incomplete_documents(ctx),
      today: get_today_scope(ctx),
      conflicts: get_schedule_conflicts(ctx),
    };
  } else {
    core = get_today_scope(ctx);
  }
  const pastDue = get_past_due_documents(ctx);
  const conflicts = get_schedule_conflicts(ctx);
  const recommendations = [];
  if (pastDue.totalPastDue > 0) {
    recommendations.push(`Prioriza ${pastDue.totalPastDue} documento(s) past due antes de empezar nuevos.`);
  }
  if (conflicts.conflicts?.length) {
    recommendations.push(`Hay ${conflicts.conflicts.length} solape(s) de horario — ¿los revisamos?`);
  }
  return {
    scope: tf,
    summary: `Scope ${tf}`,
    analysis: {
      pastDue: pastDue.totalPastDue,
      conflicts: conflicts.conflicts?.length || 0,
      priority: pastDue.totalPastDue > 0 ? "HIGH" : "NORMAL",
    },
    recommendations,
    data: core,
  };
}

export function findFolderIdByName(ctx, nameQuery) {
  const q = fold(nameQuery);
  if (!q) return null;
  const folders = get_all_company_folders(ctx);
  const hit = folders.find((f) => fold(f.name).includes(q) || q.includes(fold(f.name)));
  return hit?.id || null;
}

export function filterDocumentsByDepartmentAndCategory(ctx, departmentQuery, categoryQuery) {
  const docs = get_all_company_documents(ctx);
  const dq = fold(departmentQuery);
  const cq = fold(categoryQuery);
  return docs.filter((d) => {
    const okDept = !dq || fold(d.departmentName).includes(dq) || fold(d.parentFolderName).includes(dq);
    const okCat = !cq || fold(d.category).includes(cq) || fold(d.parentFolderName).includes(cq) || fold(d.title).includes(cq);
    return okDept && okCat;
  });
}

export const GINA_TOOLS = {
  get_all_company_folders,
  get_all_company_documents,
  get_documents_by_date_range,
  get_incomplete_documents,
  get_documents_by_status,
  get_folder_children_summary,
  get_today_scope,
  get_week_scope,
  get_past_due_documents,
  get_schedule_conflicts,
  get_document_detail,
  get_gina_scope,
};
