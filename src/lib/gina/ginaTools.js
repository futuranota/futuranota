/**
 * Gina Fase 1 — read-only scope tools (company-wide).
 * Pure functions over a snapshot context (docs/nodes/departments).
 */

import { resolveFolderStatus } from "../folderStatus.js";
import { resolveDocWorkStatus, DOC_WORK_STATUS } from "../docWorkStatus.js";
import { findDepartmentById } from "../departments.js";
import {
  buildPassedSlotSignals,
  mapPassedSlotRows,
} from "./ginaScheduleRecovery.js";
import {
  nearMatchToken,
  textHasNearPhrase,
  tokenizeGinaText,
} from "./ginaFuzzyMatch.js";
import { ginaWeekBounds } from "./ginaTimeScope.js";

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
    // Independent / # Department inbox — corpus-scoped, no folder yet
    if (!n.parentDocId) {
      if (!objectId) return true;
      return n.objectId === objectId;
    }
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
  const independent = !node.parentDocId;
  return {
    id: node.id,
    title: nodeTitle(node),
    parentFolderId: node.parentDocId || null,
    parentFolderName: folder ? folderTitle(folder) : null,
    departmentId: folder?.departmentId || null,
    departmentName: dept?.category || (independent ? "# Department" : null),
    category: folder?.category || null,
    independent,
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

/** TOOL 3 — date range; by default exclude completed */
export function get_documents_by_date_range(ctx = {}, startDate, endDate, opts = {}) {
  const { documents, now } = buildDocIndex(ctx);
  const start = startOfDay(toDate(startDate) || now);
  const end = startOfDay(toDate(endDate) || start);
  const excludeCompleted = opts.excludeCompleted !== false;
  const deptFilter = fold(opts.department || "");
  const folderFilter = fold(opts.folder || "");
  const categoryFilter = fold(opts.category || "");

  const inRange = documents.filter((d) => {
    if (excludeCompleted && (d.status === DOC_WORK_STATUS.COMPLETED || d.completed)) return false;
    if (deptFilter && !fold(d.departmentName).includes(deptFilter)) return false;
    if (categoryFilter && !fold(d.category).includes(categoryFilter)) return false;
    if (folderFilter && !fold(d.parentFolderName).includes(folderFilter)) return false;
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
      anchorAt: d.anchorAt,
      anchorFinishAt: d.anchorFinishAt,
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
        department: d.departmentName,
        category: d.category,
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
      department: d.departmentName,
      category: d.category,
      dueDate: dayKey(d.anchorAt),
      daysUntilDue,
      status: d.status,
    });
  }
  return { pastDue, upcoming, reserved: reserved.map((d) => ({
    id: d.id,
    title: d.title,
    folder: d.parentFolderName,
    department: d.departmentName,
    category: d.category,
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
    departmentName: (() => {
      const dept = folder.departmentId
        ? findDepartmentById(asList(ctx.departments), folder.departmentId)
        : null;
      return dept?.category || null;
    })(),
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

/** TOOL 7 — hoy: solo documents cuyo `anchorAt` cae en el día calendario de `now`.
 * No usa la ventana multi-día del folder. Bloques ya terminados hoy SÍ entran (Gina los señalará después).
 * Completed excluded unless includeCompleted.
 */
export function get_today_scope(ctx = {}, filters = {}) {
  const { documents, folderById, now } = buildDocIndex(ctx);
  const deptFilter = fold(filters.department || "");
  const folderFilter = fold(filters.folder || "");
  const categoryFilter = fold(filters.category || "");
  const statusFilter = fold(filters.status || "");
  const includeCompleted = Boolean(filters.includeCompleted);

  const isTodayScoped = (d) => {
    const at = toDate(d.anchorAt);
    return Boolean(at && sameDay(at, now));
  };

  let todayDocs = documents.filter((d) => {
    const isCompleted = d.status === DOC_WORK_STATUS.COMPLETED || d.completed;
    if (isCompleted && !includeCompleted) return false;

    if (deptFilter && !fold(d.departmentName).includes(deptFilter)) return false;
    if (categoryFilter && !fold(d.category).includes(categoryFilter)) return false;
    if (folderFilter && !fold(d.parentFolderName).includes(folderFilter)) return false;

    return isTodayScoped(d);
  });

  if (statusFilter) {
    todayDocs = todayDocs.filter((d) => {
      if (statusFilter === "past_due" || statusFilter === "vencid") {
        return d.isPastDue || d.status === DOC_WORK_STATUS.PAST_DUE;
      }
      if (statusFilter === "not_started" || statusFilter === "sin empezar") {
        return d.status === DOC_WORK_STATUS.NOT_STARTED || d.status == null;
      }
      if (statusFilter === "completed") {
        return d.status === DOC_WORK_STATUS.COMPLETED || d.completed;
      }
      return fold(d.status) === statusFilter;
    });
  }

  const byStatus = {
    notStarted: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.NOT_STARTED || d.status == null).length,
    inProgress: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.IN_PROGRESS).length,
    submitted: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.SUBMITTED).length,
    pastDue: todayDocs.filter((d) => d.isPastDue || d.status === DOC_WORK_STATUS.PAST_DUE).length,
    completed: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.COMPLETED || d.completed).length,
    reserved: todayDocs.filter((d) => d.status === DOC_WORK_STATUS.RESERVED).length,
  };

  const byStatusCounts = [
    { key: "past_due", count: byStatus.pastDue },
    { key: "in_progress", count: byStatus.inProgress },
    { key: "not_started", count: byStatus.notStarted },
    { key: "reserved", count: byStatus.reserved },
    { key: "submitted", count: byStatus.submitted },
    { key: "completed", count: byStatus.completed },
  ].filter((row) => row.count > 0);

  /** @type {Map<string, object>} */
  const groupMap = new Map();
  for (const d of todayDocs) {
    const key = `${d.departmentName || "—"}|${d.category || "—"}|${d.parentFolderName || "—"}`;
    const cur = groupMap.get(key) || {
      department: d.departmentName || null,
      category: d.category || null,
      folder: d.parentFolderName || null,
      folderId: d.parentFolderId || null,
      documents: 0,
      statuses: [],
    };
    cur.documents += 1;
    if (d.status) cur.statuses.push(d.status);
    groupMap.set(key, cur);
  }

  /** @type {Map<string, { name: string, documents: number, folderIds: Set<string> }>} */
  const categoryMap = new Map();
  for (const d of todayDocs) {
    const name = String(d.category || "—").trim() || "—";
    const cur = categoryMap.get(name) || { name, documents: 0, folderIds: new Set() };
    cur.documents += 1;
    if (d.parentFolderId) cur.folderIds.add(String(d.parentFolderId));
    else if (d.parentFolderName) cur.folderIds.add(String(d.parentFolderName));
    categoryMap.set(name, cur);
  }
  const byCategory = [...categoryMap.values()]
    .map((c) => ({ name: c.name, documents: c.documents, folders: c.folderIds.size }))
    .sort((a, b) => b.documents - a.documents);

  /** @type {Map<string, { id: string | null, name: string, category: string | null, documents: number }>} */
  const folderRollup = new Map();
  for (const d of todayDocs) {
    const name = String(d.parentFolderName || "—").trim() || "—";
    const id = d.parentFolderId || null;
    const key = id || name;
    const cur = folderRollup.get(key) || {
      id,
      name,
      category: d.category || null,
      documents: 0,
    };
    cur.documents += 1;
    folderRollup.set(key, cur);
  }
  const byFolderList = [...folderRollup.values()].sort((a, b) => b.documents - a.documents);

  let nextDeadline = null;
  const timed = todayDocs
    .filter((d) => d.anchorAt && !(d.status === DOC_WORK_STATUS.COMPLETED || d.completed))
    .slice()
    .sort((a, b) => String(a.anchorAt).localeCompare(String(b.anchorAt)));
  if (timed[0]) {
    nextDeadline = {
      id: timed[0].id,
      title: timed[0].title,
      folder: timed[0].parentFolderName,
      department: timed[0].departmentName,
      category: timed[0].category,
      time: timed[0].anchorAt,
    };
  }

  /** Folders that actually have today-scoped docs (not multi-day folder window alone). */
  const activeFolderIds = new Set(
    todayDocs.map((d) => d.parentFolderId).filter(Boolean),
  );
  const activeFolders = [...activeFolderIds].map((id) => {
    const f = folderById.get(id);
    if (!f) return null;
    const kids = todayDocs.filter((d) => d.parentFolderId === id);
    const deptName = kids[0]?.departmentName || null;
    if (deptFilter && deptName && !fold(deptName).includes(deptFilter)) return null;
    return {
      id,
      name: folderTitle(f),
      department: deptName,
      category: f.category || null,
      childIncompleteToday: kids.length,
    };
  }).filter(Boolean);

  /** @type {Map<string, { name: string, documents: number, pastDue: number, folderIds: Set<string> }>} */
  const deptMap = new Map();
  for (const d of todayDocs) {
    const name = String(d.departmentName || "—").trim() || "—";
    const cur = deptMap.get(name) || {
      name,
      documents: 0,
      pastDue: 0,
      folderIds: new Set(),
    };
    cur.documents += 1;
    if (d.isPastDue || d.status === DOC_WORK_STATUS.PAST_DUE) cur.pastDue += 1;
    if (d.parentFolderId) cur.folderIds.add(String(d.parentFolderId));
    else if (d.parentFolderName) cur.folderIds.add(String(d.parentFolderName));
    deptMap.set(name, cur);
  }
  const byDepartment = [...deptMap.values()]
    .map((d) => ({
      name: d.name,
      documents: d.documents,
      pastDue: d.pastDue,
      folders: d.folderIds.size,
    }))
    .sort((a, b) => {
      if (b.pastDue !== a.pastDue) return b.pastDue - a.pastDue;
      return b.documents - a.documents;
    });

  const { passedSlots, markableSlots, firstPending } = buildPassedSlotSignals(todayDocs, now);

  return {
    date: dayKey(now),
    totalDocumentsToday: todayDocs.length,
    breakdown: byStatus,
    byStatusCounts,
    byCategory,
    byDepartment,
    byHierarchy: [...groupMap.values()].sort((a, b) => b.documents - a.documents),
    byFolder: byFolderList,
    activeFolders,
    documents: todayDocs,
    nextDeadline,
    passedSlots: mapPassedSlotRows(passedSlots),
    markableSlots: mapPassedSlotRows(markableSlots),
    passedSlotCount: passedSlots.length,
    markableSlotCount: markableSlots.length,
    firstPendingId: firstPending?.id || null,
    firstPendingTitle: firstPending?.title || null,
    filters: {
      department: filters.department || null,
      category: filters.category || null,
      folder: filters.folder || null,
      status: filters.status || null,
      includeCompleted: includeCompleted || null,
    },
  };
}

function weekBounds(now, weekOffset = 0) {
  return ginaWeekBounds(now, Number(weekOffset) || 0);
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

/**
 * Common aliases for live category labels (blogs ↔ blog, social media ↔ redes sociales).
 * Matching still requires the category to exist in inventory.
 */
const CATEGORY_ALIAS_GROUPS = [
  ["blog", "blogs"],
  [
    "social",
    "social media",
    "social medias",
    "redes sociales",
    "red social",
    "redes",
  ],
];

/**
 * @param {string} liveName
 * @returns {string[]}
 */
export function expandCategoryNameTokens(liveName) {
  const n = fold(liveName);
  if (!n) return [];
  for (const group of CATEGORY_ALIAS_GROUPS) {
    const hits = group.some((alias) => (
      nearMatchToken(alias, n)
      || n.includes(fold(alias))
      || fold(alias).includes(n)
      || textHasNearPhrase(n, [alias])
    ));
    if (hits) return [...new Set([n, ...group.map((a) => fold(a)).filter(Boolean)])];
  }
  return [n];
}

/**
 * Match a live category label under a department (inventory only).
 * Exact / substring first.
 * @returns {string | null}
 */
export function matchLiveCategoryInText(ctx, text, departmentName = null) {
  const named = matchNamedCategoryInText(ctx, text, departmentName);
  return named?.name || null;
}

/**
 * Resolve a live category by name/alias without requiring the word "categoría".
 * @returns {{ name: string, departmentName: string | null, departmentId?: string | null } | null}
 */
export function matchNamedCategoryInText(ctx, text, departmentName = null) {
  const q = fold(text);
  if (!q) return null;
  if (/\b(uncategorized|sin\s+categor)/.test(q)) {
    return { name: "uncategorized", departmentName: departmentName || null };
  }
  const inventory = get_workspace_inventory(ctx);
  const deptFold = fold(departmentName);
  /** @type {{ name: string, departmentName: string | null, departmentId?: string | null, score: number } | null} */
  let best = null;

  for (const d of inventory.departments) {
    if (deptFold) {
      const tokens = expandDepartmentNameTokens(d.name);
      if (fold(d.name) !== deptFold && !tokens.includes(deptFold)) continue;
    }
    const liveCats = new Set(
      (d.categories || []).map((c) => String(c || "").trim()).filter(Boolean),
    );
    // Also categories that appear only on folders
    for (const f of inventory.folders || []) {
      if (f.departmentId && d.id && f.departmentId !== d.id) continue;
      if (fold(f.departmentName) && fold(f.departmentName) !== fold(d.name)
        && !expandDepartmentNameTokens(d.name).includes(fold(f.departmentName))) {
        continue;
      }
      if (f.category) liveCats.add(String(f.category).trim());
    }

    for (const cat of liveCats) {
      const c = fold(cat);
      if (!c || c.length < 2) continue;
      const aliases = expandCategoryNameTokens(cat);
      let score = 0;
      if (q.includes(c) || new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q)) {
        score = 100 + c.length;
      } else {
        for (const alias of aliases) {
          if (!alias || alias.length < 2) continue;
          if (alias.includes(" ")) {
            if (textHasNearPhrase(q, [alias])) {
              score = Math.max(score, 80 + alias.length);
            }
          } else if (textHasNearPhrase(q, [alias]) || tokenizeGinaText(q).some((tok) => nearMatchToken(tok, alias))) {
            score = Math.max(score, 70 + alias.length);
          }
        }
      }
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = {
          name: cat,
          departmentName: d.name,
          departmentId: d.id,
          score,
        };
      }
    }
  }
  return best
    ? { name: best.name, departmentName: best.departmentName, departmentId: best.departmentId || null }
    : null;
}

