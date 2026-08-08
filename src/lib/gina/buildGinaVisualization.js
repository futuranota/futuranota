import { isPassedSlot, buildCascadeSchedulePreview } from "./ginaScheduleRecovery.js";
import { formatClockRange12h, formatClock12h } from "../clockFormat.js";
import {
  buildGinaDepartmentRail,
  GINA_DEPT_RAIL_COLORS,
  GINA_DEPT_RAIL_UNASSIGNED,
  ginaDepartmentRailColor,
} from "./ginaDepartmentColors.js";
import {
  buildGinaStatusRail,
  compareDocsByStatusThenTime,
} from "./ginaStatusColors.js";
import { buildGinaTimeDisplay } from "./ginaRelativeDay.js";
import {
  buildTodayQuickSheetSections,
  mapQuickSheetSections,
  summarizeTodayOverlaps,
} from "./ginaTodayQuickSheet.js";

/**
 * Build deterministic Gina chat visualizations from query family + tool JSON.
 * Groq only narrates; counts and lists come from here.
 */

/**
 * @typedef {{
 *   department?: string | null,
 *   category?: string | null,
 *   folder?: string | null,
 * }} GinaHierarchy
 */

/**
 * @param {GinaHierarchy} h
 * @returns {string}
 */
export function formatHierarchyPath(h = {}) {
  return [h.department, h.category, h.folder].filter(Boolean).join(" / ");
}

/**
 * @param {string | Date | null | undefined} value
 * @param {string} [locale]
 */
export function formatGinaTimeRange(start, finish, locale = "es") {
  const a = start ? new Date(start) : null;
  if (a && Number.isNaN(a.getTime())) return locale === "en" ? "Flexible" : "Flexible";
  if (!a) return locale === "en" ? "Flexible" : "Flexible";
  const range = formatClockRange12h(start, finish, { sep: " – " });
  return range || formatClock12h(start) || (locale === "en" ? "Flexible" : "Flexible");
}

/**
 * @param {string | null | undefined} dateKey
 * @param {string} [locale]
 */
export function formatGinaDayLabel(dateKey, locale = "es") {
  if (!dateKey) return "";
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function asDocs(list) {
  return Array.isArray(list) ? list : [];
}

function mapDocRow(d, now = null, locale = "es") {
  // Never pass bare to Array#map — index/array would poison now/locale.
  const clock = now instanceof Date ? now : new Date();
  const loc = typeof locale === "string" ? locale : "es";
  const anchorAt = d.anchorAt || d.startedAt || null;
  const finishAt = d.anchorFinishAt || d.dueAt || null;
  const timeRange = anchorAt
    ? formatGinaTimeRange(anchorAt, finishAt, loc)
    : null;
  const display = buildGinaTimeDisplay(
    {
      anchorAt,
      timeRange: timeRange && timeRange !== "Flexible" ? timeRange : null,
    },
    clock,
    loc,
  );
  const timeLabel = display.timeLabel;
  return {
    id: d.id || null,
    title: d.title || "Untitled",
    status: d.status || null,
    completed: d.status === "completed" || d.completed === true,
    struck: d.status === "completed" || d.completed === true,
    folder: d.folder || d.parentFolderName || null,
    department: d.department || d.departmentName || null,
    category: d.category || null,
    time: timeLabel,
    timeLabel,
    relativeDay: display.relativeDay,
    timeClock: display.timeClock,
    absoluteDate: display.absoluteDate,
    dueDate: d.dueDate || null,
    daysOverdue: d.daysOverdue,
    daysUntilDue: d.daysUntilDue,
    passedSlot: Boolean(d.passedSlot) || isPassedSlot(d, clock),
    hierarchy: {
      department: d.department || d.departmentName || null,
      category: d.category || null,
      folder: d.folder || d.parentFolderName || null,
    },
  };
}

function isSlotOverdue(doc, now = new Date()) {
  const finish = doc.anchorFinishAt ? new Date(doc.anchorFinishAt) : null;
  const start = doc.anchorAt ? new Date(doc.anchorAt) : null;
  if (finish && !Number.isNaN(finish.getTime()) && finish.getTime() < now.getTime()) return true;
  if (start && !Number.isNaN(start.getTime()) && start.getTime() < now.getTime()) {
    if (!finish) return true;
  }
  return Boolean(doc.isPastDue || doc.status === "past_due");
}

function isSlotFromNow(doc, now = new Date()) {
  const start = doc.anchorAt ? new Date(doc.anchorAt) : null;
  if (!start || Number.isNaN(start.getTime())) return true; // untimed still in today scope
  return start.getTime() >= now.getTime();
}

/**
 * Group docs Depto → Folder → timed rows for schedule sheet.
 * @param {object[]} docs
 * @param {Date} [now]
 */
export function groupDocsForScheduleSheet(docs, now = new Date()) {
  /** @type {Map<string, Map<string, object[]>>} */
  const byDept = new Map();
  for (const raw of docs) {
    const row = mapDocRow(raw, now);
    const dept = row.department || "—";
    const folder = row.folder || "—";
    if (!byDept.has(dept)) byDept.set(dept, new Map());
    const folders = byDept.get(dept);
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push({
      ...row,
      anchorAt: raw.anchorAt || null,
    });
  }
  return [...byDept.entries()].map(([department, folderMap]) => ({
    department,
    folders: [...folderMap.entries()].map(([folder, documents]) => ({
      folder,
      documents: documents.slice().sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || ""))),
    })),
  }));
}

