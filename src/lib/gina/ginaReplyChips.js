/**
 * Fixed reply chips for Gina progressive funnel (ids stable; labels user-facing).
 */

/**
 * @typedef {{ id: string, label: string, text: string, primary?: boolean }} GinaReplyChip
 */

/**
 * Opening chips under the first Gina message.
 * @param {{ locale?: string }} [opts]
 * @returns {GinaReplyChip[]}
 */
export function buildGinaOpeningChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "today",
      label: en ? "What's for today?" : "¿Qué tenemos para hoy?",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
      primary: true,
    },
    {
      id: "today_schedule",
      label: en ? "Today's schedule" : "Horarios de hoy",
      text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
    },
    {
      id: "past_due",
      label: en ? "Past due" : "Vencidos",
      text: en ? "Show me past due documents" : "Muéstrame los documentos vencidos",
    },
    {
      id: "in_progress",
      label: en ? "In progress" : "En progreso",
      text: en ? "Show me in progress documents" : "Muéstrame los documentos en progreso",
    },
  ];
}

/**
 * @param {object | null | undefined} todayScope
 * @returns {{ name: string, documents: number, pastDue: number, folders: number }[]}
 */
export function rollupTodayByDepartment(todayScope) {
  const docs = Array.isArray(todayScope?.documents) ? todayScope.documents : [];
  /** @type {Map<string, { name: string, documents: number, pastDue: number, folderIds: Set<string> }>} */
  const map = new Map();

  for (const d of docs) {
    const name = String(d.departmentName || d.department || "—").trim() || "—";
    const cur = map.get(name) || {
      name,
      documents: 0,
      pastDue: 0,
      folderIds: new Set(),
    };
    cur.documents += 1;
    if (d.isPastDue || d.status === "past_due") cur.pastDue += 1;
    const folderKey = d.parentFolderId || d.parentFolderName || d.folder || "";
    if (folderKey) cur.folderIds.add(String(folderKey));
    map.set(name, cur);
  }

  // Also count active folders without docs in the rollup (window-only)
  for (const f of todayScope?.activeFolders || []) {
    const name = String(f.department || "—").trim() || "—";
    const cur = map.get(name) || {
      name,
      documents: 0,
      pastDue: 0,
      folderIds: new Set(),
    };
    if (f.id) cur.folderIds.add(String(f.id));
    else if (f.name) cur.folderIds.add(String(f.name));
    map.set(name, cur);
  }

  return [...map.values()]
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
}

/**
 * Chips after department_cards viz.
 * @param {{ departments?: { name: string }[], recommended?: string | null, locale?: string }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildTodayDepartmentChips(opts = {}) {
  const en = opts.locale === "en";
  const recommended = opts.recommended || opts.departments?.[0]?.name || null;
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if (recommended && recommended !== "—") {
    chips.push({
      id: `focus_${recommended}`,
      label: en ? `Focus on ${recommended}` : `Enfocarme en ${recommended}`,
      text: en
        ? `Focus today on ${recommended}`
        : `Enfocarme hoy en ${recommended}`,
      primary: true,
    });
  }
  chips.push({
    id: "today_schedule",
    label: en ? "Today's schedule" : "Horarios de hoy",
    text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
  });
  chips.push({
    id: "past_due",
    label: en ? "Past due" : "Vencidos",
    text: en ? "Show me past due documents" : "Muéstrame los documentos vencidos",
  });
  return chips;
}

/**
 * Chips inside a department focus.
 * @param {{ department: string, overdueHours?: number, fromNow?: number, locale?: string }} opts
 */
export function buildDeptFocusChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = opts.department || "";
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if ((opts.overdueHours || 0) > 0) {
    chips.push({
      id: "overdue_hours",
      label: en ? "Overdue hours" : "Horas vencidas",
      text: en
        ? `Show overdue hours today in ${dept}`
        : `Muéstrame las horas vencidas de hoy en ${dept}`,
      primary: true,
    });
  }
  if ((opts.fromNow || 0) > 0 || (opts.overdueHours || 0) === 0) {
    chips.push({
      id: "from_now",
      label: en ? "From now" : "Desde ahora",
      text: en
        ? `Show from now today in ${dept}`
        : `Muéstrame desde ahora hoy en ${dept}`,
      primary: (opts.overdueHours || 0) === 0,
    });
  }
  chips.push({
    id: "all_today_dept",
    label: en ? "All of today" : "Todos los de hoy",
    text: en
      ? `Show all of today in ${dept}`
      : `Muéstrame todos los de hoy en ${dept}`,
  });
  chips.push({
    id: "back_depts",
    label: en ? "Back to departments" : "Volver a departamentos",
    text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
  });
  return chips;
}