/**
 * Match a live folder under an optional department (inventory only).
 * Exact / substring first; soft fuzzy for typos (plann d negocio).
 * @returns {{ id: string, name: string, category: string | null, departmentName: string | null } | null}
 */
export function matchLiveFolderInText(ctx, text, departmentName = null) {
  const hits = matchLiveFoldersByNeedle(ctx, text, { departmentName, limit: 1 });
  return hits[0] || null;
}

/**
 * Rank live folders against a free-text needle (folder title / leftover after "documentos del …").
 * @param {object} ctx
 * @param {string} textOrNeedle
 * @param {{ departmentName?: string | null, limit?: number }} [opts]
 * @returns {{ id: string, name: string, category: string | null, departmentName: string | null, score: number }[]}
 */
export function matchLiveFoldersByNeedle(ctx, textOrNeedle, opts = {}) {
  const raw = String(textOrNeedle || "");
  let q = fold(raw);
  // Prefer explicit "documentos del X" / "folder X" remnant when present
  const fromDocs = q.match(
    /\b(?:todos\s+(?:los\s+)?)?documentos?\s+(?:del|de|en|del\s+folder|de\s+la\s+caja)\s+(.+)$/,
  );
  const fromFolder = q.match(/\b(?:folder|caja|proyecto)\s+(.+)$/);
  if (fromDocs?.[1]) q = fold(fromDocs[1]).replace(/[?!.]+$/g, "").trim();
  else if (fromFolder?.[1]) q = fold(fromFolder[1]).replace(/[?!.]+$/g, "").trim();
  else {
    q = q
      .replace(/\b(gina|dame|muestra|muestrame|entreg\w*|lista\w*|listame|todos|todas|los|las|documentos?|del|de|en|el|la|un|una|por\s+favor|please)\b/g, " ")
      .replace(/[?!.]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!q || q.length < 2) return [];

  const inventory = get_workspace_inventory(ctx);
  const deptFold = fold(opts.departmentName);
  const limit = opts.limit ?? 5;
  /** @type {{ id: string, name: string, category: string | null, departmentName: string | null, score: number }[]} */
  const scored = [];

  for (const f of inventory.folders) {
    if (deptFold) {
      const tokens = expandDepartmentNameTokens(f.departmentName || "");
      const fd = fold(f.departmentName);
      if (fd && fd !== deptFold && !tokens.includes(deptFold) && !expandDepartmentNameTokens(opts.departmentName).includes(fd)) {
        continue;
      }
      if (!fd && deptFold) continue;
    }
    const name = fold(f.name);
    if (!name || name.length < 2) continue;

    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q) || q.includes(name)) score = 80 + Math.min(name.length, 20);
    else {
      // Token overlap + soft edit distance
      const nToks = name.split(/\s+/).filter(Boolean);
      const qToks = q.split(/\s+/).filter(Boolean);
      let hits = 0;
      for (const qt of qToks) {
        if (qt.length < 2) continue;
        for (const nt of nToks) {
          if (nt === qt || nt.includes(qt) || qt.includes(nt)) {
            hits += 1;
            break;
          }
          const maxDist = qt.length >= 6 ? 2 : 1;
          if (Math.abs(nt.length - qt.length) <= maxDist && folderEditDistance(nt, qt) <= maxDist) {
            hits += 1;
            break;
          }
        }
      }
      if (hits === 0) continue;
      const need = Math.max(1, Math.ceil(qToks.filter((t) => t.length >= 2).length * 0.6));
      if (hits < need) continue;
      score = 40 + hits * 10;
    }

    scored.push({
      id: f.id,
      name: f.name,
      category: f.category || null,
      departmentName: f.departmentName || null,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
  return scored.slice(0, limit);
}

function folderEditDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[t.length];
}

export function filterDocumentsByDepartmentAndCategory(ctx, departmentQuery, categoryQuery, folderQuery = "") {
  const docs = get_all_company_documents(ctx);
  const dq = fold(departmentQuery);
  const cq = fold(categoryQuery);
  const fq = fold(folderQuery);
  const wantUncat = cq === "uncategorized" || cq === "sin categoria" || cq === "sin categoría";
  return docs.filter((d) => {
    const deptName = fold(d.departmentName);
    const okDept = !dq
      || deptName.includes(dq)
      || expandDepartmentNameTokens(d.departmentName || "").includes(dq)
      || expandDepartmentNameTokens(departmentQuery).includes(deptName);
    if (!okDept) return false;
    if (cq) {
      const docCat = fold(d.category);
      if (wantUncat) {
        if (docCat && docCat !== "uncategorized" && docCat !== "sin categoria") return false;
      } else {
        const aliases = expandCategoryNameTokens(categoryQuery);
        const catOk = Boolean(docCat) && (
          docCat === cq
          || aliases.some((a) => docCat === a || nearMatchToken(docCat, a))
          || (docCat.length >= 4 && cq.length >= 4 && (docCat.includes(cq) || cq.includes(docCat)))
        );
        const folderName = fold(d.parentFolderName);
        const folderOk = Boolean(folderName)
          && cq.length >= 4
          && (folderName === cq || folderName.includes(cq));
        if (!catOk && !folderOk) return false;
      }
    }
    if (fq && !fold(d.parentFolderName).includes(fq) && !fq.includes(fold(d.parentFolderName))) {
      return false;
    }
    return true;
  });
}

/** Live inventory — only real corpus entities */
export function get_workspace_inventory(ctx = {}) {
  const { folders, documents, departments } = buildDocIndex(ctx);
  const deptList = asList(ctx.departments).filter((d) => {
    if (!d?.id) return false;
    if (ctx.objectId && d.objectId && d.objectId !== ctx.objectId) return false;
    return true;
  });

  const departmentsOut = deptList.map((d) => {
    const name = String(d.category || d.name || "").trim();
    const categories = Array.isArray(d.subcategories)
      ? d.subcategories.map((s) => String(s?.label || s?.name || "").trim()).filter(Boolean)
      : [];
    const deptFolders = folders.filter((f) => f.departmentId === d.id);
    return {
      id: d.id,
      name,
      categories,
      folderCount: deptFolders.length,
      documentCount: documents.filter((doc) => doc.departmentId === d.id).length,
    };
  }).filter((d) => d.name);

  const foldersOut = folders.map((f) => {
    const kids = documents.filter((d) => d.parentFolderId === f.id);
    const dept = f.departmentId ? findDepartmentById(deptList, f.departmentId) : null;
    return {
      id: f.id,
      name: folderTitle(f),
      departmentId: f.departmentId || null,
      departmentName: dept?.category || null,
      category: f.category || null,
      childDocuments: kids.length,
      incompleteDocuments: kids.filter((k) => !k.completed && k.status !== DOC_WORK_STATUS.COMPLETED).length,
      hasSchedule: Boolean(f.scheduleStartAt && f.scheduleFinishAt),
      scheduleStartAt: f.scheduleStartAt || null,
      scheduleFinishAt: f.scheduleFinishAt || null,
    };
  });

  return {
    departmentCount: departmentsOut.length,
    folderCount: foldersOut.length,
    documentCount: documents.length,
    departments: departmentsOut,
    folders: foldersOut,
  };
}

/**
 * Resolve ambiguous names against live inventory (category vs folder vs loose folder).
 * @returns {{ ambiguous: boolean, needle: string, options: { id: string, kind: string, label: string, department?: string|null, category?: string|null, folderId?: string|null }[] }}
 */
export function resolveNameAmbiguity(ctx, nameQuery) {
  const needle = fold(nameQuery);
  const options = [];
  if (!needle) return { ambiguous: false, needle: "", options: [] };

  const inventory = get_workspace_inventory(ctx);

  for (const d of inventory.departments) {
    for (const cat of d.categories || []) {
      if (fold(cat) === needle || fold(cat).includes(needle) || needle.includes(fold(cat))) {
        options.push({
          id: `cat:${d.id}:${cat}`,
          kind: "category",
          label: `En el departamento de ${d.name} existe como categoría ${cat}`,
          department: d.name,
          category: cat,
          folderId: null,
        });
      }
    }
  }

  for (const f of inventory.folders) {
    if (!(fold(f.name) === needle || fold(f.name).includes(needle) || needle.includes(fold(f.name)))) {
      continue;
    }
    if (f.departmentName && f.category) {
      options.push({
        id: `folder:${f.id}`,
        kind: "folder",
        label: `En el departamento de ${f.departmentName} existe como ${f.category} de ${f.name}`,
        department: f.departmentName,
        category: f.category,
        folderId: f.id,
        folderName: f.name,
      });
    } else if (f.departmentName) {
      options.push({
        id: `folder:${f.id}`,
        kind: "folder",
        label: `En el departamento de ${f.departmentName} tienes el folder ${f.name}`,
        department: f.departmentName,
        category: f.category || null,
        folderId: f.id,
        folderName: f.name,
      });
    } else {
      options.push({
        id: `loose:${f.id}`,
        kind: "loose_folder",
        label: `Tienes un folder suelto titulado ${f.name} (sin departamento)`,
        department: null,
        category: null,
        folderId: f.id,
        folderName: f.name,
      });
    }
  }

  // de-dupe by id
  const seen = new Set();
  const unique = [];
  for (const o of options) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    unique.push(o);
  }

  return {
    ambiguous: unique.length > 1,
    needle: String(nameQuery || "").trim(),
    options: unique,
  };
}

