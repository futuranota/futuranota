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

function mapDocRow(d) {
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
 */
export function groupDocsForScheduleSheet(docs) {
  /** @type {Map<string, Map<string, object[]>>} */
  const byDept = new Map();
  for (const raw of docs) {
    const row = mapDocRow(raw);
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
  return {
    date: today.date,
    dateLabel: formatGinaDayLabel(today.date, locale),
    department: dept,
    documents: docs.length,
    folders: folderIds.size,
    overdueHours: overdueDocs.length,
    fromNow: fromNowDocs.length,
    pastDue: docs.filter((d) => d.isPastDue || d.status === "past_due").length,
    byHierarchy: Array.isArray(today.byHierarchy) ? today.byHierarchy : [],
    sampleDocuments: docs.slice(0, 6).map(mapDocRow),
  };
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
  const now = opts.now instanceof Date ? opts.now : new Date();
  const ctx = toolContext && typeof toolContext === "object" ? toolContext : null;
  if (!ctx) return null;

  const wantsTable = /\b(detalle|detail|tabla|table|lista completa)\b/.test(q);
  const wantsTimeline = /\b(horario|horarios|timeline|agenda|sheet)\b/.test(q);
  const wantsOverdueHours = /\b(horas?\s+vencid|overdue\s+hours?)\b/.test(q);
  const wantsFromNow = /\bdesde\s+ahora\b/.test(q) || /\bfrom\s+now\b/.test(q);
  const wantsAllToday = /\btodos\s+los\s+de\s+hoy\b/.test(q) || /\ball\s+of\s+today\b/.test(q);
  const wantsFocus = /\benfoc\w*\b/.test(q) || /\bfocus\s+today\s+on\b/.test(q);

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

    if (wantsTimeline || (wantsAllToday && today.filters?.department)) {
      const source = wantsTimeline || wantsAllToday || wantsOverdueHours || wantsFromNow
        ? docs
        : asDocs(today.documents);
      return {
        type: "schedule_sheet",
        data: {
          date: today.date,
          dateLabel: formatGinaDayLabel(today.date, locale),
          groups: groupDocsForScheduleSheet(source),
          documents: source
            .slice()
            .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
            .map(mapDocRow),
        },
      };
    }

    if (wantsTable) {
      return {
        type: "table",
        data: {
          title: locale === "en" ? "Today" : "Hoy",
          documents: docs.map(mapDocRow),
        },
      };
    }

    const hasDeptFilter = Boolean(today.filters?.department);
    if (hasDeptFilter || wantsFocus) {
      if (wantsOverdueHours || wantsFromNow || wantsAllToday) {
        return {
          type: "schedule_sheet",
          data: {
            date: today.date,
            dateLabel: formatGinaDayLabel(today.date, locale),
            groups: groupDocsForScheduleSheet(docs),
            documents: docs
              .slice()
              .sort((a, b) => String(a.anchorAt || "").localeCompare(String(b.anchorAt || "")))
              .map(mapDocRow),
          },
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