function buildDepartmentCardsData(today, locale) {
  const departments = Array.isArray(today.byDepartment) && today.byDepartment.length
    ? today.byDepartment
    : (() => {
        const map = new Map();
        for (const d of asDocs(today.documents)) {
          const name = d.departmentName || d.department || "—";
          const cur = map.get(name) || { name, documents: 0, pastDue: 0, folders: 0, folderIds: new Set() };
          cur.documents += 1;
          if (d.isPastDue || d.status === "past_due") cur.pastDue += 1;
          if (d.parentFolderId) cur.folderIds.add(d.parentFolderId);
          map.set(name, cur);
        }
        return [...map.values()].map((d) => ({
          name: d.name,
          documents: d.documents,
          pastDue: d.pastDue,
          folders: d.folderIds.size,
        })).sort((a, b) => (b.pastDue - a.pastDue) || (b.documents - a.documents));
      })();
  const recommended = departments[0]?.name || null;
  return {
    date: today.date,
    dateLabel: formatGinaDayLabel(today.date, locale),
    total: today.totalDocumentsToday ?? asDocs(today.documents).length,
    departments,
    recommended,
    emptyHint: locale === "en"
      ? "No pending documents for today."
      : "Sin documentos pendientes para hoy.",
  };
}

/**
 * Work-block duration in minutes from schedule window. No finish → 0 (do not invent).
 * @param {object} doc
 * @returns {number}
 */
export function docWorkMinutes(doc) {
  const start = doc?.anchorAt ? new Date(doc.anchorAt) : null;
  const finish = doc?.anchorFinishAt || doc?.dueAt
    ? new Date(doc.anchorFinishAt || doc.dueAt)
    : null;
  if (!start || Number.isNaN(start.getTime()) || !finish || Number.isNaN(finish.getTime())) {
    return 0;
  }
  return Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000));
}

/**
 * @param {string} name
 * @param {number} index
 * @param {number} [total]
 */
export function colorForDepartment(name, index = 0, total = GINA_DEPT_RAIL_COLORS.length) {
  const key = String(name || "").trim();
  if (!key || key === "—" || key === "# Department") {
    return GINA_DEPT_RAIL_UNASSIGNED;
  }
  return ginaDepartmentRailColor(index, total);
}

/**
 * Human duration for narration / legend.
 * @param {number} minutes
 * @param {string} [locale]
 * @param {{ short?: boolean }} [opts]
 */
export function formatWorkDurationLabel(minutes, locale = "es", opts = {}) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const en = locale === "en";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (opts.short) {
    if (h <= 0) return en ? `${rem}m` : `${rem}m`;
    if (rem <= 0) return en ? `${h}h` : `${h}h`;
    return `${h}h ${rem}m`;
  }
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
    ? `${h} hour${h === 1 ? "" : "s"} and ${rem} minute${rem === 1 ? "" : "s"}`
    : `${h} hora${h === 1 ? "" : "s"} con ${rem} minuto${rem === 1 ? "" : "s"}`;
}

/**
 * Per-department category counts + work minutes for “qué tenemos para hoy”.
 * @param {object[]} docs
 * @param {string} [locale]
 * @returns {{
 *   name: string,
 *   total: number,
 *   minutes: number,
 *   hoursLabel: string,
 *   color: string,
 *   categories: { name: string, count: number }[],
 * }[]}
 */
export function buildTodayOverviewByDepartment(docs, locale = "es") {
  const en = locale === "en";
  const uncategorized = en ? "uncategorized" : "sin categoría";
  /** @type {Map<string, { cats: Map<string, number>, minutes: number }>} */
  const byDept = new Map();
  for (const d of asDocs(docs)) {
    const dept = String(d.departmentName || d.department || "—").trim() || "—";
    const cat = String(d.category || "").trim() || uncategorized;
    if (!byDept.has(dept)) byDept.set(dept, { cats: new Map(), minutes: 0 });
    const cur = byDept.get(dept);
    cur.cats.set(cat, (cur.cats.get(cat) || 0) + 1);
    cur.minutes += docWorkMinutes(d);
  }
  return [...byDept.entries()]
    .map(([name, cur]) => {
      const categories = [...cur.cats.entries()]
        .map(([catName, count]) => ({ name: catName, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      const total = categories.reduce((acc, c) => acc + c.count, 0);
      const minutes = cur.minutes;
      return {
        name,
        total,
        minutes,
        hoursLabel: formatWorkDurationLabel(minutes, locale),
        categories,
      };
    })
    .sort((a, b) => b.minutes - a.minutes || b.total - a.total || a.name.localeCompare(b.name))
    .map((row, index, arr) => ({
      ...row,
      color: colorForDepartment(row.name, index, arr.length),
    }));
}

/**
 * Pie slices for departments with minutes > 0.
 * @param {{ name: string, minutes: number, color: string }[]} overviewByDepartment
 */
export function buildTodayHoursChart(overviewByDepartment) {
  const rows = Array.isArray(overviewByDepartment) ? overviewByDepartment : [];
  return rows
    .filter((d) => (d.minutes || 0) > 0)
    .map((d, i) => {
      const key = `dept_${i}_${String(d.name || "x").replace(/\s+/g, "_").slice(0, 24)}`;
      return {
        key,
        name: d.name,
        minutes: d.minutes,
        fill: d.color || colorForDepartment(d.name, i),
      };
    });
}

function buildDeptSummaryData(today, locale, now) {
  const docs = asDocs(today.documents);
  const dept = today.filters?.department
    || docs[0]?.departmentName
    || docs[0]?.department
    || "—";
  const overdueDocs = docs.filter((d) => isSlotOverdue(d, now));
  const fromNowDocs = docs.filter((d) => isSlotFromNow(d, now));
  const folderIds = new Set(
    docs.map((d) => d.parentFolderId || d.parentFolderName || d.folder).filter(Boolean),
  );
  const folders = Array.isArray(today.byFolder) && today.byFolder.length
    ? today.byFolder.map((f) => ({
      id: f.id || null,
      name: f.name || f.folder || "—",
      documents: f.documents || 0,
      category: f.category || null,
    }))
    : [...folderIds].map((name) => ({ id: null, name: String(name), documents: 0, category: null }));
  const categories = Array.isArray(today.byCategory)
    ? today.byCategory
    : [];
  const statuses = Array.isArray(today.byStatusCounts)
    ? today.byStatusCounts
    : [];
  return {
    date: today.date,
    dateLabel: formatGinaDayLabel(today.date, locale),
    department: dept,
    documents: docs.length,
    folders: folderIds.size || folders.length,
    overdueHours: overdueDocs.length,
    fromNow: fromNowDocs.length,
    pastDue: docs.filter((d) => d.isPastDue || d.status === "past_due").length,
    byHierarchy: Array.isArray(today.byHierarchy) ? today.byHierarchy : [],
    folderList: folders,
    categoryList: categories,
    statusList: statuses,
    sampleDocuments: docs.slice(0, 6).map((d) => mapDocRow(d, now)),
  };
}

function attachRecoveryMeta(data, today, now) {
  const passed = Array.isArray(today.passedSlots) ? today.passedSlots : [];
  const markable = Array.isArray(today.markableSlots) ? today.markableSlots : [];
  const docs = asDocs(today.documents);
  const computedPassed = passed.length
    ? passed
    : docs.filter((d) => isPassedSlot(d, now)).map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      department: d.departmentName || d.department,
      folder: d.parentFolderName || d.folder,
      anchorAt: d.anchorAt,
      anchorFinishAt: d.anchorFinishAt,
    }));
  return {
    ...data,
    passedSlots: computedPassed,
    markableSlots: markable.length ? markable : computedPassed.filter((d) => {
      const s = d.status;
      return s !== "past_due" && s !== "completed" && s !== "submitted";
    }),
    passedSlotCount: today.passedSlotCount ?? computedPassed.length,
    markableSlotCount: today.markableSlotCount ?? null,
    firstPendingTitle: today.firstPendingTitle || computedPassed[0]?.title || null,
    hasRecoveryOffer: (today.markableSlotCount ?? computedPassed.filter((d) => {
      const s = d.status;
      return s !== "past_due" && s !== "completed" && s !== "submitted";
    }).length) > 0,
    highlightPassedSlots: Boolean(data.highlightPassedSlots),
    recoveryPhase: data.recoveryPhase || "gate",
  };
}