/**
 * Common bilingual aliases for live department names (Sales ↔ ventas, …).
 * Matching still requires the department to exist in inventory.
 */
const DEPT_ALIAS_GROUPS = [
  ["sales", "ventas"],
  ["marketing", "mercadeo", "mkt"],
];

/**
 * @param {string} nameFolded
 * @returns {string[]}
 */
export function expandDepartmentNameTokens(nameFolded) {
  const n = fold(nameFolded);
  if (!n) return [];
  const group = DEPT_ALIAS_GROUPS.find((g) => g.includes(n));
  return group ? [...new Set(group)] : [n];
}

/**
 * @param {string} q folded query
 * @param {string} name folded multi-word department name
 */
function multiWordDeptPhraseMatches(q, name) {
  if (!name.includes(" ")) return false;
  const qTokens = q.split(/\s+/).filter(Boolean);
  const nTokens = name.split(/\s+/).filter(Boolean);
  if (!qTokens.length || qTokens.length < nTokens.length) return false;
  for (let i = 0; i <= qTokens.length - nTokens.length; i += 1) {
    let ok = true;
    for (let j = 0; j < nTokens.length; j += 1) {
      const qt = qTokens[i + j];
      const nt = nTokens[j];
      if (qt === nt || qt.includes(nt) || nt.includes(qt) || nearMatchToken(qt, nt)) continue;
      ok = false;
      break;
    }
    if (ok) return true;
  }
  return false;
}

