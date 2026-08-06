import {
  buildScheduleRecoveryAck,
  buildScheduleRecoveryAppliedText,
  buildScheduleRecoveryBriefText,
  buildScheduleRecoveryChips,
  buildScheduleRecoveryConfirmChips,
  buildScheduleRecoveryGateChips,
} from "./ginaScheduleRecovery.js";
import {
  buildFindDocumentChips,
  buildFindDocumentMessage,
} from "./ginaFindDocument.js";
import {
  buildDailyReportAppliedText,
  buildDailyReportChips,
  buildDailyReportMoveConfirmChips,
  buildDailyReportMovePreviewText,
  buildDailyReportOfferText,
} from "./ginaDailyReport.js";
import { getGinaTestQuickLinks } from "./ginaTestQuickLinks.js";

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
  const testLinks = getGinaTestQuickLinks({ locale: opts.locale });
  return [
    {
      id: "today",
      label: en ? "What's for today?" : "¿Qué tenemos para hoy?",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
      primary: true,
    },
    ...testLinks.map((link) => ({
      id: link.id,
      label: link.label,
      text: link.text,
    })),
    {
      id: "schedule",
      label: en ? "Today's schedule" : "Horarios de hoy",
      text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
    },
  ];
}

/**
 * Chips after category count.
 * @param {{
 *   categories?: { name: string }[],
 *   department?: string | null,
 *   empty?: boolean,
 *   locale?: string,
 * }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildCountCategoriesChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = String(opts.department || "").trim();
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if (opts.empty) {
    chips.push({
      id: "back_depts",
      label: en ? "Back to departments" : "Volver a departamentos",
      text: en
        ? "How many departments do we have in total?"
        : "¿Cuántos departamentos tenemos en general?",
    });
    if (dept) {
      chips.push({
        id: `count_folders_${dept}`,
        label: en ? `Folders in ${dept}` : `Folders en ${dept}`,
        text: en
          ? `How many folders do we have in ${dept}?`
          : `¿Cuántos folders tenemos en ${dept}?`,
      });
    }
    return chips;
  }
  const categories = Array.isArray(opts.categories) ? opts.categories : [];
  for (const cat of categories.slice(0, 6)) {
    const name = String(cat?.name || "").trim();
    if (!name || !dept) continue;
    chips.push({
      id: `cat_${name}`,
      label: en ? `Category ${name}` : `Categoría ${name}`,
      text: en
        ? `Category ${name} today in ${dept}`
        : `Categoría ${name} hoy en ${dept}`,
      primary: chips.length === 0,
    });
  }
  if (dept) {
    chips.push({
      id: `count_folders_${dept}`,
      label: en ? `Folders in ${dept}` : `Folders en ${dept}`,
      text: en
        ? `How many folders do we have in ${dept}?`
        : `¿Cuántos folders tenemos en ${dept}?`,
    });
  }
  return chips;
}

/**
 * Chips after folder count.
 * @param {{
 *   folders?: { name: string, departmentName?: string | null }[],
 *   department?: string | null,
 *   empty?: boolean,
 *   locale?: string,
 * }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildCountFoldersChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = String(opts.department || "").trim();
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if (opts.empty) {
    chips.push({
      id: "back_depts",
      label: en ? "Back to departments" : "Volver a departamentos",
      text: en
        ? "How many departments do we have in total?"
        : "¿Cuántos departamentos tenemos en general?",
    });
    if (dept) {
      chips.push({
        id: `focus_${dept}`,
        label: en ? `Focus on ${dept}` : `Enfocarme en ${dept}`,
        text: en ? `Focus today on ${dept}` : `Enfocarme hoy en ${dept}`,
      });
    }
    return chips;
  }
  const folders = Array.isArray(opts.folders) ? opts.folders : [];
  for (const folder of folders.slice(0, 6)) {
    const name = String(folder?.name || "").trim();
    if (!name) continue;
    chips.push({
      id: `folder_docs_${name}`,
      label: en ? `Docs in ${name}` : `Docs de ${name}`,
      text: en
        ? `Show me all documents in ${name}`
        : `Dame todos los documentos del ${name}`,
      primary: chips.length === 0,
    });
  }
  if (dept) {
    chips.push({
      id: "today_schedule",
      label: en ? "Today's schedule" : "Horarios de hoy",
      text: en
        ? `Show me today's schedule in ${dept}`
        : `Muéstrame los horarios de hoy en ${dept}`,
    });
  }
  return chips;
}

/**
 * Chips after department count (corpus inventory).
 * Schedule chip only when there are scheduled docs today.
 * @param {{ departments?: { name: string }[], locale?: string, hasTodaySchedules?: boolean }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildCountDepartmentsChips(opts = {}) {
  const en = opts.locale === "en";
  const depts = Array.isArray(opts.departments) ? opts.departments : [];
  /** @type {GinaReplyChip[]} */
  const chips = [];
  for (const dept of depts.slice(0, 6)) {
    const name = String(dept?.name || "").trim();
    if (!name) continue;
    chips.push({
      id: `focus_${name}`,
      label: en ? `Focus on ${name}` : `Enfocarme en ${name}`,
      text: en ? `Focus today on ${name}` : `Enfocarme hoy en ${name}`,
      primary: chips.length === 0,
    });
  }
  if (opts.hasTodaySchedules) {
    chips.push({
      id: "today_schedule",
      label: en ? "Review today's schedule" : "Revisar horarios de hoy",
      text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
    });
  }
  return chips;
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
 * @param {{ locale?: string, hasRecoveryOffer?: boolean, recoveryPhase?: string }} [opts]
 */