function statusLabel(key, locale) {
  const map = {
    past_due: { es: "Vencidos", en: "Past due" },
    in_progress: { es: "En progreso", en: "In progress" },
    not_started: { es: "Sin empezar", en: "Not started" },
    reserved: { es: "Reserved", en: "Reserved" },
    submitted: { es: "Submitted", en: "Submitted" },
    completed: { es: "Completed", en: "Completed" },
  };
  const row = map[key];
  if (!row) return key;
  return locale === "en" ? row.en : row.es;
}

function groupDocsByCategoryFolders(docs) {
  /** @type {Map<string, Map<string, object[]>>} */
  const byCat = new Map();
  for (const raw of docs) {
    const row = mapDocRow(raw);
    const cat = row.category || "—";
    const folder = row.folder || "—";
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const folders = byCat.get(cat);
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push({ ...row, anchorAt: raw.anchorAt || null });
  }
  return [...byCat.entries()].map(([category, folderMap]) => ({
    category,
    folders: [...folderMap.entries()].map(([folder, documents]) => ({
      folder,
      documents: documents.slice().sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || ""))),
    })),
  }));
}

/**
 * @param {string} family
 * @param {unknown} toolContext
 * @param {{ locale?: string, userText?: string, now?: Date }} [opts]
 * @returns {{ type: string, data: object } | null}
 */