/**
 * Chips after schedule sheet / status lists.
 * @param {{ locale?: string }} [opts]
 */
export function buildScheduleSheetChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "today_depts",
      label: en ? "Departments today" : "Departamentos de hoy",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
    },
    {
      id: "past_due",
      label: en ? "Past due" : "Vencidos",
      text: en ? "Show me past due documents" : "Muéstrame los documentos vencidos",
    },
  ];
}

/**
 * Status confirm chips (all depts vs pick one).
 * @param {{ statusLabel: string, locale?: string }} opts
 */
export function buildStatusConfirmChips(opts = {}) {
  const en = opts.locale === "en";
  const status = opts.statusLabel || (en ? "this status" : "este status");
  return [
    {
      id: "status_all",
      label: en ? "All departments" : "Todos los departamentos",
      text: en
        ? `Yes, show ${status} across all departments`
        : `Sí, muéstrame ${status} de todos los departamentos`,
      primary: true,
    },
    {
      id: "status_pick",
      label: en ? "Pick a department" : "Elegir un departamento",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
    },
  ];
}

/**
 * Deterministic funnel headline (prefers over long Groq dump for today cards).
 * @param {{ type?: string, data?: object } | null} visualization
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaFunnelHeadline(visualization, opts = {}) {
  const en = opts.locale === "en";
  if (!visualization?.type) return null;
  const data = visualization.data || {};

  if (visualization.type === "department_cards") {
    const depts = Array.isArray(data.departments) ? data.departments : [];
    const n = depts.length;
    const rec = data.recommended || depts[0]?.name;
    if (n === 0) {
      return en
        ? "Nothing scheduled for today in your departments."
        : "Hoy no hay trabajo programado en tus departamentos.";
    }
    if (n === 1) {
      return en
        ? `Today’s work is in **${rec}**. Want to focus here?`
        : `Hoy el trabajo está en **${rec}**. ¿Quieres enfocarte aquí?`;
    }
    return en
      ? `Today you have work in **${n} departments**. The heaviest / most behind is **${rec}**. Want to start there?`
      : `Hoy tienes trabajo en **${n} departamentos**. El de mayor carga o atraso es **${rec}**. ¿Empezamos por ahí?`;
  }

  if (visualization.type === "dept_summary") {
    const name = data.department || "—";
    const overdue = data.overdueHours ?? 0;
    const fromNow = data.fromNow ?? 0;
    const folders = data.folders ?? 0;
    const docs = data.documents ?? 0;
    if (overdue > 0 && fromNow > 0) {
      return en
        ? `In **${name}**: ${folders} active folders, ${docs} docs. ${overdue} hour slot(s) already passed, ${fromNow} from now. Overdue hours first, or from now?`
        : `En **${name}**: ${folders} folders activos, ${docs} docs. ${overdue} horario(s) ya pasaron; ${fromNow} desde ahora. ¿Ves primero las horas vencidas, o el schedule desde ahora?`;
    }
    if (overdue > 0) {
      return en
        ? `In **${name}**: ${docs} docs today — ${overdue} hour slot(s) already passed.`
        : `En **${name}**: ${docs} docs hoy — ${overdue} horario(s) ya pasaron.`;
    }
    return en
      ? `In **${name}**: ${folders} folders, ${docs} docs for today.`
      : `En **${name}**: ${folders} folders, ${docs} docs para hoy.`;
  }

  if (visualization.type === "schedule_sheet") {
    const n = Array.isArray(data.groups) ? data.groups.reduce((acc, g) => acc + (g.folders?.reduce((a, f) => a + (f.documents?.length || 0), 0) || 0), 0) : (data.documents?.length || 0);
    return en
      ? `Here’s today’s schedule sheet (${n} timed items).`
      : `Aquí está el sheet de horarios de hoy (${n} ítems).`;
  }

  return null;
}

/**
 * Attach chips for a visualization + family.
 * @param {{ family?: string, visualization?: { type?: string, data?: object } | null, locale?: string }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildGinaReplyChips(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const viz = opts.visualization;
  const type = viz?.type;
  const data = viz?.data || {};

  if (type === "department_cards") {
    return buildTodayDepartmentChips({
      departments: data.departments,
      recommended: data.recommended,
      locale,
    });
  }
  if (type === "dept_summary") {
    return buildDeptFocusChips({
      department: data.department,
      overdueHours: data.overdueHours,
      fromNow: data.fromNow,
      locale,
    });
  }
  if (type === "schedule_sheet" || type === "timeline") {
    return buildScheduleSheetChips({ locale });
  }
  if (opts.family === "status" || opts.family === "past_due" || opts.family === "incomplete") {
    // After list shown — light nav chips
    return buildScheduleSheetChips({ locale });
  }
  return [];
}
