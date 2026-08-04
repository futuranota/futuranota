import { isPassedSlot, buildCascadeSchedulePreview } from "./ginaScheduleRecovery.js";

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
  const b = finish ? new Date(finish) : null;
  if (a && Number.isNaN(a.getTime())) return locale === "en" ? "Flexible" : "Flexible";
  if (!a) return locale === "en" ? "Flexible" : "Flexible";
  const opts = { hour: "numeric", minute: "2-digit" };
  const loc = locale === "en" ? "en-US" : "es-ES";
  if (b && !Number.isNaN(b.getTime())) {
    return `${a.toLocaleTimeString(loc, opts)} – ${b.toLocaleTimeString(loc, opts)}`;
  }
  return a.toLocaleTimeString(loc, opts);
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

function mapDocRow(d, now = null) {
  const clock = now instanceof Date ? now : new Date();
  return {
    id: d.id || null,
    title: d.title || "Untitled",
    status: d.status || null,
    folder: d.folder || d.parentFolderName || null,
    department: d.department || d.departmentName || null,
    category: d.category || null,
    time: d.time
      || formatGinaTimeRange(d.anchorAt || d.startedAt, d.anchorFinishAt || d.dueAt),
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
    sampleDocuments: docs.slice(0, 6).map(mapDocRow),
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
            .map(mapDocRow),
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
            .map(mapDocRow),
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
          documents: docs.map(mapDocRow),
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

    // Progressive first step: department cards only (no doc dump).
    return {
      type: "department_cards",
      data: buildDepartmentCardsData(today, locale),
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
          pastDue: asDocs(ctx.documents).map(mapDocRow),
          upcoming: [],
          reserved: [],
          longTerm: [],
        },
      };
    }
    const pastDue = asDocs(ctx.pastDue).map(mapDocRow);
    const upcoming = asDocs(ctx.upcoming).map(mapDocRow);
    const reserved = asDocs(ctx.reserved).map(mapDocRow);
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
    if (ctx.aggregated || ctx.folderName) {
      const agg = ctx.aggregated || {};
      const total = agg.total || asDocs(ctx.documents).length || 0;
      const completed = agg.completed || 0;
      const pct = total ? Math.round((completed / total) * 100) : 0;
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
          documents: asDocs(ctx.documents).map(mapDocRow),
          nextDue: asDocs(ctx.documents).find((d) => d.isPastDue || d.status === "past_due")
            || asDocs(ctx.documents)[0]
            || null,
        },
      };
    }
    // department filter result
    const docs = asDocs(ctx.documents).map(mapDocRow);
    if (wantsTable || docs.length) {
      return {
        type: wantsTable ? "table" : "folder_summary",
        data: wantsTable
          ? { title: ctx.department || "Department", documents: docs }
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
            },
      };
    }
  }

  if (family === "this_week" || family === "next_week" || family === "date_range" || family === "tomorrow") {
    const docs = asDocs(ctx.documents).map(mapDocRow);
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
    const docs = asDocs(ctx.documents || ctx.all || []).map(mapDocRow);
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
