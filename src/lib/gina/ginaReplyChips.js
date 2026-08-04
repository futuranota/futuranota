/**
 * Fixed reply chips for Gina progressive funnel (ids stable; labels user-facing).
 */

/**
 * @typedef {{ id: string, label: string, text: string, primary?: boolean }} GinaReplyChip
 */

const STATUS_CHIP_META = {
  past_due: { es: "Vencidos", en: "Past due", key: "past_due" },
  in_progress: { es: "En progreso", en: "In progress", key: "in_progress" },
  not_started: { es: "Sin empezar", en: "Not started", key: "not_started" },
  reserved: { es: "Reserved", en: "Reserved", key: "reserved" },
  submitted: { es: "Submitted", en: "Submitted", key: "submitted" },
  completed: { es: "Completed", en: "Completed", key: "completed" },
};

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
  ];
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
  return chips;
}

/**
 * After focusing a department: expand modes.
 * @param {{ department: string, locale?: string }} opts
 */
export function buildDeptFocusChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = opts.department || "";
  return [
    {
      id: "expand_categories",
      label: en ? "Expand by categories" : "Expandir por categorías",
      text: en
        ? `Expand by categories today in ${dept}`
        : `Expandir por categorías hoy en ${dept}`,
      primary: true,
    },
    {
      id: "expand_status",
      label: en ? "Expand by status" : "Expandir status",
      text: en
        ? `Expand status today in ${dept}`
        : `Expandir status hoy en ${dept}`,
    },
    {
      id: "expand_folders",
      label: en ? "Expand by folders" : "Expandir por folders",
      text: en
        ? `Expand by folders today in ${dept}`
        : `Expandir por folders hoy en ${dept}`,
    },
    {
      id: "back_depts",
      label: en ? "Back to departments" : "Volver a departamentos",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
    },
  ];
}

/**
 * Status menu chips (only statuses with count > 0).
 * @param {{ department: string, statuses?: { key: string, count: number }[], locale?: string }} opts
 */
export function buildDeptStatusMenuChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = opts.department || "";
  const statuses = Array.isArray(opts.statuses) ? opts.statuses : [];
  /** @type {GinaReplyChip[]} */
  const chips = [];
  for (const row of statuses) {
    if (!row?.key || !(row.count > 0)) continue;
    const meta = STATUS_CHIP_META[row.key];
    if (!meta) continue;
    chips.push({
      id: `status_${row.key}`,
      label: `${en ? meta.en : meta.es} (${row.count})`,
      text: en
        ? `Status ${row.key} today in ${dept}`
        : `Status ${row.key} hoy en ${dept}`,
      primary: chips.length === 0,
    });
  }
  chips.push({
    id: "back_dept",
    label: en ? `Back to ${dept}` : `Volver a ${dept}`,
    text: en ? `Focus today on ${dept}` : `Enfocarme hoy en ${dept}`,
  });
  return chips;
}

/**
 * Folder menu chips.
 * @param {{ department: string, folders?: { name: string, documents?: number }[], locale?: string }} opts
 */
export function buildDeptFolderMenuChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = opts.department || "";
  const folders = Array.isArray(opts.folders) ? opts.folders : [];
  /** @type {GinaReplyChip[]} */
  const chips = folders.slice(0, 12).map((f, i) => ({
    id: `folder_${f.name}`,
    label: f.documents != null ? `${f.name} (${f.documents})` : f.name,
    text: en
      ? `Folder ${f.name} today in ${dept}`
      : `Folder ${f.name} hoy en ${dept}`,
    primary: i === 0,
  }));
  chips.push({
    id: "back_dept",
    label: en ? `Back to ${dept}` : `Volver a ${dept}`,
    text: en ? `Focus today on ${dept}` : `Enfocarme hoy en ${dept}`,
  });
  return chips;
}

/**
 * Category menu chips.
 * @param {{ department: string, categories?: { name: string, documents?: number }[], locale?: string }} opts
 */
export function buildDeptCategoryMenuChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = opts.department || "";
  const categories = Array.isArray(opts.categories) ? opts.categories : [];
  /** @type {GinaReplyChip[]} */
  const chips = [
    {
      id: "cat_all",
      label: "All",
      text: en
        ? `Category All today in ${dept}`
        : `Categoría All hoy en ${dept}`,
      primary: true,
    },
    ...categories.slice(0, 12).map((c) => ({
      id: `cat_${c.name}`,
      label: c.documents != null ? `${c.name} (${c.documents})` : c.name,
      text: en
        ? `Category ${c.name} today in ${dept}`
        : `Categoría ${c.name} hoy en ${dept}`,
    })),
  ];
  chips.push({
    id: "back_dept",
    label: en ? `Back to ${dept}` : `Volver a ${dept}`,
    text: en ? `Focus today on ${dept}` : `Enfocarme hoy en ${dept}`,
  });
  return chips;
}

/**
 * Nav after a detail list inside a department.
 * @param {{ department: string, locale?: string }} opts
 */