/**
 * @param {string} queryFolded
 * @param {string} deptName
 */
function departmentNameHitsQuery(queryFolded, deptName) {
  const q = fold(queryFolded);
  if (!q) return false;
  const tokens = expandDepartmentNameTokens(deptName);
  const live = fold(deptName);
  const names = new Set([live, ...tokens].filter(Boolean));
  for (const name of names) {
    if (!name) continue;
    if (q === name) return true;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(q)) return true;
    // Multi-word live names may appear as contiguous phrase without extra tokens
    if (name.includes(" ") && q.includes(name)) return true;
    if (multiWordDeptPhraseMatches(q, name)) return true;
  }
  return false;
}

/**
 * Match a department name from live inventory against remainder text.
 * Supports bilingual aliases (e.g. "ventas" → department "Sales").
 */
export function matchDepartmentInText(ctx, text) {
  const q = fold(text);
  if (!q) return null;
  const inventory = get_workspace_inventory(ctx);
  let best = null;
  let bestScore = 0;
  for (const d of inventory.departments) {
    const name = fold(d.name);
    if (!name) continue;
    if (!departmentNameHitsQuery(q, d.name)) continue;
    let score = name.length;
    if (q === name) score += 200;
    if (q.includes(name) && name.includes(" ")) score += 100;
    if (score <= bestScore) continue;
    bestScore = score;
    best = d;
  }
  return best;
}

