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

/**
 * @param {string} family
 * @param {unknown} toolContext
 * @param {{ locale?: string, userText?: string }} [opts]
 * @returns {{ type: string, data: object } | null}
 */
export function buildGinaVisualization(family, toolContext, opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const q = String(opts.userText || "").toLowerCase();
  const ctx = toolContext && typeof toolContext === "object" ? toolContext : null;
  if (!ctx) return null;

  const wantsTable = /\b(detalle|detail|tabla|table|lista completa)\b/.test(q);
  const wantsTimeline = /\b(horario|horarios|timeline|agenda)\b/.test(q);

  if (family === "focus_open") return null;

  if (family === "today" || (family === "default_overview" && ctx.today)) {
    const today = family === "today" ? ctx : ctx.today;
    if (!today || typeof today !== "object") return null;
    if (wantsTimeline) {
      return {
        type: "timeline",
        data: {
          date: today.date,
          dateLabel: formatGinaDayLabel(today.date, locale),
          documents: asDocs(today.documents)
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
          documents: asDocs(today.documents).map(mapDocRow),
        },
      };
    }
    const bd = today.breakdown || {};
    return {
      type: "today_scope",
      data: {
        date: today.date,
        dateLabel: formatGinaDayLabel(today.date, locale),
        total: today.totalDocumentsToday ?? asDocs(today.documents).length,
        notStarted: bd.notStarted || 0,
        inProgress: bd.inProgress || 0,
        pastDue: bd.pastDue || 0,
        submitted: bd.submitted || 0,
        completed: 0,
        documents: asDocs(today.documents).map(mapDocRow),
        byHierarchy: Array.isArray(today.byHierarchy) ? today.byHierarchy : [],
        nextDeadline: today.nextDeadline
          ? {
              document: today.nextDeadline.title,
              time: formatGinaTimeRange(today.nextDeadline.time, null, locale),
              folder: today.nextDeadline.folder,
              department: today.nextDeadline.department,
              category: today.nextDeadline.category,
            }
          : null,
        emptyHint: locale === "en"
          ? "No pending documents in this scope. Explore a department or a document you have in mind?"
          : "Sin documentos pendientes en este alcance. ¿Exploramos un departamento o un documento que tengas en mente?",
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