export function buildDeptDetailNavChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = opts.department || "";
  return [
    {
      id: "expand_status",
      label: en ? "Expand by status" : "Expandir status",
      text: en
        ? `Expand status today in ${dept}`
        : `Expandir status hoy en ${dept}`,
    },
    {
      id: "expand_folders",
      label: en ? "Expand by folders" : "Expandir por folders",
      text: en
        ? `Expand by folders today in ${dept}`
        : `Expandir por folders hoy en ${dept}`,
    },
    {
      id: "expand_categories",
      label: en ? "Expand by categories" : "Expandir por categorías",
      text: en
        ? `Expand by categories today in ${dept}`
        : `Expandir por categorías hoy en ${dept}`,
    },
    {
      id: "back_depts",
      label: en ? "Back to departments" : "Volver a departamentos",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
    },
  ];
}

/**
 * Chips after schedule sheet.
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
  ];
}

/**
 * Deterministic funnel headline.
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
    return en
      ? `You’re in **${name}**. How do you want to view today’s schedules?`
      : `Estás en **${name}**. ¿Cómo quieres visualizar los horarios?`;
  }

  if (visualization.type === "dept_status_menu") {
    const name = data.department || "—";
    return en
      ? `You’re in **${name}**. Pick a status:`
      : `Estás en **${name}**. Elige un status:`;
  }

  if (visualization.type === "dept_status_list") {
    const name = data.department || "—";
    const label = data.statusLabel || data.status || "status";
    const n = Array.isArray(data.documents) ? data.documents.length : 0;
    return en
      ? `**${label}** in **${name}** today — ${n} document(s).`
      : `**${label}** en **${name}** hoy — ${n} documento(s).`;
  }

  if (visualization.type === "dept_folder_menu") {
    const name = data.department || "—";
    const n = Array.isArray(data.folders) ? data.folders.length : 0;
    return en
      ? `**${n}** folder(s) with today’s work in **${name}**. Pick one.`
      : `**${n}** folder(s) con trabajo de hoy en **${name}**. Elige uno.`;
  }

  if (visualization.type === "dept_folder_detail") {
    const folder = data.folder || "—";
    const n = Array.isArray(data.documents) ? data.documents.length : 0;
    return en
      ? `Folder **${folder}** today — ${n} document(s).`
      : `Folder **${folder}** hoy — ${n} documento(s).`;
  }

  if (visualization.type === "dept_category_menu") {
    const name = data.department || "—";
    const n = Array.isArray(data.categories) ? data.categories.length : 0;
    return en
      ? `**${n}** categor${n === 1 ? "y" : "ies"} today in **${name}**. Pick one.`
      : `**${n}** categor${n === 1 ? "ía" : "ías"} hoy en **${name}**. Elige una.`;
  }

  if (visualization.type === "dept_category_detail") {
    const cat = data.category || "—";
    const n = Array.isArray(data.documents) ? data.documents.length : 0;
    return en
      ? `Category **${cat}** today — ${n} document(s) across folders.`
      : `Categoría **${cat}** hoy — ${n} documento(s) en folders.`;
  }

  if (visualization.type === "schedule_sheet") {
    const n = Array.isArray(data.groups)
      ? data.groups.reduce((acc, g) => acc + (g.folders?.reduce((a, f) => a + (f.documents?.length || 0), 0) || 0), 0)
      : (data.documents?.length || 0);
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
    // Expand modes live in the viz; reply row only goes back.
    return [
      {
        id: "back_depts",
        label: locale === "en" ? "Back to departments" : "Volver a departamentos",
        text: locale === "en" ? "What do we have for today?" : "¿Qué tenemos para hoy?",
      },
    ];
  }
  if (type === "dept_status_menu") {
    // Status picks live in the viz (color + icon chips); reply row only navigates back.
    return [
      {
        id: "back_dept",
        label: locale === "en"
          ? `Back to ${data.department || "department"}`
          : `Volver a ${data.department || "departamento"}`,
        text: locale === "en"
          ? `Focus today on ${data.department || ""}`
          : `Enfocarme hoy en ${data.department || ""}`,
      },
    ];
  }
  if (type === "dept_folder_menu") {
    return buildDeptFolderMenuChips({
      department: data.department,
      folders: data.folders,
      locale,
    });
  }
  if (type === "dept_category_menu") {
    return buildDeptCategoryMenuChips({
      department: data.department,
      categories: data.categories,
      locale,
    });
  }
  if (
    type === "dept_status_list"
    || type === "dept_folder_detail"
    || type === "dept_category_detail"
  ) {
    return buildDeptDetailNavChips({
      department: data.department,
      locale,
    });
  }
  if (type === "schedule_sheet" || type === "timeline") {
    return buildScheduleSheetChips({ locale });
  }
  if (opts.family === "status" || opts.family === "past_due" || opts.family === "incomplete") {
    return buildScheduleSheetChips({ locale });
  }
  return [];
}

export { STATUS_CHIP_META };