/**
 * Live counts for a department (folders + docs + categories). Never invents.
 * @returns {{ department: string, folderCount: number, documentCount: number, categories: string[], empty: boolean } | null}
 */
export function getDepartmentCorpusStats(ctx, departmentNameOrId) {
  const inventory = get_workspace_inventory(ctx);
  const needle = fold(departmentNameOrId);
  if (!needle) return null;
  const d = inventory.departments.find((row) => {
    if (row.id && row.id === departmentNameOrId) return true;
    if (fold(row.name) === needle) return true;
    return departmentNameHitsQuery(needle, row.name) && needle.length >= 3;
  });
  if (!d) return null;
  const folderCount = d.folderCount || 0;
  const documentCount = d.documentCount || 0;
  const categories = Array.isArray(d.categories) ? d.categories : [];
  return {
    department: d.name,
    departmentId: d.id,
    folderCount,
    documentCount,
    categories,
    categoryCount: categories.length,
    empty: folderCount === 0 && documentCount === 0 && categories.length === 0,
  };
}

/**
 * Extract a candidate entity name after "en|de|del|para" from remainder.
 */
export function extractScopedName(remainder) {
  const q = fold(remainder);
  const m = q.match(/\b(?:en|del|de|para)\s+([a-z0-9áéíóúüñ][\wáéíóúüñ\s-]{1,40})$/)
    || q.match(/\b(?:en|del|de|para)\s+([a-z0-9áéíóúüñ][\wáéíóúüñ\s-]{1,40})\b/);
  if (m) return m[1].replace(/\?+$/, "").trim();
  // leftover single token(s)
  const cleaned = q
    .replace(/\b(gina|que|qué|tengo|hay|para|el|la|los|las|un|una|me|puedes|decir|mostrar)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned && cleaned.length >= 2 && cleaned.split(" ").length <= 4) return cleaned;
  return null;
}