export function buildGinaVisualization(family, toolContext, opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const q = String(opts.userText || "").toLowerCase();
  const rawText = String(opts.userText || "");
  const now = opts.now instanceof Date ? opts.now : new Date();
  const ctx = toolContext && typeof toolContext === "object" ? toolContext : null;
  if (!ctx) return null;

  const wantsTable = /\b(detalle|detail|tabla|table|lista completa)\b/.test(q);
  const wantsTimeline = /\b(horario|horarios|timeline|agenda|sheet)\b/.test(q)
    && !/\bexpand/.test(q)
    && !/\bstatus\s+/.test(q)
    && !/\bfolder\s+/.test(q)
    && !/\bcategor/.test(q);
  const wantsOverdueHours = /\b(horas?\s+vencid|overdue\s+hours?)\b/.test(q);
  const wantsFromNow = /\bdesde\s+ahora\b/.test(q) || /\bfrom\s+now\b/.test(q);
  const wantsAllToday = /\btodos\s+los\s+de\s+hoy\b/.test(q) || /\ball\s+of\s+today\b/.test(q);
  const wantsFocus = /\benfoc\w*\b/.test(q) || /\bfocus\s+today\s+on\b/.test(q);
  const wantsExpandStatus = /\bexpand(ir|e)?\s+status\b/.test(q);
  const wantsExpandFolders = /\bexpand(ir|e)?\s+(por\s+)?folders?\b/.test(q)
    || /\bexpand\s+by\s+folders?\b/.test(q);
  const wantsExpandCategories = /\bexpand(ir|e)?\s+(por\s+)?categor/.test(q)
    || /\bexpand\s+by\s+categor/.test(q);
  const statusPick = q.match(/\bstatus\s+(past_due|in_progress|not_started|reserved|submitted|completed)\b/);
  const folderPick = rawText.match(/\bFolder\s+(.+?)\s+hoy\s+en\b/i)
    || rawText.match(/\bFolder\s+(.+?)\s+today\s+in\b/i);
  const categoryPick = rawText.match(/\bCategor[íi]a\s+(.+?)\s+hoy\s+en\b/i)
    || rawText.match(/\bCategory\s+(.+?)\s+today\s+in\b/i);

  if (family === "focus_open" || family === "social" || family === "unclear" || family === "dismiss" || family === "free_chat") return null;

  if (family === "category_scope") {
    const mode = ctx.mode || "count_docs";
    const department = String(ctx.department || "").trim() || null;
    const category = String(ctx.category || "").trim() || null;
    const corpusName = String(ctx.corpusName || "").trim() || null;
    const folders = Array.isArray(ctx.folders) ? ctx.folders : [];
    const documents = Array.isArray(ctx.documents) ? ctx.documents : [];

    if (mode === "list_folders") {
      return {
        type: "folder_list",
        data: {
          corpusName,
          department,
          category,
          count: ctx.folderCount ?? folders.length,
          folders: folders.map((f) => ({
            id: f.id || f.name,
            name: String(f.name || "").trim(),
            category: f.category || category,
            departmentName: f.departmentName || department,
            documentCount: f.documentCount ?? 0,
            hasSchedule: Boolean(f.hasSchedule),
          })).filter((f) => f.name),
          empty: Boolean(ctx.empty) || folders.length === 0,
          emptyReason: folders.length === 0 ? "no_folders_in_category" : null,
          fromCategoryScope: true,
        },
      };
    }

    if (mode === "list_docs") {
      return {
        type: "table",
        data: {
          title: department && category
            ? `${department} · ${category}`
            : (category || (locale === "en" ? "Documents" : "Documentos")),
          department,
          category,
          documents: documents.map((d) => mapDocRow(d, now)),
          empty: documents.length === 0,
          listAll: true,
          scope: "category",
        },
      };
    }

    // count_docs — light summary card using category_list-like single focus
    return {
      type: "category_scope",
      data: {
        corpusName,
        department,
        category,
        mode: "count_docs",
        documentCount: ctx.documentCount ?? documents.length,
        folderCount: ctx.folderCount ?? folders.length,
        empty: (ctx.documentCount ?? documents.length) === 0,
      },
    };
  }

  if (family === "count_categories") {
    const cats = Array.isArray(ctx.categories) ? ctx.categories : [];
    const list = cats
      .map((c) => ({
        id: c.id || c.name,
        name: String(c.name || "").trim(),
        departmentName: c.departmentName || ctx.department || null,
        folderCount: c.folderCount ?? 0,
        documentCount: c.documentCount ?? 0,
      }))
      .filter((c) => c.name);
    const corpusName = String(ctx.corpusName || "").trim() || null;
    const department = String(ctx.department || "").trim() || null;
    return {
      type: "category_list",
      data: {
        corpusName,
        department,
        count: ctx.count ?? list.length,
        categories: list,
        empty: Boolean(ctx.empty) || list.length === 0,
        emptyReason: ctx.emptyReason || (list.length === 0 ? "no_categories" : null),
      },
    };
  }

  if (family === "count_folders") {
    const folders = Array.isArray(ctx.folders) ? ctx.folders : [];
    const list = folders
      .map((f) => ({
        id: f.id || f.name,
        name: String(f.name || "").trim(),
        category: f.category || null,
        departmentName: f.departmentName || ctx.department || null,
        documentCount: f.documentCount ?? f.childDocuments ?? 0,
        hasSchedule: Boolean(f.hasSchedule),
      }))
      .filter((f) => f.name);
    const corpusName = String(ctx.corpusName || "").trim() || null;
    const department = String(ctx.department || "").trim() || null;
    return {
      type: "folder_list",
      data: {
        corpusName,
        department,
        count: ctx.count ?? list.length,
        folders: list,
        empty: Boolean(ctx.empty) || list.length === 0,
        emptyReason: ctx.emptyReason || (list.length === 0 ? "no_folders" : null),
        fromFocus: Boolean(ctx.fromFocus),
      },
    };
  }

  if (family === "count_documents") {
    const mode = ctx.mode || "count";
    const corpusName = String(ctx.corpusName || "").trim() || null;
    const department = String(ctx.department || "").trim() || null;
    const category = String(ctx.category || "").trim() || null;
    const documents = Array.isArray(ctx.documents) ? ctx.documents : [];

    if (mode === "pick_department") {
      const depts = Array.isArray(ctx.departments) ? ctx.departments : [];
      return {
        type: "department_list",
        data: {
          corpusName,
          count: ctx.count ?? depts.length,
          departments: depts.map((d) => ({
            id: d.id || d.name,
            name: String(d.name || "").trim(),
            folderCount: d.folderCount ?? 0,
            documentCount: d.documentCount ?? 0,
          })).filter((d) => d.name),
          empty: Boolean(ctx.empty) || depts.length === 0,
          fromCountDocuments: true,
          browseMode: "department",
        },
      };
    }

    if (mode === "pick_category") {
      const cats = Array.isArray(ctx.categories) ? ctx.categories : [];
      return {
        type: "category_list",
        data: {
          corpusName,
          department: null,
          count: ctx.count ?? cats.length,
          categories: cats.map((c) => ({
            id: c.id || c.name,
            name: String(c.name || "").trim(),
            departmentName: c.departmentName || null,
            folderCount: c.folderCount ?? 0,
            documentCount: c.documentCount ?? 0,
          })).filter((c) => c.name),
          empty: Boolean(ctx.empty) || cats.length === 0,
          fromCountDocuments: true,
          browseMode: "category",
        },
      };
    }

    if (mode === "list_all" || mode === "list_by_department" || mode === "list_by_category") {
      const view = {
        showSchedule: Boolean(ctx.view?.showSchedule),
        showStatus: Boolean(ctx.view?.showStatus),
        categories: Array.isArray(ctx.view?.categories) ? ctx.view.categories : [],
        highlightCategories: Array.isArray(ctx.view?.highlightCategories)
          ? ctx.view.highlightCategories
          : [],
        scheduleScope: ctx.view?.scheduleScope || null,
      };
      const docs = documents.map((d) => ({
        ...mapDocRow(d, now, locale),
        anchorAt: d.anchorAt || d.startedAt || null,
      }));
      const useStatusRail = Boolean(view.showSchedule && view.scheduleScope === "week");
      if (useStatusRail) {
        docs.sort(compareDocsByStatusThenTime);
      } else {
        // Stable sort by department (preserves schedule-first order within dept)
        docs.sort((a, b) => {
          const da = String(a.department || "").localeCompare(
            String(b.department || ""),
            undefined,
            { sensitivity: "base" },
          );
          if (da !== 0) return da;
          if (view.showSchedule) return 0;
          return String(a.title || "").localeCompare(String(b.title || ""), undefined, {
            sensitivity: "base",
          });
        });
      }
      /** @type {string[]} */
      // Department (or status) shown as left color rail + legend — not a repeated column
      const columns = ["document", "category"];
      if (view.showSchedule) columns.push("time");
      if (view.showStatus) columns.push("status");
      const railMode = useStatusRail ? "status" : "department";
      const rail = useStatusRail
        ? buildGinaStatusRail(docs, locale)
        : buildGinaDepartmentRail(docs);
      const departmentRail = railMode === "department" ? rail : undefined;
      const statusRail = railMode === "status" ? rail : undefined;
      const deferred = Boolean(ctx.deferredCategoryHighlight) && view.highlightCategories.length > 0;
      const highlightDelayMs = deferred
        ? (Number.isFinite(Number(ctx.highlightDelayMs)) ? Number(ctx.highlightDelayMs) : 2000)
        : 0;

      return {
        type: "table",
        data: {
          title: mode === "list_by_department" && department
            ? department
            : (mode === "list_by_category" && category
              ? category
              : (view.highlightCategories.length
                ? view.highlightCategories.join(", ")
                : (corpusName || (locale === "en" ? "All documents" : "Todos los documentos")))),
          corpusName,
          department,
          category,
          count: ctx.count ?? docs.length,
          documents: docs,
          view,
          columns,
          rail,
          railMode,
          departmentRail,
          statusRail,
          availableCategories: Array.isArray(ctx.availableCategories)
            ? ctx.availableCategories
            : [],
          empty: Boolean(ctx.empty) || docs.length === 0,
          deferredCategoryHighlight: deferred,
          highlightDelayMs,
          listAll: true,
          groupBy: railMode === "status" ? "status" : "department",
          scope: mode === "list_by_category"
            ? "category"
            : (mode === "list_by_department" ? "department" : "corpus"),
          fromCountDocuments: true,
        },
      };
    }

    // count — number only (no block list); table comes on list_all / filters
    const n = ctx.count ?? documents.length;
    return {
      type: "document_count",
      data: {
        corpusName,
        department,
        mode: "count",
        count: n,
        documents: [],
        empty: Boolean(ctx.empty) || n === 0,
        emptyReason: ctx.emptyReason || (n === 0 ? "no_documents" : null),
      },
    };
  }

  if (family === "count_departments") {
    const depts = Array.isArray(ctx.departments)
      ? ctx.departments
      : (Array.isArray(ctx.inventory?.departments) ? ctx.inventory.departments : []);
    const list = depts
      .map((d) => ({
        id: d.id || d.name,
        name: String(d.name || "").trim(),
        folderCount: d.folderCount ?? 0,
        documentCount: d.documentCount ?? d.documents ?? 0,
      }))
      .filter((d) => d.name);
    const corpusName = String(ctx.corpusName || "").trim() || null;
    return {
      type: "department_list",
      data: {
        corpusName,
        count: ctx.count ?? list.length,
        departments: list,
        empty: list.length === 0,
        hasTodaySchedules: Boolean(ctx.hasTodaySchedules),
        todayScheduleCount: Number(ctx.todayScheduleCount) || 0,
      },
    };
  }

  if (family === "find_document") {
    const results = asDocs(ctx.results);
    return {
      type: "find_results",
      data: {
        results,
        total: ctx.total ?? results.length,
        empty: Boolean(ctx.empty) || results.length === 0,
        needsClarify: Boolean(ctx.needsClarify),
        clarifyOptions: Array.isArray(ctx.clarifyOptions) ? ctx.clarifyOptions : (ctx.hints?.clarifyOptions || []),
        hints: ctx.hints || {},
      },
    };
  }

  if (
    family === "day_sheet"
    || family === "day_sheet_next"
    || family === "day_sheet_complete"
    || family === "day_sheet_complete_confirm"
  ) {
    const docs = asDocs(ctx.documents);
    const dateKey = typeof ctx.date === "string" && ctx.date
      ? ctx.date
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const progress = ctx.progress || {
      total: docs.length,
      completed: docs.filter((d) => d.status === "completed" || d.completed).length,
      remaining: docs.filter((d) => d.status !== "completed" && !d.completed).length,
    };
    if (family === "day_sheet_complete" || family === "day_sheet_complete_confirm") {
      const target = ctx.document || null;
      if (!target && Array.isArray(ctx.ambiguous) && ctx.ambiguous.length) {
        return {
          type: "table",
          data: {
            title: locale === "en" ? "Which document?" : "¿Cuál documento?",
            documents: ctx.ambiguous.map((d) => mapDocRow(d, now, locale)),
            isDaySheet: true,
            clarifyComplete: true,
          },
        };
      }
      if (target) {
        return {
          type: "schedule_sheet",
          data: {
            date: dateKey,
            dateLabel: formatGinaDayLabel(dateKey, locale),
            groups: groupDocsForScheduleSheet([target], now),
            documents: [mapDocRow(target, now, locale)],
            isDaySheet: true,
            completePreview: family === "day_sheet_complete",
            completeApplied: family === "day_sheet_complete_confirm",
            progress,
          },
        };
      }
    }
    if (ctx.missingAnchor || (ctx.empty && !docs.length)) {
      return {
        type: "schedule_sheet",
        data: {
          date: dateKey,
          dateLabel: formatGinaDayLabel(dateKey, locale),
          groups: [],
          documents: [],
          isDaySheet: true,
          missingAnchor: Boolean(ctx.missingAnchor),
          progress,
        },
      };
    }
    const highlightId = ctx.nextDocument?.id || null;
    return {
      type: "schedule_sheet",
      data: {
        date: dateKey,
        dateLabel: formatGinaDayLabel(dateKey, locale),
        groups: groupDocsForScheduleSheet(docs, now),
        documents: docs
          .slice()
          .map((d) => mapDocRow(d, now, locale)),
        isDaySheet: true,
        justSaved: Boolean(ctx.justSaved),
        nextDocumentId: highlightId,
        progress,
      },
    };
  }

  if (family === "today" || (family === "default_overview" && ctx.today)) {
    const today = family === "today" ? ctx : ctx.today;
    if (!today || typeof today !== "object") return null;

    let docs = asDocs(today.documents);
    if (wantsOverdueHours) {
      docs = docs.filter((d) => isSlotOverdue(d, now));
    } else if (wantsFromNow) {
      docs = docs.filter((d) => isSlotFromNow(d, now));
    }

    const dept = today.filters?.department
      || docs[0]?.departmentName
      || docs[0]?.department
      || "—";

    // Status list for one status inside a department
    if (statusPick && today.filters?.department) {
      const key = statusPick[1];
      return {
        type: "dept_status_list",
        data: {
          date: today.date,
          dateLabel: formatGinaDayLabel(today.date, locale),
          department: dept,
          status: key,
          statusLabel: statusLabel(key, locale),
          documents: docs
            .slice()
            .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
            .map((d) => mapDocRow(d, now)),
        },
      };
    }

    // Folder detail
    if (folderPick && today.filters?.department) {
      const folderName = folderPick[1].trim();
      return {
        type: "dept_folder_detail",
        data: {
          date: today.date,
          dateLabel: formatGinaDayLabel(today.date, locale),
          department: dept,
          folder: folderName,
          documents: docs
            .slice()
            .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
            .map((d) => mapDocRow(d, now)),
        },
      };
    }

    // Category detail
    if (categoryPick && today.filters?.department) {
      const categoryName = categoryPick[1].trim();
      const isAll = /^(all|todas?)$/i.test(categoryName);
      return {
        type: "dept_category_detail",
        data: {
          date: today.date,
          dateLabel: formatGinaDayLabel(today.date, locale),
          department: dept,
          category: isAll ? "All" : categoryName,
          groups: groupDocsByCategoryFolders(docs),
          documents: docs.map((d) => mapDocRow(d, now)),
        },
      };
    }

    // Expand menus
    if (wantsExpandStatus && today.filters?.department) {
      const summary = buildDeptSummaryData(today, locale, now);
      return {
        type: "dept_status_menu",
        data: {
          ...summary,
          statuses: summary.statusList.length
            ? summary.statusList
            : (today.byStatusCounts || []),
        },
      };
    }

    if (wantsExpandFolders && today.filters?.department) {
      const summary = buildDeptSummaryData(today, locale, now);
      return {
        type: "dept_folder_menu",
        data: {
          ...summary,
          folders: summary.folderList,
        },
      };
    }

    if (wantsExpandCategories && today.filters?.department) {
      const summary = buildDeptSummaryData(today, locale, now);
      return {
        type: "dept_category_menu",
        data: {
          ...summary,
          categories: summary.categoryList,
        },
      };
    }

    if (wantsTimeline || (wantsAllToday && today.filters?.department)) {
      const source = wantsTimeline || wantsAllToday || wantsOverdueHours || wantsFromNow
        ? docs
        : asDocs(today.documents);
      return {
        type: "schedule_sheet",
        data: attachRecoveryMeta({
          date: today.date,
          dateLabel: formatGinaDayLabel(today.date, locale),
          groups: groupDocsForScheduleSheet(source, now),
          documents: source
            .slice()
            .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
            .map((d) => mapDocRow(d, now)),
        }, today, now),
      };
    }

    if (wantsTable) {
      return {
        type: "table",
        data: attachRecoveryMeta({
          title: locale === "en" ? "Today" : "Hoy",
          documents: docs.map((d) => mapDocRow(d, now)),
        }, today, now),
      };
    }

    const hasDeptFilter = Boolean(today.filters?.department);
    if (hasDeptFilter || wantsFocus) {
      const deptName = today.filters?.department || null;
      const emptyTodayDept = (today.totalDocumentsToday === 0 || docs.length === 0)
        && Boolean(deptName);
      if (emptyTodayDept) {
        return {
          type: "table",
          data: {
            title: locale === "en"
              ? `Today · ${deptName}`
              : `Hoy · ${deptName}`,
            department: deptName,
            documents: [],
            empty: true,
            listAll: false,
            scope: "today",
          },
        };
      }
      if (wantsOverdueHours || wantsFromNow || wantsAllToday) {
        return {
          type: "schedule_sheet",
          data: attachRecoveryMeta({
            date: today.date,
            dateLabel: formatGinaDayLabel(today.date, locale),
            groups: groupDocsForScheduleSheet(docs, now),
            documents: docs
              .slice()
              .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
              .map((d) => mapDocRow(d, now)),
          }, today, now),
        };
      }
      return {
        type: "dept_summary",
        data: buildDeptSummaryData(today, locale, now),
      };
    }

    // Bare “qué tenemos para hoy”: narrate depts + show timed sheet (not department cards).
    // Sheet may include completed (includeCompleted); overview table/pie exclude them.
    const allToday = docs
      .slice()
      .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")));
    const quickSections = buildTodayQuickSheetSections(allToday, now);
    const overlap = summarizeTodayOverlaps(allToday, now);
    const quickSheet = {
      ...mapQuickSheetSections(quickSections, (d) => mapDocRow(d, now, locale)),
      hasOverlap: Boolean(overlap.hasOverlap || quickSections.hasOverlap),
      topConflict: overlap.topConflict,
      clockLabel: formatClock12h(now),
      totalDocuments: allToday.length,
      urgencyCount: quickSections.urgency.length,
    };
    const overviewDocs = allToday.filter(
      (d) => !(d.status === "completed" || d.completed === true),
    );
    const overviewByDepartment = buildTodayOverviewByDepartment(overviewDocs, locale);
    const totalMinutes = overviewByDepartment.reduce((acc, d) => acc + (d.minutes || 0), 0);
    const hoursChart = buildTodayHoursChart(overviewByDepartment);
    const colorByDept = Object.fromEntries(
      overviewByDepartment.map((d) => [d.name, d.color]),
    );
    const baseData = attachRecoveryMeta({
      date: today.date,
      dateLabel: formatGinaDayLabel(today.date, locale),
      groups: groupDocsForScheduleSheet(overviewDocs, now),
      documents: overviewDocs.map((d) => {
        const row = mapDocRow(d, now, locale);
        const dept = row.department || "—";
        return {
          ...row,
          departmentColor: colorByDept[dept] || colorForDepartment(dept, 0),
          workMinutes: docWorkMinutes(d),
        };
      }),
      todayOverview: true,
      overviewByDepartment,
      totalMinutes,
      totalHoursLabel: formatWorkDurationLabel(totalMinutes, locale),
      hoursChart,
      quickSheet,
    }, today, now);
    return {
      type: "schedule_sheet",
      data: {
        ...baseData,
        hasRecoveryOffer: Boolean(baseData.hasRecoveryOffer)
          || (Array.isArray(quickSheet.urgency) && quickSheet.urgency.length > 0),
      },
    };
  }

  if (family === "daily_report" || family === "daily_report_pending") {
    const report = ctx.dailyReport && typeof ctx.dailyReport === "object"
      ? ctx.dailyReport
      : null;
    if (!report || report.isEmpty) return null;
    return {
      type: "daily_report",
      data: {
        date: report.date,
        dateLabel: formatGinaDayLabel(report.date, locale),
        occupiedHours: report.occupiedHours || [],
        pendingBrief: report.pendingBrief || [],
        folderProgress: report.folderProgress || [],
        conflicts: report.conflicts || [],
        proposals: report.proposals || [],
        hasConflicts: Boolean(report.hasConflicts),
        conflictCount: report.conflictCount || 0,
        occupiedCount: report.occupiedCount || 0,
        pendingCount: report.pendingCount || 0,
        struckCount: report.struckCount || 0,
        hasRoomToday: Boolean(report.hasRoomToday),
        lastFinishAt: report.lastFinishAt || null,
        dayComplete: Boolean(report.dayComplete),
        isEmpty: false,
        hasConflictHighlight: Boolean(report.hasConflicts),
      },
    };
  }

  if (family === "daily_report_move" || family === "daily_report_move_preview") {
    const report = ctx.dailyReport && typeof ctx.dailyReport === "object"
      ? ctx.dailyReport
      : null;
    const proposals = report?.proposals || ctx.proposals || [];
    return {
      type: "daily_report_move_preview",
      data: {
        proposals,
        count: proposals.length,
        applied: Boolean(ctx.applied),
      },
    };
  }

  if (family === "schedule_recovery_brief") {
    const markable = asDocs(ctx.markableSlots?.length ? ctx.markableSlots : ctx.passedSlots);
    const source = markable.length ? markable : asDocs(ctx.documents).filter((d) => isPassedSlot(d, now));
    return {
      type: "schedule_sheet",
      data: attachRecoveryMeta({
        date: ctx.date,
        dateLabel: formatGinaDayLabel(ctx.date, locale),
        groups: groupDocsForScheduleSheet(source, now),
        documents: source
          .slice()
          .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
          .map((d) => mapDocRow(d, now)),
        highlightPassedSlots: true,
        recoveryPhase: "brief",
      }, ctx, now),
    };
  }

  if (family === "schedule_recovery_mark" || family === "schedule_recovery_postpone") {
    const isMark = family === "schedule_recovery_mark";
    if (isMark) {
      const slots = asDocs(ctx.markableSlots?.length ? ctx.markableSlots : ctx.passedSlots);
      return {
        type: "recovery_preview",
        data: {
          intent: "mark_past_due",
          documents: slots.map((d) => mapDocRow(d, now)),
          count: slots.length,
          firstPendingTitle: ctx.firstPendingTitle || slots[0]?.title || null,
        },
      };
    }

    const todayDocs = asDocs(ctx.documents);
    const cascade = buildCascadeSchedulePreview(todayDocs, now);
    return {
      type: "recovery_preview",
      data: {
        intent: "postpone_schedule",
        documents: cascade.map((d) => ({
          ...mapDocRow(d, now),
          proposedTime: formatGinaTimeRange(d.proposedAnchorAt, d.proposedAnchorFinishAt, locale),
          proposedAnchorAt: d.proposedAnchorAt,
          proposedAnchorFinishAt: d.proposedAnchorFinishAt,
        })),
        cascade,
        count: cascade.length,
        firstPendingTitle: ctx.firstPendingTitle || cascade[0]?.title || null,
      },
    };
  }

  if (family === "schedule_recovery_applied") {
    const intent = ctx.recoveryIntent === "postpone_schedule" ? "postpone_schedule" : "mark_past_due";
    const docs = asDocs(ctx.documents);
    return {
      type: "recovery_preview",
      data: {
        intent,
        applied: true,
        documents: docs.map((d) => mapDocRow({
          ...d,
          status: intent === "mark_past_due" ? "past_due" : d.status,
        }, now)),
        count: docs.length,
      },
    };
  }

  if (family === "incomplete" || family === "past_due") {
    if (family === "past_due" && ctx.documents && !ctx.pastDue) {
      return {
        type: "incomplete",
        data: {
          pastDue: asDocs(ctx.documents).map((d) => mapDocRow(d, now)),
          upcoming: [],
          reserved: [],
          longTerm: [],
        },
      };
    }
    const pastDue = asDocs(ctx.pastDue).map((d) => mapDocRow(d, now));
    const upcoming = asDocs(ctx.upcoming).map((d) => mapDocRow(d, now));
    const reserved = asDocs(ctx.reserved).map((d) => mapDocRow(d, now));
    const near = upcoming.filter((d) => d.daysUntilDue != null && d.daysUntilDue <= 14);
    const longTerm = upcoming.filter((d) => d.daysUntilDue == null || d.daysUntilDue > 14);
    return {
      type: "incomplete",
      data: {
        pastDue,
        upcoming: near,
        reserved,
        longTerm: [...longTerm, ...reserved],
      },
    };
  }

  if (family === "conflicts") {
    const pairs = asDocs(ctx.conflicts);
    return {
      type: "conflicts",
      data: {
        total: pairs.length,
        conflicts: pairs.map((c) => {
          const docs = asDocs(c.documents);
          const a = docs[0] || null;
          const b = docs[1] || null;
          return {
            date: c.date || null,
            a: a ? { title: a.title, folder: a.folder, time: a.time } : null,
            b: b ? { title: b.title, folder: b.folder, time: b.time } : null,
            overlap: c.overlapTime || null,
            severity: c.severity || null,
          };
        }),
      },
    };
  }

  if (family === "folder_summary" || family === "department") {
    if (ctx.notFound) {
      return {
        type: "table",
        data: {
          title: locale === "en" ? "Folder" : "Folder",
          documents: [],
          empty: true,
          listAll: true,
          notFound: true,
          department: null,
        },
      };
    }
    if (ctx.aggregated || ctx.folderName) {
      const agg = ctx.aggregated || {};
      const docs = asDocs(ctx.documents).map((d) => mapDocRow(d, now));
      const total = agg.total || docs.length || 0;
      const completed = agg.completed || 0;
      const pct = total ? Math.round((completed / total) * 100) : 0;
      const listAll = Boolean(ctx.listAll) || wantsTable || /\b(todos|all|lista|list)\b/.test(q);
      if (listAll || total === 0) {
        return {
          type: "table",
          data: {
            title: ctx.folderName
              ? (locale === "en" ? `Documents · ${ctx.folderName}` : `Documentos · ${ctx.folderName}`)
              : (locale === "en" ? "Documents" : "Documentos"),
            documents: docs,
            department: ctx.departmentName || ctx.department || null,
            category: ctx.category || null,
            folder: ctx.folderName || null,
            empty: total === 0,
            listAll: true,
            hierarchy: {
              department: ctx.departmentName || ctx.department || null,
              category: ctx.category || null,
              folder: ctx.folderName || null,
            },
          },
        };
      }
      return {
        type: "folder_summary",
        data: {
          hierarchy: {
            department: ctx.departmentName || ctx.department || null,
            category: ctx.category || null,
            folder: ctx.folderName || null,
          },
          folderName: ctx.folderName || null,
          department: ctx.departmentName || ctx.department || null,
          category: ctx.category || null,
          total,
          completed,
          inProgress: agg.inProgress || 0,
          notStarted: agg.notStarted || 0,
          pastDue: agg.pastDue || 0,
          percentComplete: pct,
          documents: docs,
          nextDue: docs.find((d) => d.isPastDue || d.status === "past_due")
            || docs[0]
            || null,
          empty: total === 0,
          listAll: false,
        },
      };
    }
    // department filter result — always emit viz (including empty corpus)
    const docs = asDocs(ctx.documents).map((d) => mapDocRow(d, now));
    const empty = Boolean(ctx.empty) || docs.length === 0;
    const listAll = Boolean(ctx.listAll) || wantsTable || /\b(todos|all|lista|list)\b/.test(q);
    return {
      type: listAll || empty ? "table" : (wantsTable ? "table" : "folder_summary"),
      data: (listAll || empty || wantsTable)
        ? {
            title: ctx.department
              ? (locale === "en" ? `Documents · ${ctx.department}` : `Documentos · ${ctx.department}`)
              : (locale === "en" ? "Documents" : "Documentos"),
            documents: docs,
            department: ctx.department || null,
            empty,
            listAll: true,
            folderCount: ctx.folderCount ?? null,
            documentCount: ctx.documentCount ?? docs.length,
            categoryCount: ctx.categoryCount ?? null,
            categories: Array.isArray(ctx.categories) ? ctx.categories : [],
          }
        : {
            hierarchy: {
              department: ctx.department || null,
              category: ctx.category || null,
              folder: null,
            },
            folderName: ctx.department || null,
            department: ctx.department || null,
            category: ctx.category || null,
            total: docs.length,
            completed: docs.filter((d) => d.status === "completed").length,
            inProgress: docs.filter((d) => d.status === "in_progress").length,
            notStarted: docs.filter((d) => !d.status || d.status === "not_started").length,
            pastDue: docs.filter((d) => d.status === "past_due").length,
            percentComplete: docs.length
              ? Math.round((docs.filter((d) => d.status === "completed").length / docs.length) * 100)
              : 0,
            documents: docs,
            nextDue: null,
            empty,
            listAll: false,
          },
    };
  }

  if (family === "this_week" || family === "next_week" || family === "date_range" || family === "tomorrow") {
    const docs = asDocs(ctx.documents).map((d) => mapDocRow(d, now));
    if (wantsTimeline) {
      return {
        type: "timeline",
        data: {
          date: ctx.week || ctx.range || null,
          dateLabel: ctx.week || ctx.range || (locale === "en" ? "Schedule" : "Horarios"),
          documents: docs,
        },
      };
    }
    return {
      type: "table",
      data: {
        title: ctx.week || ctx.range || (locale === "en" ? "Documents" : "Documentos"),
        documents: docs,
      },
    };
  }

  if (family === "status" || family === "blogs" || family === "inventory" || family === "gina_scope") {
    const docs = asDocs(ctx.documents || ctx.all || []).map((d) => mapDocRow(d, now));
    if (!docs.length && ctx.today) {
      return buildGinaVisualization("today", ctx.today, opts);
    }
    if (!docs.length) return null;
    return {
      type: "table",
      data: {
        title: locale === "en" ? "Documents" : "Documentos",
        documents: docs,
      },
    };
  }

  if (family === "document_detail" && ctx.title) {
    return {
      type: "table",
      data: {
        title: ctx.title,
        documents: [mapDocRow(ctx)],
      },
    };
  }

  if (family === "default_overview" && ctx.incomplete) {
    return buildGinaVisualization("incomplete", ctx.incomplete, opts);
  }

  return null;
}