export function buildScheduleSheetChips(opts = {}) {
  const en = opts.locale === "en";
  const hasRecovery = Boolean(opts.hasRecoveryOffer);
  const phase = opts.recoveryPhase || "gate";
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if (hasRecovery && phase === "brief") {
    chips.push(...buildScheduleRecoveryChips({ locale: opts.locale }));
  } else if (hasRecovery) {
    chips.push(...buildScheduleRecoveryGateChips({ locale: opts.locale }));
  } else {
    chips.push({
      id: "today_depts",
      label: en ? "Departments today" : "Departamentos de hoy",
      text: en ? "What do we have for today?" : "¿Qué tenemos para hoy?",
    });
  }
  return chips;
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

  if (visualization.type === "category_list") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const dept = data.department || null;
    const cats = Array.isArray(data.categories) ? data.categories : [];
    const n = data.count ?? cats.length;
    if (n === 0 || data.empty) {
      if (dept) {
        return en
          ? `In **${dept}** you have **zero** categories created. Add a category when you create folders so work stays organized.`
          : `En **${dept}** tienes cero categorías creadas. Agrega una categoría al crear folders para mantener el trabajo organizado.`;
      }
      return en
        ? `For **${corpus}** you have **zero** categories created.`
        : `Para **${corpus}** tienes cero categorías creadas.`;
    }
    const scope = dept
      ? (en ? `In **${dept}**` : `En **${dept}**`)
      : (en ? `For **${corpus}**` : `Para **${corpus}**`);
    const head = en
      ? `${scope} we have a total of **${n}** categor${n === 1 ? "y" : "ies"}:`
      : `${scope} tenemos un total de **${n}** categor${n === 1 ? "ía" : "ías"}:`;
    const bullets = cats
      .slice(0, 12)
      .map((c) => `• ${c.name}`)
      .join("\n");
    const ask = en
      ? "Want to open one of these categories, or count the folders next?"
      : "¿Quieres abrir una de estas categorías, o contamos los folders después?";
    return `${head}\n${bullets}\n\n${ask}`;
  }

  if (visualization.type === "folder_list") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const dept = data.department || null;
    const folders = Array.isArray(data.folders) ? data.folders : [];
    const n = data.count ?? folders.length;
    if (n === 0 || data.empty) {
      if (dept) {
        return en
          ? `In **${dept}** you have **zero** folders created. Start by creating at least one folder so you can schedule appointments afterward.`
          : `En **${dept}** tienes cero secciones de folder creadas. Comienza creando al menos un folder para después poder programar citas.`;
      }
      return en
        ? `For **${corpus}** you have **zero** folders created. Start by creating at least one folder so you can schedule appointments afterward.`
        : `Para **${corpus}** tienes cero secciones de folder creadas. Comienza creando al menos un folder para después poder programar citas.`;
    }
    const scope = dept
      ? (en ? `In **${dept}**` : `En **${dept}**`)
      : (en ? `For **${corpus}**` : `Para **${corpus}**`);
    const head = en
      ? `${scope} we have a total of **${n}** folder${n === 1 ? "" : "s"}:`
      : `${scope} tenemos un total de **${n}** folder${n === 1 ? "" : "s"}:`;
    const bullets = folders
      .slice(0, 12)
      .map((f) => `• ${f.name}`)
      .join("\n");
    const ask = en
      ? "Want to open the documents of one of these folders?"
      : "¿Quieres ver los documentos de alguno de estos folders?";
    return `${head}\n${bullets}\n\n${ask}`;
  }

  if (visualization.type === "department_list") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const depts = Array.isArray(data.departments) ? data.departments : [];
    const n = data.count ?? depts.length;
    if (n === 0) {
      return en
        ? `For **${corpus}** there are **0** departments yet.`
        : `Para **${corpus}** tenemos un total de **0** departamentos.`;
    }
    const bullets = depts
      .slice(0, 12)
      .map((d) => `• ${d.name}`)
      .join("\n");
    const head = en
      ? `For **${corpus}** we have a total of **${n}** department${n === 1 ? "" : "s"}:`
      : `Para **${corpus}** tenemos un total de **${n}** departamento${n === 1 ? "" : "s"}:`;
    const ask = data.hasTodaySchedules
      ? (en
        ? "Want to focus on one of these departments, or should we review which ones have schedules for today?"
        : "¿Quieres enfocarte en uno de estos departamentos o quieres que revisemos en cuáles de ellos tienes schedules para hoy?")
      : (en
        ? "Want to focus on one of these departments today?"
        : "¿Quieres enfocarte en uno de estos departamentos hoy?");
    return `${head}\n${bullets}\n\n${ask}`;
  }

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

  if (visualization.type === "find_results") {
    return buildFindDocumentMessage({
      locale: opts.locale,
      empty: Boolean(data.empty),
      total: data.total ?? (data.results?.length || 0),
      results: data.results || [],
      hints: data.hints || {},
      needsClarify: Boolean(data.needsClarify),
    });
  }

  if (visualization.type === "table" && (data.listAll || data.empty || data.department || data.folder)) {
    const name = data.folder || data.department || "—";
    const n = Array.isArray(data.documents) ? data.documents.length : 0;
    if (data.notFound) {
      return en
        ? "I couldn’t find that folder in your live workspace. I won’t invent one — try another name?"
        : "No encontré ese folder en tu workspace live. No voy a inventar uno — ¿pruebas con otro nombre?";
    }
    if (data.empty || n === 0) {
      if (data.scope === "today") {
        return en
          ? `Today in **${name}** there are zero scheduled documents.`
          : `Hoy en **${name}** hay cero documentos programados.`;
      }
      if (data.folder || data.hierarchy?.folder) {
        const dept = data.department || data.hierarchy?.department;
        const cat = data.category || data.hierarchy?.category;
        const path = [dept, cat, data.folder || data.hierarchy?.folder].filter(Boolean).join(" / ");
        return en
          ? `Folder **${name}**${path ? ` (${path})` : ""} has zero documents.`
          : `El folder **${name}**${path ? ` (${path})` : ""} no tiene documentos.`;
      }
      return en
        ? `From the **${name}** department there is zero data — no categories, folders, or documents.`
        : `Del departamento de **${name}** hay cero datos — sin categorías, folders ni documentos.`;
    }
    if (data.folder || data.hierarchy?.folder) {
      const dept = data.department || data.hierarchy?.department;
      const cat = data.category || data.hierarchy?.category;
      const folder = data.folder || data.hierarchy?.folder;
      const pathBits = [];
      if (dept) pathBits.push(en ? `department **${dept}**` : `departamento de **${dept}**`);
      if (cat) pathBits.push(en ? `category **${cat}**` : `categoría **${cat}**`);
      if (folder) pathBits.push(en ? `folder **${folder}**` : `folder **${folder}**`);
      const path = pathBits.join(en ? ", " : ", ");
      return en
        ? `From the ${path}, here are all **${n}** document(s).`
        : `Del ${path}, aquí tienes los **${n}** documento(s).`;
    }
    return en
      ? `From the **${name}** department, here are all the documents (${n}), including flexible ones without hours.`
      : `Del departamento de **${name}**, aquí tienes todos los documentos (${n}), incluidos los flexibles sin horario.`;
  }

  if (visualization.type === "folder_summary") {
    const name = data.department || data.folderName || "—";
    const n = data.total ?? (Array.isArray(data.documents) ? data.documents.length : 0);
    if (data.empty || n === 0) {
      return en
        ? `From the **${name}** department there is zero data — no categories, folders, or documents.`
        : `Del departamento de **${name}** hay cero datos — sin categorías, folders ni documentos.`;
    }
    return en
      ? `From **${name}** — ${n} document(s).`
      : `De **${name}** — ${n} documento(s).`;
  }

  if (visualization.type === "schedule_sheet") {
    if (data.recoveryPhase === "brief" && data.hasRecoveryOffer) {
      return buildScheduleRecoveryBriefText({
        firstTitle: data.firstPendingTitle,
        locale: opts.locale,
      });
    }
    const n = Array.isArray(data.groups)
      ? data.groups.reduce((acc, g) => acc + (g.folders?.reduce((a, f) => a + (f.documents?.length || 0), 0) || 0), 0)
      : (data.documents?.length || 0);
    if (n === 0) {
      return en
        ? "I checked today’s schedule — nothing timed is on the sheet right now."
        : "Revisé tu agenda de hoy — no hay ítems con horario en el sheet ahora mismo.";
    }
    return en
      ? `I checked today’s schedule — here’s the sheet (${n} timed item${n === 1 ? "" : "s"}).`
      : `Revisé tu agenda de hoy — aquí tienes el sheet (${n} ítem${n === 1 ? "" : "s"}).`;
  }

  if (visualization.type === "daily_report") {
    return buildDailyReportOfferText({
      locale: opts.locale,
      isEmpty: Boolean(data.isEmpty),
      dayComplete: Boolean(data.dayComplete),
      conflictCount: data.conflictCount || 0,
      occupiedCount: data.occupiedCount || 0,
      pendingCount: data.pendingCount || 0,
      struckCount: data.struckCount || 0,
      folderProgress: data.folderProgress || [],
      hasRoomToday: Boolean(data.hasRoomToday),
      lastFinishAt: data.lastFinishAt || null,
      hasDetails: true,
    });
  }

  if (visualization.type === "daily_report_move_preview") {
    if (data.applied) {
      return buildDailyReportAppliedText({
        count: data.count || 0,
        locale: opts.locale,
      });
    }
    return buildDailyReportMovePreviewText({
      count: data.count || (data.proposals?.length || 0),
      locale: opts.locale,
    });
  }

  if (visualization.type === "recovery_preview") {
    if (data.applied) {
      return buildScheduleRecoveryAppliedText(
        data.intent === "postpone_schedule" ? "postpone_schedule" : "mark_past_due",
        { count: data.count || 0, locale: opts.locale },
      );
    }
    return buildScheduleRecoveryAck(
      data.intent === "postpone_schedule" ? "postpone_schedule" : "mark_past_due",
      { count: data.count || 0, locale: opts.locale },
    );
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

  if (type === "category_list" || opts.family === "count_categories") {
    return buildCountCategoriesChips({
      categories: data.categories,
      department: data.department,
      empty: Boolean(data.empty),
      locale,
    });
  }
  if (type === "folder_list" || opts.family === "count_folders") {
    return buildCountFoldersChips({
      folders: data.folders,
      department: data.department,
      empty: Boolean(data.empty),
      locale,
    });
  }
  if (type === "department_list" || opts.family === "count_departments") {
    return buildCountDepartmentsChips({
      departments: data.departments,
      locale,
      hasTodaySchedules: Boolean(data.hasTodaySchedules),
    });
  }
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
  if (type === "daily_report") {
    return buildDailyReportChips({
      locale,
      hasConflicts: Boolean(data.hasConflicts),
      isEmpty: Boolean(data.isEmpty),
    });
  }
  if (type === "daily_report_move_preview") {
    if (data.applied) {
      return buildScheduleSheetChips({ locale });
    }
    return buildDailyReportMoveConfirmChips({ locale });
  }
  if (type === "find_results") {
    return buildFindDocumentChips({
      locale,
      results: data.results || [],
      empty: Boolean(data.empty),
      needsClarify: Boolean(data.needsClarify),
      clarifyOptions: data.clarifyOptions || data.hints?.clarifyOptions || [],
    });
  }
  if (type === "table" && data.empty && data.department) {
    const dept = data.department || "";
    return [
      {
        id: "back_depts",
        label: locale === "en" ? "Back to departments" : "Volver a departamentos",
        text: locale === "en" ? "What do we have for today?" : "¿Qué tenemos para hoy?",
      },
      ...(dept
        ? [{
            id: "review_dept_corpus",
            label: locale === "en" ? `All docs in ${dept}` : `Todos en ${dept}`,
            text: locale === "en"
              ? `Show me all documents in ${dept}`
              : `Entregame todos los documentos de ${dept}`,
          }]
        : []),
    ];
  }
  if (type === "schedule_sheet" || type === "timeline") {
    return buildScheduleSheetChips({
      locale,
      hasRecoveryOffer: Boolean(data.hasRecoveryOffer),
      recoveryPhase: data.recoveryPhase || "gate",
    });
  }
  if (type === "recovery_preview") {
    if (data.applied) {
      return buildScheduleSheetChips({ locale });
    }
    return buildScheduleRecoveryConfirmChips(
      data.intent === "postpone_schedule" ? "postpone_schedule" : "mark_past_due",
      { locale },
    );
  }
  if (opts.family === "status" || opts.family === "past_due" || opts.family === "incomplete") {
    return buildScheduleSheetChips({ locale });
  }
  return [];
}

export { STATUS_CHIP_META };