/**
 * Live folders under a department whose category label matches.
 * @param {object} inventory from get_workspace_inventory
 * @param {string | null} departmentName
 * @param {string} categoryName
 */
export function listFoldersForDepartmentCategory(inventory, departmentName, categoryName) {
  const allFolders = Array.isArray(inventory?.folders) ? inventory.folders : [];
  const category = String(categoryName || "").trim();
  const deptName = departmentName ? String(departmentName).trim() : null;
  return allFolders.filter((f) => {
    const cat = fold(f.category);
    const want = fold(category);
    if (!cat || !want) return false;
    const aliases = expandCategoryNameTokens(category);
    const catOk = cat === want
      || cat.includes(want)
      || want.includes(cat)
      || aliases.some((a) => cat === a || nearMatchToken(cat, a));
    if (!catOk) return false;
    if (!deptName) return true;
    const fd = fold(f.departmentName);
    const wantDept = fold(deptName);
    if (fd === wantDept) return true;
    return expandDepartmentNameTokens(deptName).includes(fd)
      || expandDepartmentNameTokens(f.departmentName).includes(wantDept);
  }).map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category || category,
    departmentName: f.departmentName || deptName,
    documentCount: f.childDocuments ?? 0,
  }));
}

/**
 * Resolve search needle: department → category → title (LIVE CORPUS ONLY).
 * @param {GinaToolsContext} ctx
 * @param {string} needle
 * @param {{ departmentHint?: string | null }} [opts]
 * @returns {{
 *   kind: "department" | "category" | "title",
 *   name?: string,
 *   departmentName?: string | null,
 *   needle?: string,
 * }}
 */
