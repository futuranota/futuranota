import {
  buildScheduleRecoveryAck,
  buildScheduleRecoveryAppliedText,
  buildScheduleRecoveryBriefText,
  buildScheduleRecoveryChips,
  buildScheduleRecoveryConfirmChips,
  buildScheduleRecoveryGateChips,
  buildScheduleRecoveryIntroText,
  buildScheduleRecoveryStepText,
  buildReschedulePickerText,
  buildRescheduleForkChips,
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
import { buildResaltarCategoryChipText } from "./ginaSyntaxDocsByCategory.js";
import { liveCategoriesFromTableDocs } from "./ginaTableCategoryAsk.js";
import {
  pickGinaDocsByDepartmentHeadline,
  pickGinaDocsByStatusHeadline,
  pickGinaListRefineHints,
  countGinaRealDepartments,
} from "./ginaCopyVariants.js";
import { getGinaScheduleScopeChips } from "./ginaSyntaxScheduleScope.js";
import {
  docWorkMinutes,
  formatGinaTimeRange,
  formatWorkDurationLabel,
} from "./buildGinaVisualization.js";
import {
  buildTalkNotificationsEnableChips,
  buildTalkNotificationsOfferText,
} from "./ginaTalkRequest.js";

/** Closing after clean day sheet — tip to open Asistente in any file. */
const DAY_SHEET_ALREADY_READY_CLOSING = {
  es: "Tu agenda está lista.\n\nCuando trabajes en cualquier archivo, abre el Asistente para revisar o tachar avances.",
  en: "Your agenda is ready.\n\nWhen you work in any file, open the Assistant to review or check off progress.",
};

/**
 * Dashboard home opening chips (intro → 3 schedule → explore copy → Ver todo).
 * @param {GinaReplyChip[] | null | undefined} chips
 */
export function chipsAreHomeOpening(chips) {
  if (!Array.isArray(chips) || !chips.length) return false;
  return chips.some((c) => c?.group === "opening_home");
}

/**
 * Fixed reply chips for Gina progressive funnel (ids stable; labels user-facing).
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   text?: string,
 *   primary?: boolean,
 *   kind?: "category" | "layer_schedule" | "layer_status" | "omit" | "prompt" | "action",
 *   group?: string,
 *   selectable?: boolean,
 *   value?: string,
 * }} GinaReplyChip
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
 * @param {{
 *   locale?: string,
 *   hasDaySheet?: boolean,
 *   surface?: "dashboard" | "document",
 * }} [opts]
 * @returns {GinaReplyChip[]}
 */
export function buildGinaOpeningChips(opts = {}) {
  const en = opts.locale === "en";
  const surface = opts.surface === "document" ? "document" : "dashboard";

  // In-document Asistente: free-hours check + optional day schedule reopen.
  if (surface === "document") {
    /** @type {GinaReplyChip[]} */
    const docChips = [
      {
        id: "check_free_hours_doc",
        label: en
          ? "Check available hours for this document"
          : "Chequear horas libres para este documento",
        text: en
          ? "Check available hours for this document"
          : "Chequear horas libres para este documento",
        primary: true,
      },
    ];
    if (opts.hasDaySheet) {
      docChips.push({
        id: "day_sheet",
        label: en ? "Day schedule" : "Horario del día",
        text: en ? "Day schedule" : "Horario del día",
      });
    }
    return docChips;
  }

  // Dashboard home — greeting is separate; chips carry body copy + actions.
  return [
    {
      id: "home_intro",
      kind: "prompt",
      group: "opening_home",
      label: en
        ? "I already have your documents organized by schedule on your desktop. What would you like to review first?"
        : "Ya tengo listos los documentos organizados por horarios en tu escritorio. ¿Qué te gustaría revisar primero?",
      selectable: false,
    },
    {
      id: "agenda_today",
      kind: "home_schedule",
      group: "opening_home",
      label: en ? "What's on today's agenda?" : "¿Qué hay en agenda para hoy?",
      text: en ? "What do we have for today?" : "qué tenemos para hoy",
      primary: true,
      selectable: true,
    },
    {
      id: "review_week",
      kind: "home_schedule",
      group: "opening_home",
      label: en ? "Review the week" : "Revisar la semana",
      text: en
        ? "view all schedules this week"
        : "visualizar todos los horarios de la semana",
      selectable: true,
    },
    {
      id: "all_schedules",
      kind: "home_schedule",
      group: "opening_home",
      label: en ? "View all schedules" : "Ver todos los horarios",
      text: en ? "view all created schedules" : "Entregame todos los horarios",
      selectable: true,
    },
    {
      id: "home_explore",
      kind: "prompt",
      group: "opening_home",
      label: en
        ? "If you'd rather explore all your material at once, tell me and I'll show you the full archive."
        : "Si prefieres explorar todo tu material de una vez, dímelo y te muestro el archivo completo.",
      selectable: false,
    },
    {
      id: "see_all_docs",
      kind: "home_all",
      group: "opening_home",
      label: en ? "View all" : "Ver todo",
      text: en ? "full document list" : "entregame todos los documentos",
      selectable: true,
    },
  ];
}

/**
 * Chips after named category scope.
 * @param {{
 *   mode?: string,
 *   department?: string | null,
 *   category?: string | null,
 *   folders?: { name: string }[],
 *   empty?: boolean,
 *   locale?: string,
 * }} opts
 */
export function buildCategoryScopeChips(opts = {}) {
  const en = opts.locale === "en";
  const dept = String(opts.department || "").trim();
  const cat = String(opts.category || "").trim();
  const mode = opts.mode || "count_docs";
  /** @type {GinaReplyChip[]} */
  const chips = [];

  if (mode === "count_docs") {
    if (cat) {
      chips.push({
        id: "by_section",
        label: en ? "By section" : "Por sección",
        text: dept
          ? (en
            ? `Show sections of ${cat} in ${dept}`
            : `Por sección primero en ${cat} de ${dept}`)
          : (en
            ? `Show sections of ${cat}`
            : `Por sección primero en ${cat}`),
        primary: true,
      });
      chips.push({
        id: "full_list",
        label: en ? "Full list" : "Listado completo",
        text: dept
          ? (en
            ? `Full list of ${cat} in ${dept}`
            : `Listado completo de ${cat} en ${dept}`)
          : (en
            ? `Full list of ${cat}`
            : `Listado completo de ${cat}`),
      });
    }
    return chips;
  }

  if (mode === "list_folders") {
    if (opts.empty) {
      chips.push({
        id: "back_depts",
        label: en ? "Back to departments" : "Volver a departamentos",
        text: en
          ? "How many departments do we have in total?"
          : "¿Cuántos departamentos tenemos en general?",
      });
      return chips;
    }
    for (const folder of (opts.folders || []).slice(0, 6)) {
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
    return chips;
  }

  // list_docs
  if (dept && cat) {
    chips.push({
      id: "by_section",
      label: en ? "By section" : "Por sección",
      text: en
        ? `Show sections of ${cat} in ${dept}`
        : `Por sección primero en ${cat} de ${dept}`,
    });
  }
  return chips;
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
 * Chips after generic document count / browse.
 * @param {{
 *   mode?: string,
 *   documents?: { id?: string, title?: string, folder?: string | null }[],
 *   departments?: { name?: string }[],
 *   categories?: { name?: string }[],
 *   availableCategories?: string[],
 *   view?: { showSchedule?: boolean, showStatus?: boolean, categories?: string[] },
 *   department?: string | null,
 *   category?: string | null,
 *   empty?: boolean,
 *   locale?: string,
 *   fromCountDocuments?: boolean,
 *   browseMode?: string,
 * }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildCountDocumentsChips(opts = {}) {
  const en = opts.locale === "en";
  const mode = opts.mode || "count";
  const dept = String(opts.department || "").trim();
  /** @type {GinaReplyChip[]} */
  const chips = [];

  const viewChipText = (view) => {
    const parts = [en ? "Full document list" : "Listado completo"];
    if (view.showSchedule) parts.push(en ? "with schedule" : "con horarios");
    if (view.showStatus) parts.push(en ? "with status" : "con status");
    const cats = Array.isArray(view.categories) ? view.categories.filter(Boolean) : [];
    if (cats.length) {
      parts.push(en ? `categories: ${cats.join(", ")}` : `categorías: ${cats.join(", ")}`);
    }
    return parts.join(" ");
  };

  if (mode === "pick_department" || opts.browseMode === "department") {
    for (const d of (opts.departments || []).slice(0, 8)) {
      const name = String(d?.name || "").trim();
      if (!name) continue;
      chips.push({
        id: `docs_dept_${name}`,
        label: name,
        text: en
          ? `Documents in department: ${name}`
          : `Documentos del departamento ${name}`,
        primary: chips.length === 0,
      });
    }
    return chips;
  }

  if (mode === "pick_category" || opts.browseMode === "category") {
    for (const c of (opts.categories || []).slice(0, 8)) {
      const name = String(c?.name || "").trim();
      if (!name) continue;
      chips.push({
        id: `docs_cat_${name}`,
        label: name,
        text: en
          ? `Documents in category: ${name}`
          : `Documentos de la categoría ${name}`,
        primary: chips.length === 0,
      });
    }
    return chips;
  }

  if (mode === "list_all" || mode === "list_by_department" || mode === "list_by_category") {
    if (!opts.empty) {
      const view = {
        showSchedule: Boolean(opts.view?.showSchedule),
        showStatus: Boolean(opts.view?.showStatus),
        categories: Array.isArray(opts.view?.categories) ? [...opts.view.categories] : [],
        highlightCategories: Array.isArray(opts.view?.highlightCategories)
          ? [...opts.view.highlightCategories]
          : [],
        scheduleScope: opts.view?.scheduleScope || null,
      };
      const selectedCats = (view.highlightCategories.length
        ? view.highlightCategories
        : view.categories).filter(Boolean);
      const available = Array.isArray(opts.availableCategories) ? opts.availableCategories : [];
      const selected = new Set(selectedCats.map((c) => String(c).trim().toLowerCase()));

      // Full list without category / schedule-scope filter → multi-select refine palette.
      // all_docs already shows Status + Fecha y Hora; still offer week/all/today scopes + cats.
      const isAllDocsBare = opts.view?.layout === "all_docs"
        && !view.scheduleScope
        && opts.view?.timedOnly === false;
      if (!selectedCats.length && ((!view.showSchedule && !view.showStatus) || isAllDocsBare)) {
        const isFullCorpusList = mode === "list_all";
        const departmentCount = isFullCorpusList
          ? (Number.isFinite(Number(opts.departmentCount))
            ? Number(opts.departmentCount)
            : countGinaRealDepartments(opts.departmentRail))
          : 0;
        const hints = pickGinaListRefineHints({
          locale: en ? "en" : "es",
          salt: opts.salt,
          departmentCount: isFullCorpusList ? departmentCount : 0,
        });
        // list_all: explain rail colors + intent before schedule scopes / categories
        if (isFullCorpusList) {
          if (hints.railHint) {
            chips.push({
              id: "hint_rail",
              kind: "prompt",
              group: "list_refine",
              label: hints.railHint,
              selectable: false,
            });
          }
          chips.push({
            id: "hint_intent",
            kind: "prompt",
            group: "list_refine",
            label: hints.intentHint,
            emphasis: "intent",
            selectable: false,
          });
          for (const scope of getGinaScheduleScopeChips(en ? "en" : "es")) {
            chips.push({
              id: scope.id,
              kind: "schedule_scope",
              group: "list_refine",
              label: scope.label,
              text: scope.text,
              value: scope.scope,
              selectable: true,
            });
          }
        }
        chips.push({
          id: "hint_categories",
          kind: "prompt",
          group: "list_refine",
          label: hints.categoryHint,
          selectable: false,
        });
        const soft = available.slice(0, 8);
        for (const cat of soft) {
          const name = String(cat || "").trim();
          if (!name) continue;
          chips.push({
            id: `cat_refine_${name}`,
            kind: "category",
            group: "list_refine",
            label: name,
            value: name,
            selectable: true,
          });
        }
        if (!isAllDocsBare) {
          chips.push({
            id: "hint_layers",
            kind: "prompt",
            group: "list_refine",
            label: hints.layerHint,
            selectable: false,
          });
          chips.push({
            id: "layer_schedule",
            kind: "layer_schedule",
            group: "list_refine",
            label: en ? "+schedule" : "+horarios",
            selectable: true,
          });
          chips.push({
            id: "layer_status",
            kind: "layer_status",
            group: "list_refine",
            label: en ? "+status" : "+status",
            selectable: true,
          });
          chips.push({
            id: "layer_omit",
            kind: "omit",
            group: "list_refine",
            label: en ? "skip" : "omitir",
            selectable: true,
          });
        }
        if (available.length > 8) {
          chips.push({
            id: "more_cats",
            kind: "action",
            label: en ? "More categories…" : "Más categorías…",
            text: en
              ? "Show documents by category"
              : "Ver documentos por categoría",
          });
        }
        return chips;
      }

      // Left the refine (schedule scope / layers / category filter) → category ask + back
      if (
        view.scheduleScope
        || Boolean(opts.fromCountDocuments)
      ) {
        const liveCats = liveCategoriesFromTableDocs(opts.documents);
        // Offer ask only when the shown table still has cats and isn't already
        // narrowed to a category highlight selection.
        if (liveCats.length && !selectedCats.length) {
          chips.push({
            id: "ask_filter_categories",
            kind: "ask_table_categories",
            group: "table_category_ask",
            label: en ? "Filter by categories" : "Filtramelo por categorías",
            text: en ? "filter by categories" : "filtramelo por categorias",
            primary: true,
            selectable: true,
          });
          chips.push({
            id: "ask_exclude_categories",
            kind: "ask_table_categories",
            group: "table_category_ask",
            label: en ? "Exclude categories" : "Excluyeme las categorías",
            text: en ? "exclude the categories" : "excluyeme las categorias",
            selectable: true,
          });
        }
        chips.push({
          id: "nav_back_refine",
          kind: "nav_back",
          group: "list_refine",
          label: en ? "Back" : "Volver",
          selectable: false,
        });
        return chips;
      }

      // Already filtered / layered → one-shot follow-up chips
      const layerChipText = (next) => {
        if (selectedCats.length || (next.categories && next.categories.length)) {
          const cats = (next.highlightCategories?.length
            ? next.highlightCategories
            : (next.categories?.length ? next.categories : selectedCats));
          return buildResaltarCategoryChipText(cats, {
            locale: en ? "en" : "es",
            showSchedule: next.showSchedule,
            showStatus: next.showStatus,
          });
        }
        return viewChipText(next);
      };
      if (!view.showSchedule) {
        chips.push({
          id: "add_schedule",
          label: en ? "+ Schedule" : "+ Horarios",
          text: layerChipText({ ...view, showSchedule: true }),
          primary: true,
        });
      }
      if (!view.showStatus) {
        chips.push({
          id: "add_status",
          label: en ? "+ Status" : "+ Status",
          text: layerChipText({ ...view, showStatus: true }),
        });
      }
      const soft = available.slice(0, 8);
      for (const cat of soft) {
        const name = String(cat || "").trim();
        if (!name) continue;
        if (selected.has(name.toLowerCase())) continue;
        chips.push({
          id: `cat_highlight_${name}`,
          label: name,
          text: buildResaltarCategoryChipText(name, {
            locale: en ? "en" : "es",
            showSchedule: view.showSchedule,
            showStatus: view.showStatus,
          }),
          primary: chips.length === 0,
        });
      }
      if (available.length > 8) {
        chips.push({
          id: "more_cats",
          label: en ? "More categories…" : "Más categorías…",
          text: en
            ? "Show documents by category"
            : "Ver documentos por categoría",
        });
      }
    }
    return chips;
  }

  // count mode
  if (opts.empty) {
    chips.push({
      id: "back_depts",
      label: en ? "Back to departments" : "Volver a departamentos",
      text: en
        ? "How many departments do we have in total?"
        : "¿Cuántos departamentos tenemos en general?",
    });
    return chips;
  }
  chips.push({
    id: "full_list",
    label: en ? "Full list" : "Listado completo",
    text: en
      ? "I want the full list of all documents"
      : "Quiero el listado completo de todos los documentos",
    primary: true,
  });
  chips.push({
    id: "by_dept",
    label: en ? "By department" : "Por departamento",
    text: en
      ? "Show documents by department"
      : "Ver documentos por departamento",
  });
  chips.push({
    id: "by_cat",
    label: en ? "By category" : "Por categoría",
    text: en
      ? "Show documents by category"
      : "Ver documentos por categoría",
  });
  void dept;
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
 * @param {{
 *   locale?: string,
 *   hasRecoveryOffer?: boolean,
 *   recoveryPhase?: string,
 *   isDaySheet?: boolean,
 *   justSaved?: boolean,
 *   missingAnchor?: boolean,
 *   hasDaySheet?: boolean,
 *   todayOverview?: boolean,
 *   offerDayReady?: boolean,
 *   allowOpenWithoutSave?: boolean,
 *   overviewByDepartment?: { name: string, total?: number }[],
 *   quickSheet?: {
 *     isCleanDay?: boolean,
 *     firstPendingId?: string | null,
 *     firstPendingTitle?: string | null,
 *     urgency?: object[],
 *   } | null,
 *   nextDocumentId?: string | null,
 *   nextDocumentTitle?: string | null,
 *   openDocId?: string | null,
 *   openDocTitle?: string | null,
 *   currentStep?: string,
 *   invadedLabels?: string[],
 * }} [opts]
 */
export function buildScheduleSheetChips(opts = {}) {
  const en = opts.locale === "en";
  const hasRecovery = Boolean(opts.hasRecoveryOffer);
  const phase = opts.recoveryPhase || "gate";
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const urgencyCount = typeof opts.urgencyCount === "number"
    ? opts.urgencyCount
    : (Array.isArray(qs?.urgency) ? qs.urgency.length : 0);
  const hasOverlap = Boolean(opts.hasOverlap || qs?.hasOverlap || opts.conflictRails || qs?.conflictRails);
  const topConflict = opts.topConflict || qs?.topConflict || null;
  /** Clean chronological day → save/start path (late-start alone must not steal the pitch). */
  const cleanDay = Boolean(qs?.isCleanDay);
  /** Errors first: urgency / overlap / markable — notify hub first (unless table is clean). */
  const errorsFirst = !cleanDay && todayOverviewNeedsRecoveryGate({
    quickSheet: qs,
    hasRecoveryOffer: hasRecovery,
    urgencyCount,
    lateStartCount: opts.lateStartCount,
    hasOverlap,
    recoverySnoozed: opts.recoverySnoozed,
  });
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if (errorsFirst && phase === "brief") {
    chips.push(...buildScheduleRecoveryChips({
      locale: opts.locale,
      currentStep: opts.currentStep,
      urgencyCount,
      lateStartCount: opts.lateStartCount,
      recoveryOfferMode: opts.recoveryOfferMode,
      openDocId: opts.openDocId,
      openDocTitle: opts.openDocTitle,
      hasOverlap,
      topConflict,
      invadedLabels: opts.invadedLabels,
    }));
  } else if (errorsFirst) {
    chips.push(...buildScheduleRecoveryGateChips({ locale: opts.locale }));
  } else if (opts.missingAnchor) {
    chips.push({
      id: "today_schedule",
      label: en ? "Today's schedule" : "Horarios de hoy",
      text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
      primary: true,
    });
  } else if (opts.isDaySheet) {
    const startId = opts.nextDocumentId
      || opts.openDocId
      || qs?.firstPendingId
      || null;
    const startTitle = String(
      opts.nextDocumentTitle
      || opts.openDocTitle
      || qs?.firstPendingTitle
      || "",
    ).trim();
    if (opts.justSaved && startId) {
      chips.push({
        id: `open_${startId}`,
        label: en
          ? (startTitle ? `Start «${startTitle}»` : "Start first document")
          : (startTitle ? `Comenzar «${startTitle}»` : "Comenzar primer documento"),
        text: `GinaOpenDocument:${startId}`,
        primary: true,
      });
    }
    chips.push({
      id: "day_sheet_next",
      label: en ? "What's next?" : "¿Qué sigue?",
      text: en ? "What's next?" : "¿Qué sigue?",
      primary: !chips.some((c) => c.primary),
    });
    chips.push({
      id: "day_sheet_done",
      label: en ? "I finished" : "Ya terminé",
      text: en ? "I finished" : "Ya terminé",
    });
  } else if (opts.todayOverview || opts.offerDayReady) {
    // First: live-notifications opt-in. After the user answers → Comenzar + Re-agendar.
    if (!opts.talkNotificationsDecided) {
      chips.push(...buildTalkNotificationsEnableChips({ locale: opts.locale }));
    } else {
      if (qs?.firstPendingId || opts.nextDocumentId) {
        const startId = opts.nextDocumentId || qs.firstPendingId;
        const title = String(
          opts.nextDocumentTitle || qs?.firstPendingTitle || "",
        ).trim();
        chips.push({
          id: `open_${startId}`,
          label: en
            ? (title ? `Start with ${title}` : "Start first document")
            : (title ? `Comenzar con ${title}` : "Comenzar primer documento"),
          text: `GinaOpenDocument:${startId}`,
          primary: true,
        });
      }
      chips.push({
        id: "reschedule_times",
        label: en ? "Reschedule calendar" : "Reagendar calendario",
        text: en ? "Reschedule for today" : "Reagendar para hoy",
      });
    }
  } else {
    if (opts.hasDaySheet) {
      chips.push({
        id: "open_day_sheet",
        label: en ? "Day schedule" : "Horario del día",
        text: en ? "Day schedule" : "Horario del día",
      });
    }
    chips.push({
      id: "today_schedule",
      label: en ? "Today's schedule" : "Horarios de hoy",
      text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
      primary: !chips.some((c) => c.primary),
    });
  }
  return chips;
}

/**
 * Confirm mark completed on day sheet.
 * @param {{ locale?: string, title?: string }} [opts]
 */
export function buildDaySheetCompleteConfirmChips(opts = {}) {
  const en = opts.locale === "en";
  const title = String(opts.title || "").trim();
  return [
    {
      id: "confirm_complete",
      label: en ? "Confirm completed" : "Confirmar completed",
      text: en ? "Confirm mark as completed" : "Confirmar marcar como completed",
      primary: true,
    },
    {
      id: "open_day_sheet",
      label: en ? "Day schedule" : "Horario del día",
      text: en ? "Day schedule" : "Horario del día",
    },
    ...(title
      ? [{
          id: "open_doc",
          label: en ? `Open «${title}»` : `Abrir «${title}»`,
          text: en ? `Open ${title}` : `Abrir ${title}`,
        }]
      : []),
  ];
}

/**
 * Chips after next-doc suggestion.
 * @param {{ locale?: string, title?: string, documentId?: string | null }} [opts]
 */
export function buildDaySheetNextChips(opts = {}) {
  const en = opts.locale === "en";
  const title = String(opts.title || "").trim();
  const id = opts.documentId || null;
  /** @type {GinaReplyChip[]} */
  const chips = [];
  if (id) {
    chips.push({
      id: `open_${id}`,
      label: en ? `Open «${title || "document"}»` : `Abrir «${title || "documento"}»`,
      text: `GinaOpenDocument:${id}`,
      primary: true,
    });
  } else if (title) {
    chips.push({
      id: "open_next",
      label: en ? `Open «${title}»` : `Abrir «${title}»`,
      text: en ? `Open ${title}` : `Abrir ${title}`,
      primary: true,
    });
  }
  chips.push({
    id: "open_day_sheet",
    label: en ? "Day schedule" : "Horario del día",
    text: en ? "Day schedule" : "Horario del día",
  });
  return chips;
}

/**
 * Join names: "A y B" / "A, B y C" (ES) or "A and B" (EN).
 * @param {string[]} names
 * @param {string} [locale]
 */
function joinNameList(names, locale = "es") {
  const list = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  const en = locale === "en";
  const conj = en ? " and " : " y ";
  if (list.length === 2) return `${list[0]}${conj}${list[1]}`;
  return `${list.slice(0, -1).join(", ")}${conj}${list[list.length - 1]}`;
}

/**
 * Bold duration for dept body: "**2 horas con 15** minutos".
 * @param {number} minutes
 * @param {string} [locale]
 * @returns {{ bold: string, after: string } | null}
 */
function boldDurationParts(minutes, locale = "es") {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return null;
  const en = locale === "en";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) {
    return {
      bold: en
        ? `${rem} minute${rem === 1 ? "" : "s"}`
        : `${rem} minuto${rem === 1 ? "" : "s"}`,
      after: "",
    };
  }
  if (rem <= 0) {
    return {
      bold: en
        ? `${h} hour${h === 1 ? "" : "s"}`
        : `${h} hora${h === 1 ? "" : "s"}`,
      after: "",
    };
  }
  return {
    bold: en
      ? `${h} hour${h === 1 ? "" : "s"} with ${rem}`
      : `${h} hora${h === 1 ? "" : "s"} con ${rem}`,
    after: en
      ? ` minute${rem === 1 ? "" : "s"}`
      : ` minuto${rem === 1 ? "" : "s"}`,
  };
}

/**
 * Per-department blocks for today overview (dot + headline + body with **bold**).
 * @param {{ overviewByDepartment?: object[], locale?: string }} opts
 * @returns {{ name: string, color: string, headline: string, body: string }[]}
 */
export function buildTodayOverviewDeptBlocks(opts = {}) {
  const en = opts.locale === "en";
  const depts = Array.isArray(opts.overviewByDepartment) ? opts.overviewByDepartment : [];
  return depts.map((d) => {
    const cats = Array.isArray(d.categories) ? d.categories : [];
    const dur = boldDurationParts(d.minutes || 0, en ? "en" : "es");
    const hoursTail = dur
      ? (en
        ? ` with a total of **${dur.bold}**${dur.after}`
        : ` con un total de **${dur.bold}**${dur.after}`)
      : "";
    let body;
    if (!cats.length) {
      body = en
        ? `Here you have a total of **${d.total} document${d.total === 1 ? "" : "s"}**${hoursTail}.`
        : `Aquí tienes un total de **${d.total} documento${d.total === 1 ? "" : "s"}**${hoursTail}.`;
    } else if (cats.length === 1) {
      const c = cats[0];
      body = en
        ? `Here you have a total of **${c.count} document${c.count === 1 ? "" : "s"}** in the ${c.name} category${hoursTail}.`
        : `Aquí tienes un total de **${c.count} documento${c.count === 1 ? "" : "s"}** en la categoría ${c.name}${hoursTail}.`;
    } else {
      const catParts = cats.map((c) => (
        en ? `**${c.count}** in ${c.name}` : `**${c.count}** en ${c.name}`
      ));
      body = en
        ? `Here you have a total of **${d.total} documents** (${joinNameList(catParts, "en")})${hoursTail}.`
        : `Aquí tienes un total de **${d.total} documentos** (${joinNameList(catParts, "es")})${hoursTail}.`;
    }
    return {
      name: d.name,
      color: d.color || "#8a8a8a",
      headline: `${d.name}:`,
      body,
    };
  });
}

/**
 * Deterministic narration for “qué tenemos para hoy” (bubble only).
 * Full day summary now lives post-sheet (`buildTodayOverviewDaySummary`).
 * Pre-sheet bubble stays empty so textMid + viz lead.
 */
export function buildTodayOverviewHeadline(opts = {}) {
  const en = opts.locale === "en";
  const depts = Array.isArray(opts.overviewByDepartment) ? opts.overviewByDepartment : [];
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const nFromQs = typeof qs?.totalDocuments === "number"
    ? qs.totalDocuments
    : ((qs?.completed?.length || 0) + (qs?.urgency?.length || 0) + (qs?.pending?.length || 0));
  const nDocs = nFromQs
    || (Array.isArray(opts.documents) ? opts.documents.length : 0)
    || depts.reduce((acc, d) => acc + (d.total || 0), 0);

  if (nDocs === 0 && depts.length === 0) {
    return en
      ? "Nothing scheduled for today."
      : "Hoy no hay trabajo programado.";
  }

  // Summary moved after the sheet — keep pre-sheet message empty.
  return "";
}

/**
 * Post-sheet day summary (docs + hours + focus department).
 * @param {{
 *   locale?: string,
 *   overviewByDepartment?: object[],
 *   documents?: object[],
 *   totalMinutes?: number,
 *   totalHoursLabel?: string,
 *   quickSheet?: object | null,
 * }} [opts]
 * @returns {string | null}
 */
export function buildTodayOverviewDaySummary(opts = {}) {
  const en = opts.locale === "en";
  const depts = Array.isArray(opts.overviewByDepartment) ? opts.overviewByDepartment : [];
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const nFromQs = typeof qs?.totalDocuments === "number"
    ? qs.totalDocuments
    : ((qs?.completed?.length || 0) + (qs?.urgency?.length || 0) + (qs?.pending?.length || 0));
  const nDocs = nFromQs
    || (Array.isArray(opts.documents) ? opts.documents.length : 0)
    || depts.reduce((acc, d) => acc + (d.total || 0), 0);
  const totalMinutes = typeof opts.totalMinutes === "number"
    ? opts.totalMinutes
    : depts.reduce((acc, d) => acc + (d.minutes || 0), 0);
  if (nDocs <= 0 && totalMinutes <= 0) return null;

  const totalHoursLabel = opts.totalHoursLabel
    || formatWorkDurationLabel(totalMinutes, en ? "en" : "es")
    || formatHoursFallback(totalMinutes, en ? "en" : "es");
  const title = en ? "Initial day summary:" : "Resumen inicial del día:";
  const top = depts.find((d) => (d?.minutes || 0) > 0) || depts[0] || null;
  const topName = top ? String(top.name || "").trim() : "";
  const topHours = top
    ? (top.hoursLabel
      || formatWorkDurationLabel(top.minutes || 0, en ? "en" : "es", { short: true }))
    : "";

  let body;
  if (totalMinutes > 0 && topName) {
    body = en
      ? `You have ${nDocs} document${nDocs === 1 ? "" : "s"} assigned and a total of ${totalHoursLabel} of work. Most of your time will be focused on ${topName} (${topHours}).`
      : `Tienes ${nDocs} documento${nDocs === 1 ? "" : "s"} asignado${nDocs === 1 ? "" : "s"} y un total de ${totalHoursLabel} de trabajo. La mayor parte de tu tiempo estará centrada en ${topName} (${topHours}).`;
  } else if (totalMinutes > 0) {
    body = en
      ? `You have ${nDocs} document${nDocs === 1 ? "" : "s"} assigned and a total of ${totalHoursLabel} of work.`
      : `Tienes ${nDocs} documento${nDocs === 1 ? "" : "s"} asignado${nDocs === 1 ? "" : "s"} y un total de ${totalHoursLabel} de trabajo.`;
  } else {
    body = en
      ? `You have ${nDocs} document${nDocs === 1 ? "" : "s"} assigned.`
      : `Tienes ${nDocs} documento${nDocs === 1 ? "" : "s"} asignado${nDocs === 1 ? "" : "s"}.`;
  }
  return `${title}\n${body}`;
}

/**
 * Intro BEFORE the today-overview table (sheet delivery).
 * @param {string} [locale]
 * @returns {string}
 */
export function buildTodayOverviewIntroText(locale = "es") {
  const en = locale === "en";
  return en
    ? "Now I’ll show you today’s schedule:"
    : "Ahora te voy a mostrar el horario del día:";
}

/**
 * Whether today overview still needs the recovery notify gate
 * (imperfect sheet — do not pitch save yet).
 * @param {{
 *   quickSheet?: object | null,
 *   hasRecoveryOffer?: boolean,
 *   urgencyCount?: number,
 *   lateStartCount?: number,
 *   hasOverlap?: boolean,
 *   recoverySnoozed?: boolean,
 * }} [opts]
 */
export function todayOverviewNeedsRecoveryGate(opts = {}) {
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const urgencyCount = typeof opts.urgencyCount === "number"
    ? opts.urgencyCount
    : (Array.isArray(qs?.urgency) ? qs.urgency.length : 0);
  const hasOverlap = Boolean(
    opts.hasOverlap
    || qs?.hasOverlap
    || opts.conflictRails
    || qs?.conflictRails,
  );
  const hasRecovery = Boolean(opts.hasRecoveryOffer);
  return (urgencyCount > 0 || hasOverlap || hasRecovery || Number(opts.lateStartCount) > 0)
    && !opts.recoverySnoozed;
}

/**
 * Resolve first pending document for the post-table “Documento de inicio” block.
 * @param {{
 *   quickSheet?: object | null,
 *   documents?: object[],
 * }} [opts]
 * @returns {object | null}
 */
export function resolveTodayOverviewStartDoc(opts = {}) {
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const docs = Array.isArray(opts.documents) ? opts.documents : [];
  const pending = Array.isArray(qs?.pending) ? qs.pending : [];
  const id = qs?.firstPendingId ? String(qs.firstPendingId) : "";
  if (id) {
    const fromDocs = docs.find((d) => d && String(d.id) === id);
    if (fromDocs) return fromDocs;
    const fromPending = pending.find((d) => d && String(d.id) === id);
    if (fromPending) return fromPending;
  }
  if (pending[0]) return pending[0];
  const live = docs.find((d) => d && !d.completed && d.status !== "completed");
  return live || null;
}

/**
 * @param {{
 *   locale?: string,
 *   quickSheet?: object | null,
 *   documents?: object[],
 * }} [opts]
 * @returns {string | null}
 */
export function buildTodayOverviewStartDocText(opts = {}) {
  const lines = buildTodayOverviewStartDocLines(opts);
  if (!lines.length) return null;
  return lines.map((row) => `**${row.label}:** ${row.value}`).join("\n");
}

/**
 * Structured start-doc rows for line-by-line reveal + highlight SFX.
 * @param {{
 *   locale?: string,
 *   quickSheet?: object | null,
 *   documents?: object[],
 * }} [opts]
 * @returns {{ label: string, value: string }[]}
 */
/**
 * “Documento de inicio” only for the day’s first unit; once anything is completed,
 * the live pending target is “Próximo Documento”.
 * @param {object} doc
 * @param {{ quickSheet?: object | null, documents?: object[] }} opts
 */
function isFirstChronologicalDocOfDay(doc, opts = {}) {
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const completed = Array.isArray(qs?.completed) ? qs.completed : [];
  if (completed.length > 0) return false;

  const id = doc?.id != null ? String(doc.id) : "";
  if (!id) return true;

  const docs = Array.isArray(opts.documents) ? opts.documents.filter((d) => d && d.id != null) : [];
  if (!docs.length) return true;

  const sorted = docs.slice().sort((a, b) => {
    const ka = String(a.anchorAt || "\uffff");
    const kb = String(b.anchorAt || "\uffff");
    return ka.localeCompare(kb);
  });
  const firstLive = sorted.find((d) => !(d.completed || d.status === "completed")) || sorted[0];
  return String(firstLive?.id) === id;
}

export function buildTodayOverviewStartDocLines(opts = {}) {
  const en = opts.locale === "en";
  const doc = resolveTodayOverviewStartDoc(opts);
  if (!doc) return [];

  const title = String(doc.title || doc.name || "").trim()
    || (en ? "document" : "documento");
  const department = String(
    doc.department || doc.departmentName || doc.hierarchy?.department || "",
  ).trim() || "—";
  const categoryRaw = String(
    doc.category || doc.hierarchy?.category || "",
  ).trim();
  const category = (!categoryRaw || categoryRaw === "—" || categoryRaw === "-")
    ? ""
    : categoryRaw;
  // Only show "(Category)" when there is a real category — never "Sales (—)".
  const departmentValue = category ? `${department} (${category})` : department;
  const minutes = typeof doc.workMinutes === "number"
    ? doc.workMinutes
    : docWorkMinutes(doc);
  const duration = minutes > 0
    ? formatWorkDurationLabel(minutes, en ? "en" : "es", { short: true })
    : (en ? "—" : "—");
  const schedule = String(
    doc.timeClock || doc.timeLabel || doc.time || "",
  ).trim()
    || formatGinaTimeRange(doc.anchorAt, doc.anchorFinishAt || doc.dueAt, en ? "en" : "es");

  const folderName = String(
    doc.folder
    || doc.parentFolderName
    || doc.hierarchy?.folder
    || "",
  ).trim();
  const folderId = String(
    doc.parentFolderId || doc.folderId || doc.parentDocId || "",
  ).trim();
  const folderProgress = Array.isArray(opts.folderProgress) ? opts.folderProgress : [];
  const folderSnap = folderProgress.find((f) => (
    (folderId && String(f.folderId) === folderId)
    || (folderName && String(f.folder || "").toLowerCase() === folderName.toLowerCase())
  )) || null;
  const folderLabel = folderSnap?.folder || folderName || "";
  const folderPct = folderSnap
    ? (en
      ? `${folderSnap.percent}% of folder (${folderSnap.done}/${folderSnap.total})`
      : `${folderSnap.percent}% del folder (${folderSnap.done}/${folderSnap.total})`)
    : "";

  const startLabel = isFirstChronologicalDocOfDay(doc, opts)
    ? (en ? "Starting document" : "Documento de inicio")
    : (en ? "Next document" : "Próximo Documento");

  /** @type {{ label: string, value: string, tone?: string }[]} */
  const lines = en
    ? [
      { label: startLabel, value: title },
      { label: "Department", value: departmentValue },
      { label: "Assigned time", value: `${duration} (${schedule})` },
    ]
    : [
      { label: startLabel, value: title },
      { label: "Departamento", value: departmentValue },
      { label: "Tiempo asignado", value: `${duration} (${schedule})` },
    ];

  if (folderLabel) {
    lines.push({
      label: en ? "Folder" : "Folder",
      value: folderLabel,
    });
  }
  if (folderPct) {
    lines.push({
      label: en ? "Folder progress" : "Avance del folder",
      value: folderPct,
      tone: "foot",
    });
  }
  return lines;
}

/**
 * Single post-table text block (start doc + begin + optional save pitch).
 * Start-doc block + begin + “already ready” closing (no save CTA).
 *
 * @param {{
 *   locale?: string,
 *   quickSheet?: object | null,
 *   documents?: object[],
 *   overviewByDepartment?: object[],
 *   totalMinutes?: number,
 *   totalHoursLabel?: string,
 *   hasDaySheet?: boolean,
 *   hasRecoveryOffer?: boolean,
 *   urgencyCount?: number,
 *   lateStartCount?: number,
 *   hasOverlap?: boolean,
 *   recoverySnoozed?: boolean,
 *   userId?: string,
 *   forceCleanDay?: boolean,
 *   offerDayReady?: boolean,
 *   talkNotificationsEnabled?: boolean,
 *   talkNotificationsDecided?: boolean,
 * }} [opts]
 * @returns {{
 *   textAfter: string | null,
 *   textAfterLead: string | null,
 *   textAfterRest: string | null,
 *   startDocLines: { label: string, value: string }[],
 *   textPitch: null,
 * }}
 */
export function buildTodayOverviewPostTableCopy(opts = {}) {
  const en = opts.locale === "en";
  const qs = opts.quickSheet && typeof opts.quickSheet === "object" ? opts.quickSheet : null;
  const cleanDay = Boolean(qs?.isCleanDay) || Boolean(opts.forceCleanDay || opts.offerDayReady);
  const empty = {
    textAfter: null,
    textAfterLead: null,
    textAfterRest: null,
    startDocLines: [],
    textPitch: null,
  };

  if (!cleanDay) {
    if (todayOverviewNeedsRecoveryGate(opts)) {
      // Still reveal Documento / Depto / Tiempo (+ highlights SFX) after the sheet;
      // skip “already ready” closing until recovery signals are cleared.
      const startDocLines = buildTodayOverviewStartDocLines(opts);
      if (!startDocLines.length) return empty;
      return {
        textAfter: null,
        textAfterLead: null,
        textAfterRest: null,
        startDocLines,
        textPitch: null,
      };
    }
    if (!qs?.firstPendingId && !(Array.isArray(qs?.pending) && qs.pending.length)) {
      return empty;
    }
  }

  const daySummary = buildTodayOverviewDaySummary({
    locale: en ? "en" : "es",
    overviewByDepartment: opts.overviewByDepartment,
    documents: opts.documents,
    totalMinutes: opts.totalMinutes,
    totalHoursLabel: opts.totalHoursLabel,
    quickSheet: qs,
  });
  const startDocLines = buildTodayOverviewStartDocLines(opts);
  const start = startDocLines.length
    ? startDocLines.map((row) => `**${row.label}:** ${row.value}`).join("\n")
    : null;
  const readyClosing = en
    ? DAY_SHEET_ALREADY_READY_CLOSING.en
    : DAY_SHEET_ALREADY_READY_CLOSING.es;

  const restParts = [readyClosing];
  if (!opts.talkNotificationsDecided) {
    restParts.push(buildTalkNotificationsOfferText(en ? "en" : "es"));
  }
  const textAfterRest = restParts.join("\n\n");
  const parts = [];
  if (daySummary) parts.push(daySummary);
  if (start) parts.push(start);
  parts.push(...restParts);

  return {
    textAfter: parts.length ? parts.join("\n\n") : null,
    textAfterLead: daySummary || null,
    textAfterRest,
    startDocLines,
    textPitch: null,
  };
}

/**
 * @param {Parameters<typeof buildTodayOverviewPostTableCopy>[0]} [opts]
 * @returns {string | null}
 */
export function buildTodayOverviewAfterText(opts = {}) {
  return buildTodayOverviewPostTableCopy(opts).textAfter;
}

function formatHoursFallback(minutes, locale, opts = {}) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const en = locale === "en";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  const withCon = Boolean(opts.withCon);
  const shortMin = Boolean(opts.shortMin);
  if (h <= 0) {
    if (shortMin) return en ? `${rem} min` : `${rem} min`;
    return en
      ? `${rem} minute${rem === 1 ? "" : "s"}`
      : `${rem} minuto${rem === 1 ? "" : "s"}`;
  }
  if (rem <= 0) {
    return en
      ? `${h} hour${h === 1 ? "" : "s"}`
      : `${h} hora${h === 1 ? "" : "s"}`;
  }
  if (withCon) {
    return en
      ? `${h} hour${h === 1 ? "" : "s"} with ${rem} minute${rem === 1 ? "" : "s"}`
      : (shortMin
        ? `${h} hora${h === 1 ? "" : "s"} y ${rem} min`
        : `${h} hora${h === 1 ? "" : "s"} con ${rem} minuto${rem === 1 ? "" : "s"}`);
  }
  return en
    ? `${h} hour${h === 1 ? "" : "s"} and ${rem} minute${rem === 1 ? "" : "s"}`
    : `${h} hora${h === 1 ? "" : "s"} y ${rem} minuto${rem === 1 ? "" : "s"}`;
}

/**
 * Deterministic funnel headline.
 * @param {{ type?: string, data?: object } | null} visualization
 * @param {{ locale?: string, salt?: number, compact?: boolean, surface?: "dashboard" | "document" }} [opts]
 */
export function buildGinaFunnelHeadline(visualization, opts = {}) {
  const en = opts.locale === "en";
  if (!visualization?.type) return null;
  const data = visualization.data || {};

  if (visualization.type === "category_scope") {
    const dept = data.department || (en ? "this department" : "este departamento");
    const cat = data.category || (en ? "that category" : "esa categoría");
    const n = Number(data.documentCount) || 0;
    if (n === 0) {
      return en
        ? `In **${dept}** you have **zero** documents in **${cat}**.`
        : `En **${dept}** tienes cero documentos de **${cat}**.`;
    }
    if (n === 1) {
      return en
        ? `In **${dept}** you have **1** document in **${cat}**. Want me to find it by section (box / drawer title) first, or show the full list?`
        : `En **${dept}** tienes creado **1** documento de **${cat}**. ¿Quieres que te lo busque por sección (título de caja / cajón) o el listado completo?`;
    }
    return en
      ? `In **${dept}** you have **${n}** documents in **${cat}**. Want me to search by section first, or do you want the full list?`
      : `En **${dept}** tienes creados **${n}** documentos de **${cat}**. ¿Quieres que te busque por sección primero o quieres el listado completo?`;
  }

  if (visualization.type === "category_list") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const dept = data.department || null;
    const cats = Array.isArray(data.categories) ? data.categories : [];
    const n = data.count ?? cats.length;
    if (data.fromCountDocuments || data.browseMode === "category") {
      if (n === 0 || data.empty) {
        return en
          ? `You don’t have any categories to filter documents by.`
          : `No tienes categorías para filtrar documentos.`;
      }
      const bullets = cats.slice(0, 12).map((c) => `• ${c.name}`).join("\n");
      return en
        ? `Which category do you want to open?\n${bullets}`
        : `¿Qué categoría quieres abrir?\n${bullets}`;
    }
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

  if (
    visualization.type === "folder_list"
    || (visualization.type === "table" && data.fromCategoryScope && data.scope === "category_folders")
  ) {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const dept = data.department || null;
    const cat = data.category || null;
    const folders = Array.isArray(data.folders) ? data.folders : [];
    const n = data.folderCount ?? data.count ?? folders.length;
    if (n === 0 || data.empty) {
      if (data.emptyReason === "no_folders_in_category" || (cat && data.fromCategoryScope)) {
        return en
          ? `You don’t have any folders created in **${cat}**.`
          : `No tienes folders creados en **${cat}**.`;
      }
      if (dept) {
        return en
          ? `In **${dept}** you have **zero** folders created. Start by creating at least one folder so you can schedule appointments afterward.`
          : `En **${dept}** tienes cero secciones de folder creadas. Comienza creando al menos un folder para después poder programar citas.`;
      }
      return en
        ? `For **${corpus}** you have **zero** folders created. Start by creating at least one folder so you can schedule appointments afterward.`
        : `Para **${corpus}** tienes cero secciones de folder creadas. Comienza creando al menos un folder para después poder programar citas.`;
    }
    const scope = cat
      ? (en ? `In **${cat}**` : `En **${cat}**`)
      : dept
        ? (en ? `In **${dept}**` : `En **${dept}**`)
        : (en ? `For **${corpus}**` : `Para **${corpus}**`);
    const head = en
      ? `${scope} we have a total of **${n}** folder${n === 1 ? "" : "s"}:`
      : `${scope} tenemos un total de **${n}** folder${n === 1 ? "" : "s"}:`;
    const bullets = folders
      .slice(0, 12)
      .map((f) => `• ${f.name}`)
      .join("\n");
    const docN = Array.isArray(data.documents) ? data.documents.length : 0;
    const ask = en
      ? (docN > 0
        ? `Here are the folders and their **${docN}** document(s).`
        : "Want to open the documents of one of these folders?")
      : (docN > 0
        ? `Aquí tienes los folders y sus **${docN}** documento(s).`
        : "¿Quieres ver los documentos de alguno de estos folders?");
    return `${head}\n${bullets}\n\n${ask}`;
  }

  if (visualization.type === "document_dept_groups") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const n = data.count ?? (Array.isArray(data.groups)
      ? data.groups.reduce((sum, g) => sum + (g.documentCount || 0), 0)
      : 0);
    const view = data.view || {};
    if (n === 0 || data.empty) {
      return en
        ? `For **${corpus}** you have **zero** documents.`
        : `Para **${corpus}** tienes cero documentos.`;
    }
    const bits = [];
    if (view.showSchedule) bits.push(en ? "schedule" : "horarios");
    if (view.showStatus) bits.push("status");
    const cats = Array.isArray(view.categories) ? view.categories.filter(Boolean) : [];
    if (cats.length) {
      bits.push(en
        ? `categories: ${cats.join(", ")}`
        : `categorías: ${cats.join(", ")}`);
    }
    const layerNote = bits.length
      ? (en ? ` Filters: ${bits.join(" · ")}.` : ` Filtros: ${bits.join(" · ")}.`)
      : "";
    return pickGinaDocsByDepartmentHeadline({
      count: n,
      locale: en ? "en" : "es",
      salt: opts.salt,
      layerNote,
    });
  }

  if (visualization.type === "document_list" || visualization.type === "document_count") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const dept = data.department || null;
    const n = data.count ?? (Array.isArray(data.documents) ? data.documents.length : 0);
    if (n === 0 || data.empty) {
      if (dept) {
        return en
          ? `In **${dept}** you have **zero** documents created.`
          : `En **${dept}** tienes cero documentos creados.`;
      }
      return en
        ? `For **${corpus}** you have **zero** documents created.`
        : `Para **${corpus}** tienes cero documentos creados.`;
    }
    const scope = dept
      ? (en ? `In **${dept}**` : `En **${dept}**`)
      : (en ? `In total` : `En total`);
    const head = en
      ? (n === 1
        ? `${scope}, you have **1** document.`
        : `${scope}, we have **${n}** documents.`)
      : (n === 1
        ? `${scope}, tienes **1** documento.`
        : `${scope}, tenemos **${n}** documentos.`);
    const ask = en
      ? "Want to do something else — show the full list, or look them up by department or by category?"
      : "¿Quieres hacer algo más? Por ejemplo: ¿te muestro el listado completo, o prefieres que te lo busque por departamentos o por categorías?";
    return `${head}\n\n${ask}`;
  }

  if (visualization.type === "department_list") {
    const corpus = data.corpusName || (en ? "this workspace" : "este corpus");
    const depts = Array.isArray(data.departments) ? data.departments : [];
    const n = data.count ?? depts.length;
    if (data.fromCountDocuments || data.browseMode === "department") {
      if (n === 0 || data.empty) {
        return en
          ? `You don’t have any departments to filter documents by.`
          : `No tienes departamentos para filtrar documentos.`;
      }
      const bullets = depts.slice(0, 12).map((d) => `• ${d.name}`).join("\n");
      return en
        ? `Which department do you want to open?\n${bullets}`
        : `¿Qué departamento quieres abrir?\n${bullets}`;
    }
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

  if (visualization.type === "table" && (data.listAll || data.empty || data.department || data.folder || data.fromCountDocuments)) {
    const name = data.folder || data.department || data.category || "—";
    const n = Array.isArray(data.documents) ? data.documents.length : 0;
    if (data.notFound) {
      return en
        ? "I couldn’t find that folder in your live workspace. I won’t invent one — try another name?"
        : "No encontré ese folder en tu workspace live. No voy a inventar uno — ¿pruebas con otro nombre?";
    }
    if (data.fromCountDocuments) {
      const view = data.view || {};
      // “Entregame todos los horarios” → table only, no spoken headline.
      if (view.scheduleScope === "all" || view.layout === "schedules_all") {
        return "";
      }
      const bits = [];
      if (view.showSchedule) {
        if (view.scheduleScope === "week") bits.push(en ? "this week" : "semana");
        else if (view.scheduleScope === "today") bits.push(en ? "today" : "hoy");
        else if (view.scheduleScope === "all") bits.push(en ? "all schedules" : "todos los horarios");
        else bits.push(en ? "schedule" : "horarios");
      }
      if (view.showStatus) bits.push("status");
      const cats = Array.isArray(view.categories) ? view.categories.filter(Boolean) : [];
      const highlightCats = Array.isArray(view.highlightCategories) && view.highlightCategories.length
        ? view.highlightCategories.filter(Boolean)
        : [];
      // Highlight copy names categories in the sentence — don't duplicate in Filtros
      const layerNote = bits.length
        ? (en ? ` Filters: ${bits.join(" · ")}.` : ` Filtros: ${bits.join(" · ")}.`)
        : "";
      if (data.scope === "folder" || data.folder) {
        const folder = data.folder || data.title || name;
        const dept = data.department || data.hierarchy?.department;
        const cat = data.category || data.hierarchy?.category;
        if (data.empty || n === 0) {
          return en
            ? `Folder **${folder}** has zero documents.`
            : `El folder **${folder}** no tiene documentos.`;
        }
        const pathBits = [];
        if (dept) pathBits.push(en ? `department **${dept}**` : `departamento de **${dept}**`);
        if (cat) pathBits.push(en ? `category **${cat}**` : `categoría **${cat}**`);
        pathBits.push(en ? `folder **${folder}**` : `folder **${folder}**`);
        const path = pathBits.join(en ? ", " : ", ");
        return en
          ? `From the ${path}, here are all **${n}** document(s).`
          : `Del ${path}, aquí tienes los **${n}** documento(s).`;
      }
      if (data.empty || n === 0) {
        if (data.scope === "category" && data.category) {
          return en
            ? `Category **${data.category}** has zero documents.`
            : `La categoría **${data.category}** no tiene documentos.`;
        }
        if (data.scope === "department" && data.department) {
          return en
            ? `Department **${data.department}** has zero documents.`
            : `El departamento **${data.department}** no tiene documentos.`;
        }
        if (cats.length || highlightCats.length) {
          const label = (highlightCats.length ? highlightCats : cats).join(", ");
          return en
            ? `No documents in category **${label}**.`
            : `No hay documentos en la categoría **${label}**.`;
        }
        return en
          ? "There are zero documents in this workspace."
          : "No hay documentos en este workspace.";
      }
      if (highlightCats.length) {
        const label = highlightCats.join(", ");
        return en
          ? `Filtered **${n}** document${n === 1 ? "" : "s"} in category **${label}**.${layerNote}`
          : `Se filtraron **${n}** documento${n === 1 ? "" : "s"} en la categoría **${label}**.${layerNote}`;
      }
      if (data.scope === "category" && data.category) {
        return en
          ? `Category **${data.category}** — **${n}** document${n === 1 ? "" : "s"}.${layerNote}`
          : `Categoría **${data.category}** — **${n}** documento${n === 1 ? "" : "s"}.${layerNote}`;
      }
      if (data.scope === "department" && data.department) {
        return en
          ? `Department **${data.department}** — **${n}** document${n === 1 ? "" : "s"}.${layerNote}`
          : `Departamento **${data.department}** — **${n}** documento${n === 1 ? "" : "s"}.${layerNote}`;
      }
      if (data.railMode === "status" || data.groupBy === "status") {
        return pickGinaDocsByStatusHeadline({
          count: n,
          locale: en ? "en" : "es",
          salt: opts.salt,
          layerNote,
        });
      }
      if (data.railMode === "weekday" || data.groupBy === "weekday") {
        return en
          ? `Here are **${n}** scheduled document${n === 1 ? "" : "s"} by weekday.${layerNote}`
          : `Aquí tienes **${n}** documento${n === 1 ? "" : "s"} con horario, por día de la semana.${layerNote}`;
      }
      return pickGinaDocsByDepartmentHeadline({
        count: n,
        locale: en ? "en" : "es",
        salt: opts.salt,
        layerNote,
      });
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
      ? `I found a total of **${n}** documents in the **${name}** department. Here you go:`
      : `Encontré un total de **${n}** documentos del departamento de **${name}**. Aquí te lo muestro:`;
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

  if (visualization.type === "day_sheet_saved" || (
    visualization.type === "schedule_sheet" && data.justSaved
  )) {
    return en
      ? "Done — today’s schedule is saved. Whenever you need the list or to check items off, open the Assistant and tap Day schedule."
      : "Listo, ya está guardado el horario del día. Cuando necesites la lista o tachar avances, abre el Asistente y toca Horario del día.";
  }

  if (visualization.type === "schedule_sheet") {
    if (data.recoveryWizard || data.notifyBrief || data.recoveryPhase === "brief") {
      if (data.recoveryWizard && data.currentStep) {
        // Intro is the primary message from host; funnel may return step text for textAfter-only paths.
        return buildScheduleRecoveryIntroText({
        locale: opts.locale,
        urgencyCount: data.urgencyCount ?? data.passedSlotCount ?? 0,
        lateStartCount: data.lateStartCount || 0,
        hasOverlap: Boolean(data.hasOverlap || data.conflictRails || data.currentStep === "conflict_resolve"),
      });
      }
      return buildScheduleRecoveryIntroText({
        locale: opts.locale,
        urgencyCount: data.urgencyCount ?? data.passedSlotCount ?? 0,
        lateStartCount: data.lateStartCount || 0,
        hasOverlap: Boolean(data.hasOverlap || data.conflictRails),
      });
    }
    const n = Array.isArray(data.groups)
      ? data.groups.reduce((acc, g) => acc + (g.folders?.reduce((a, f) => a + (f.documents?.length || 0), 0) || 0), 0)
      : (data.documents?.length || 0);
    if (data.todayOverview) {
      // Datos only — sheet intro is textMid after the infographic.
      return buildTodayOverviewHeadline({
        overviewByDepartment: data.overviewByDepartment,
        documents: data.documents,
        totalMinutes: data.totalMinutes,
        totalHoursLabel: data.totalHoursLabel,
        quickSheet: data.quickSheet || null,
        locale: opts.locale,
      });
    }
    if (data.missingAnchor) {
      return en
        ? "You don’t have a day reference sheet yet. Open today’s schedule and save it as your guide."
        : "Aún no tienes tabla de referencia del día. Mira los horarios de hoy y guárdala como guía.";
    }
    if (data.completePreview) {
      const title = data.documents?.[0]?.title || (en ? "this document" : "este documento");
      return en
        ? `Got it — I’ll mark **${title}** as completed. Confirm?`
        : `Va — marco **${title}** como completed. ¿Confirmas?`;
    }
    if (data.completeApplied) {
      const title = data.documents?.[0]?.title || (en ? "the document" : "el documento");
      return en
        ? `Done — **${title}** is completed.`
        : `Listo — **${title}** quedó completed.`;
    }
    if (data.isDaySheet) {
      const p = data.progress || {};
      const done = p.completed || 0;
      const left = p.remaining ?? Math.max(0, (p.total || n) - done);
      if (n === 0) {
        return en
          ? "Your day schedule is empty right now."
          : "Tu horario del día está vacío por ahora.";
      }
      // In-doc compact: counts live in the checklist header — no bubble prose.
      if (opts.compact || opts.surface === "document" || data.compact) {
        return "";
      }
      return en
        ? `Here’s your day sheet: **${done}** done, **${left}** left. Say “I finished”, “what’s next”, or open a document.`
        : `Aquí tienes tu sheet del día: **${done}** tachado${done === 1 ? "" : "s"}, **${left}** restante${left === 1 ? "" : "s"}. Puedes decir “ya terminé”, “qué sigue”, o abrir un documento.`;
    }
    if (n === 0) {
      return en
        ? "I checked today’s schedule — nothing timed is on the sheet right now."
        : "Revisé tu agenda de hoy — no hay ítems con horario en el sheet ahora mismo.";
    }
    return en
      ? `I checked today’s schedule — here’s the sheet (${n} timed item${n === 1 ? "" : "s"}). Want me to save it as your day reference guide?`
      : `Revisé tu agenda de hoy — aquí tienes el sheet (${n} ítem${n === 1 ? "" : "s"}). ¿Quieres que te guarde esta tabla de referencia como guía de visualización?`;
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
    const intent = data.intent === "postpone_schedule"
      ? "postpone_schedule"
      : data.intent === "mark_completed"
        ? "mark_completed"
        : data.intent === "mark_in_progress"
          ? "mark_in_progress"
          : data.intent === "delete_docs"
            ? "delete_docs"
            : "mark_past_due";
    if (data.applied) {
      return buildScheduleRecoveryAppliedText(intent, {
        count: data.count || 0,
        locale: opts.locale,
      });
    }
    return buildScheduleRecoveryAck(intent, {
      count: data.count || 0,
      locale: opts.locale,
    });
  }
  if (visualization.type === "schedule_slot_picker") {
    return buildReschedulePickerText({
      locale: opts.locale,
      mode: data.rescheduleMode === "cascade" ? "cascade" : "gaps",
      hasFreeSlot: data.hasFreeSlot !== false && !data.noCupo,
      noCupo: Boolean(data.noCupo),
      activeTitle: data.activeTitle || null,
    });
  }

  return null;
}

/**
 * Attach chips for a visualization + family.
 * @param {{
 *   family?: string,
 *   visualization?: { type?: string, data?: object } | null,
 *   locale?: string,
 *   salt?: number,
 *   hasDaySheet?: boolean,
 * }} opts
 * @returns {GinaReplyChip[]}
 */
export function buildGinaReplyChips(opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const viz = opts.visualization;
  const type = viz?.type;
  const data = viz?.data || {};
  const salt = opts.salt;

  if (opts.family === "schedule_recovery_reschedule_fork") {
    return buildRescheduleForkChips({ locale });
  }

  if (opts.family === "day_sheet_complete_confirm") {
    const title = data.documents?.[0]?.title || "";
    return [
      {
        id: "day_sheet_next",
        label: locale === "en" ? "What's next?" : "¿Qué sigue?",
        text: locale === "en" ? "What's next?" : "¿Qué sigue?",
        primary: true,
      },
      {
        id: "open_day_sheet",
        label: locale === "en" ? "Day schedule" : "Horario del día",
        text: locale === "en" ? "Day schedule" : "Horario del día",
      },
      ...(title
        ? []
        : []),
    ];
  }
  if (opts.family === "day_sheet_complete") {
    if (data.clarifyComplete) {
      return (data.documents || []).slice(0, 5).map((doc, i) => ({
        id: `complete_${doc.id || i}`,
        label: doc.title || (locale === "en" ? "Document" : "Documento"),
        text: locale === "en"
          ? `I finished ${doc.title}`
          : `Ya terminé ${doc.title}`,
        primary: i === 0,
      }));
    }
    return buildDaySheetCompleteConfirmChips({
      locale,
      title: data.documents?.[0]?.title || "",
    });
  }
  if (opts.family === "day_sheet_next") {
    return buildDaySheetNextChips({
      locale,
      title: opts.nextDocumentTitle || data.documents?.find((d) => d.id === data.nextDocumentId)?.title,
      documentId: opts.nextDocumentId || data.nextDocumentId || null,
    });
  }

  if (type === "category_scope" || opts.family === "category_scope") {
    return buildCategoryScopeChips({
      mode: data.mode || "count_docs",
      department: data.department,
      category: data.category,
      folders: data.folders,
      empty: Boolean(data.empty),
      locale,
    });
  }
  if (type === "category_list" || opts.family === "count_categories") {
    return buildCountCategoriesChips({
      categories: data.categories,
      department: data.department,
      empty: Boolean(data.empty),
      locale,
    });
  }
  if (type === "folder_list" || opts.family === "count_folders") {
    if (data.fromCategoryScope || data.category) {
      return buildCategoryScopeChips({
        mode: "list_folders",
        department: data.department,
        category: data.category,
        folders: data.folders,
        empty: Boolean(data.empty),
        locale,
      });
    }
    return buildCountFoldersChips({
      folders: data.folders,
      department: data.department,
      empty: Boolean(data.empty),
      locale,
    });
  }
  if (type === "table" && (data.fromCategoryScope || data.scope === "category_folders")) {
    return buildCategoryScopeChips({
      mode: "list_folders",
      department: data.department,
      category: data.category,
      folders: data.folders,
      empty: Boolean(data.empty),
      locale,
    });
  }
  if (type === "table" && data.scope === "folder") {
    return [];
  }
  if (type === "document_list" || type === "document_count") {
    return buildCountDocumentsChips({
      mode: data.mode || "count",
      documents: data.documents,
      departments: data.departments,
      categories: data.categories,
      department: data.department,
      category: data.category,
      empty: Boolean(data.empty),
      locale,
      fromCountDocuments: Boolean(data.fromCountDocuments),
      browseMode: data.browseMode,
    });
  }
  if (
    (type === "department_list" || type === "category_list")
    && (data.fromCountDocuments || opts.family === "count_documents")
  ) {
    return buildCountDocumentsChips({
      mode: type === "category_list" || data.browseMode === "category"
        ? "pick_category"
        : "pick_department",
      departments: data.departments,
      categories: data.categories,
      empty: Boolean(data.empty),
      locale,
      browseMode: data.browseMode || (type === "category_list" ? "category" : "department"),
    });
  }
  if (type === "document_dept_groups" || (type === "table" && data.fromCountDocuments)) {
    return buildCountDocumentsChips({
      mode: data.mode
        || (data.scope === "category"
          ? "list_by_category"
          : (data.scope === "department" ? "list_by_department" : "list_all")),
      documents: data.documents,
      department: data.department,
      category: data.category,
      empty: Boolean(data.empty),
      locale,
      salt,
      view: data.view,
      availableCategories: data.availableCategories,
      fromCountDocuments: true,
      departmentRail: data.departmentRail,
      departmentCount: countGinaRealDepartments(data.departmentRail),
    });
  }
  if (opts.family === "count_documents") {
    return buildCountDocumentsChips({
      mode: data.mode || "count",
      documents: data.documents,
      departments: data.departments,
      categories: data.categories,
      department: data.department,
      category: data.category,
      empty: Boolean(data.empty),
      locale,
      salt,
      browseMode: data.browseMode,
      view: data.view,
      availableCategories: data.availableCategories,
      fromCountDocuments: Boolean(data.fromCountDocuments),
      departmentRail: data.departmentRail,
      departmentCount: countGinaRealDepartments(data.departmentRail),
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
  if (type === "schedule_sheet" || type === "timeline" || type === "day_sheet_saved") {
    return buildScheduleSheetChips({
      locale,
      hasRecoveryOffer: Boolean(data.hasRecoveryOffer),
      recoveryPhase: data.recoveryPhase || "gate",
      isDaySheet: Boolean(data.isDaySheet || type === "day_sheet_saved"),
      justSaved: Boolean(data.justSaved || type === "day_sheet_saved"),
      missingAnchor: Boolean(data.missingAnchor),
      hasDaySheet: Boolean(opts.hasDaySheet),
      allowOpenWithoutSave: Boolean(opts.allowOpenWithoutSave),
      todayOverview: Boolean(data.todayOverview),
      offerDayReady: Boolean(data.offerDayReady || data.offerSaveDaySheet),
      overviewByDepartment: data.overviewByDepartment,
      quickSheet: data.quickSheet || null,
      urgencyCount: data.urgencyCount,
      lateStartCount: data.lateStartCount,
      recoveryOfferMode: data.recoveryOfferMode,
      openDocId: data.openDocId,
      openDocTitle: data.openDocTitle,
      nextDocumentId: opts.nextDocumentId || data.nextDocumentId || null,
      nextDocumentTitle: opts.nextDocumentTitle
        || data.nextDocumentTitle
        || data.documents?.find((d) => d.id === (opts.nextDocumentId || data.nextDocumentId))?.title
        || null,
      hasOverlap: Boolean(data.hasOverlap || data.quickSheet?.hasOverlap),
      topConflict: data.topConflict || data.quickSheet?.topConflict || null,
      conflictRails: data.conflictRails || data.quickSheet?.conflictRails || null,
      currentStep: data.currentStep,
      invadedLabels: data.invadedLabels,
      recoverySnoozed: Boolean(opts.recoverySnoozed),
      talkNotificationsEnabled: Boolean(opts.talkNotificationsEnabled),
      talkNotificationsDecided: Boolean(
        opts.talkNotificationsDecided || opts.talkNotificationsEnabled,
      ),
    });
  }
  if (type === "schedule_slot_picker") {
    const en = locale === "en";
    const chips = [];
    const activeId = data.activeDocId || null;
    if (data.rescheduleMode !== "cascade" && (data.noCupo || data.hasFreeSlot === false)) {
      chips.push({
        id: "reschedule_tomorrow",
        label: en ? "Select Tomorrow" : "Seleccionar Mañana",
        text: activeId
          ? (en
            ? `Move recovery document ${activeId} to tomorrow morning`
            : `Mover documento de recuperación ${activeId} a mañana por la mañana`)
          : (en
            ? "Move recovery blocks to tomorrow morning"
            : "Mover bloques de recuperación a mañana por la mañana"),
        primary: true,
      });
      chips.push({
        id: "compress_coming_soon",
        label: en ? "Compress other blocks" : "Comprimir otros bloques",
        text: en ? "Compress durations (coming soon)" : "Comprimir duraciones (próximamente)",
        comingSoon: true,
      });
      chips.push({
        id: "force_end_of_night",
        label: en
          ? `Insert at ${data.forceEndLabel || "end"} anyway`
          : `Insertar a las ${data.forceEndLabel || "final"} de todos modos`,
        text: activeId
          ? (en
            ? `Force insert document ${activeId} at end of night`
            : `Forzar inserción documento ${activeId} al final de la noche`)
          : (en
            ? "Force insert recovery blocks at end of night"
            : "Forzar inserción de bloques al final de la noche"),
      });
    }
    if (data.rescheduleMode === "cascade") {
      chips.push({
        id: "reschedule_gaps",
        label: en ? "Fit into free gaps" : "Encajar en huecos libres",
        text: en
          ? "Reschedule expired blocks show free slots"
          : "Reagendar bloques vencidos mostrar cupos libres",
      });
    }
    chips.push({
      id: "recovery_next",
      label: en ? "Continue" : "Seguir",
      text: en
        ? "Continue to next schedule recovery step"
        : "Seguir al siguiente paso de recuperación",
    });
    return chips;
  }
  if (type === "recovery_preview") {
    if (data.applied) {
      return buildScheduleSheetChips({ locale });
    }
    const intent = data.intent === "postpone_schedule"
      ? "postpone_schedule"
      : data.intent === "mark_completed"
        ? "mark_completed"
        : data.intent === "mark_in_progress"
          ? "mark_in_progress"
          : data.intent === "delete_docs"
            ? "delete_docs"
            : "mark_past_due";
    return buildScheduleRecoveryConfirmChips(intent, { locale });
  }
  if (opts.family === "status" || opts.family === "past_due" || opts.family === "incomplete") {
    return buildScheduleSheetChips({ locale });
  }
  return [];
}

export { STATUS_CHIP_META };