export function resolveEntitySearchScope(ctx, needle, opts = {}) {
  const raw = String(needle || "").trim();
  const n = fold(raw);
  if (!n || n.length < 2) {
    return { kind: "title", needle: raw };
  }

  const deptHit = matchDepartmentInText(ctx, raw);
  if (deptHit?.name && departmentNameHitsQuery(n, deptHit.name)) {
    return { kind: "department", name: deptHit.name };
  }

  const deptHint = opts.departmentHint ? String(opts.departmentHint).trim() : null;
  const catHit = matchNamedCategoryInText(ctx, raw, deptHint)
    || matchNamedCategoryInText(ctx, raw, null);
  if (catHit?.name) {
    return {
      kind: "category",
      name: catHit.name,
      departmentName: deptHint || catHit.departmentName || null,
    };
  }

  return { kind: "title", needle: raw };
}

/**
 * Title-only filter within an anchored table scope.
 * @param {GinaToolsContext} ctx
 * @param {{ department?: string | null, documents?: Array<{ id?: string }> } | null} anchor
 * @param {string} needle
 */
export function filterDocsByTitleNeedle(ctx, anchor, needle) {
  const n = fold(needle);
  if (!n) return [];
  const all = get_all_company_documents(ctx);
  let scoped = all;
  const dept = anchor?.department ? String(anchor.department).trim() : null;
  if (dept) {
    const dq = fold(dept);
    scoped = all.filter((d) => {
      const fd = fold(d.departmentName);
      if (fd === dq) return true;
      return expandDepartmentNameTokens(dept).includes(fd)
        || expandDepartmentNameTokens(d.departmentName).includes(dq);
    });
  } else if (Array.isArray(anchor?.documents) && anchor.documents.length) {
    const ids = new Set(
      anchor.documents.map((d) => String(d?.id || "").trim()).filter(Boolean),
    );
    if (ids.size) scoped = all.filter((d) => ids.has(d.id));
  }
  return scoped.filter((d) => {
    const title = fold(d.title || d.name || "");
    if (!title) return false;
    return title.includes(n) || n.includes(title);
  });
}

const WORD_SCOPE_STOP = new Set([
  "a", "al", "de", "del", "el", "la", "las", "lo", "los", "un", "una",
  "todo", "todos", "todas", "sobre", "por", "en", "con",
]);

function wordScopeTokens(text) {
  return fold(text)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !WORD_SCOPE_STOP.has(t));
}

/**
 * Live name contains the search needle (phrase or all significant tokens).
 * "estrategia" hits "Estrategias de negocios"; "plan de negocio" does not.
 * @param {string} liveName
 * @param {string} needle
 */
export function wordScopeNameHits(liveName, needle) {
  const nf = fold(liveName);
  const q = fold(needle);
  if (!nf || !q || q.length < 3) return false;
  if (nf === q) return true;
  if (nf.includes(q)) return true;
  const qToks = wordScopeTokens(q);
  const nToks = wordScopeTokens(nf);
  if (!qToks.length) return false;
  return qToks.every((qt) => nToks.some((nt) => (
    nt === qt
    || nt.includes(qt)
    || (qt.length >= 4 && qt.includes(nt) && nt.length >= 4)
    || nearMatchToken(nt, qt)
  )));
}

function isUncategorizedCategory(category) {
  const c = fold(category);
  return !c || c === "uncategorized" || c === "sin categoria";
}

/**
 * Scan live corpus for a word: department → category → folder → document title.
 * Never invents names.
 * @param {GinaToolsContext} ctx
 * @param {string} needle
 */
export function scanGinaWordScope(ctx, needle) {
  const raw = String(needle || "").trim();
  const inventory = get_workspace_inventory(ctx);
  /** @type {Array<{ id: string, name: string }>} */
  const departments = [];
  /** @type {Array<{ name: string, departmentName: string | null, departmentId?: string | null }>} */
  const categories = [];
  /** @type {Array<{ id: string, name: string, category: string | null, departmentName: string | null }>} */
  const folders = [];

  for (const d of inventory.departments || []) {
    if (wordScopeNameHits(d.name, raw)) {
      departments.push({ id: d.id, name: d.name });
    }
    for (const cat of d.categories || []) {
      const name = String(cat || "").trim();
      if (!name || isUncategorizedCategory(name)) continue;
      if (!wordScopeNameHits(name, raw)) continue;
      const key = `${fold(d.name)}:${fold(name)}`;
      if (categories.some((c) => `${fold(c.departmentName)}:${fold(c.name)}` === key)) continue;
      categories.push({
        name,
        departmentName: d.name || null,
        departmentId: d.id || null,
      });
    }
  }

  for (const f of inventory.folders || []) {
    if (!wordScopeNameHits(f.name, raw)) continue;
    folders.push({
      id: f.id,
      name: f.name,
      category: f.category || null,
      departmentName: f.departmentName || null,
    });
  }

  const documents = get_all_company_documents(ctx)
    .filter((d) => wordScopeNameHits(d.title || d.name || "", raw))
    .map((d) => ({
      id: d.id,
      title: d.title || d.name || "—",
      departmentName: d.departmentName || null,
      category: d.category || null,
      folder: d.parentFolderName || null,
      status: d.status || null,
      anchorAt: d.anchorAt || null,
      anchorFinishAt: d.anchorFinishAt || null,
    }));

  const structuralCount = (departments.length ? 1 : 0)
    + (categories.length ? 1 : 0)
    + (folders.length ? 1 : 0);

  return {
    needle: raw,
    departments,
    categories,
    folders,
    documents,
    structuralCount,
    empty: structuralCount === 0 && documents.length === 0,
  };
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
  get_workspace_inventory,
  resolveNameAmbiguity,
};
