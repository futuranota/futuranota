/**
 * Gina table view contract — max columns, defaults, rail modes.
 * Keep chat tables legible; filter predicates stay separate (see ginaTableColumnRefine).
 *
 * Layouts (product):
 * - all_docs: Doc | Cat | Status | Fecha y Hora + dept rail (includes Flexible)
 * - schedules_all: Doc | Cat | Fecha y Hora | Status + dept rail (timed only)
 * - schedules_week: Doc | Folder | Fecha y Hora | Status + weekday rail (timed, this week)
 */

import { getGinaPrefs } from "./ginaPrefs.js";

/** Hard max columns in a Gina chat table. */
export const GINA_TABLE_MAX_COLUMNS = 4;

/** Max AND predicates when refining a shown table. */
export const GINA_TABLE_MAX_PREDICATES = 3;

/**
 * @typedef {"document"|"folder"|"department"|"category"|"path"|"status"|"time"|"weekday"} GinaTableColumnKey
 * @typedef {"department"|"status"|"category"|"weekday"|"none"} GinaTableRailMode
 * @typedef {"document"|"folder"} GinaTableSubject
 * @typedef {"all_docs"|"schedules_all"|"schedules_week"|"schedules_today"|null} GinaTableLayoutId
 *
 * @typedef {{
 *   subject?: GinaTableSubject,
 *   secondaryColumn?: "category"|"folder"|null,
 *   showSchedule?: boolean,
 *   showStatus?: boolean,
 *   scheduleScope?: "all"|"week"|"today"|null,
 *   layout?: GinaTableLayoutId,
 *   timedOnly?: boolean,
 *   railPrefer?: GinaTableRailMode | null,
 *   columns?: GinaTableColumnKey[] | null,
 * }} GinaTableViewInput
 *
 * @typedef {{
 *   subject: GinaTableSubject,
 *   columns: GinaTableColumnKey[],
 *   railMode: GinaTableRailMode,
 *   secondaryColumn: "category"|"folder",
 *   layout: GinaTableLayoutId,
 *   timedOnly: boolean,
 *   showSchedule: boolean,
 *   showStatus: boolean,
 * }} GinaTableViewResolved
 */

/**
 * Resolve columns + rail for a document (or folder) table.
 * @param {GinaTableViewInput} [opts]
 * @returns {GinaTableViewResolved}
 */
export function resolveGinaTableView(opts = {}) {
  const prefs = getGinaPrefs();
  const subject = opts.subject === "folder" ? "folder" : "document";
  const secondary = opts.secondaryColumn === "folder" || opts.secondaryColumn === "category"
    ? opts.secondaryColumn
    : (prefs.secondaryColumn === "folder" ? "folder" : "category");

  const layout = resolveLayoutId(opts);

  if (Array.isArray(opts.columns) && opts.columns.length) {
    const columns = uniqueKeys(opts.columns).slice(0, GINA_TABLE_MAX_COLUMNS);
    const railMode = normalizeRail(
      opts.railPrefer
      || (layout === "schedules_week" ? "weekday" : "department"),
    );
    return {
      subject,
      columns,
      railMode,
      secondaryColumn: secondary,
      layout,
      timedOnly: opts.timedOnly != null ? Boolean(opts.timedOnly) : layoutStartsWithSchedules(layout),
      showSchedule: columns.includes("time"),
      showStatus: columns.includes("status"),
    };
  }

  if (subject === "folder") {
    const columns = /** @type {GinaTableColumnKey[]} */ (
      uniqueKeys(["folder", "department"]).slice(0, GINA_TABLE_MAX_COLUMNS)
    );
    return {
      subject,
      columns,
      railMode: opts.railPrefer === "none" ? "none" : (opts.railPrefer || "none"),
      secondaryColumn: secondary,
      layout: null,
      timedOnly: false,
      showSchedule: false,
      showStatus: false,
    };
  }

  if (layout === "all_docs") {
    // Documento | Categoría | Estado | Fecha y Hora — includes Flexible rows
    const columns = uniqueKeys(["document", secondary, "status", "time"])
      .slice(0, GINA_TABLE_MAX_COLUMNS);
    return {
      subject,
      columns,
      railMode: normalizeRail(opts.railPrefer || "department"),
      secondaryColumn: secondary,
      layout,
      timedOnly: false,
      showSchedule: true,
      showStatus: true,
    };
  }

  if (layout === "schedules_all") {
    // Documento | Categoría | Fecha y Hora | Estado — timed only + dept rail
    const columns = uniqueKeys(["document", secondary, "time", "status"])
      .slice(0, GINA_TABLE_MAX_COLUMNS);
    return {
      subject,
      columns,
      railMode: normalizeRail(opts.railPrefer || "department"),
      secondaryColumn: secondary,
      layout,
      timedOnly: true,
      showSchedule: true,
      showStatus: true,
    };
  }

  if (layout === "schedules_today") {
    // Documento | Categoría | Fecha y Hora — timed only (hoy; status optional later)
    const columns = uniqueKeys(["document", secondary, "time"])
      .slice(0, GINA_TABLE_MAX_COLUMNS);
    return {
      subject,
      columns,
      railMode: normalizeRail(opts.railPrefer || "department"),
      secondaryColumn: secondary,
      layout,
      timedOnly: true,
      showSchedule: true,
      showStatus: false,
    };
  }

  if (layout === "schedules_week") {
    // Documento | Folder | Fecha y Hora | Estado + weekday rail (folder connects docs to boxes)
    const weekSecondary = "folder";
    const columns = uniqueKeys(["document", weekSecondary, "time", "status"])
      .slice(0, GINA_TABLE_MAX_COLUMNS);
    return {
      subject,
      columns,
      railMode: normalizeRail(opts.railPrefer || "weekday"),
      secondaryColumn: weekSecondary,
      layout,
      timedOnly: true,
      showSchedule: true,
      showStatus: true,
    };
  }

  // Legacy / partial flags
  /** @type {GinaTableColumnKey[]} */
  const columns = ["document", secondary];
  if (opts.showSchedule) columns.push("time");
  if (opts.showStatus) columns.push("status");

  let railMode = normalizeRail(opts.railPrefer || "department");
  if (opts.scheduleScope === "week" && !opts.railPrefer) railMode = "weekday";

  return {
    subject,
    columns: uniqueKeys(columns).slice(0, GINA_TABLE_MAX_COLUMNS),
    railMode,
    secondaryColumn: secondary,
    layout,
    timedOnly: opts.timedOnly != null
      ? Boolean(opts.timedOnly)
      : Boolean(opts.showSchedule && opts.scheduleScope),
    showSchedule: Boolean(opts.showSchedule) || columns.includes("time"),
    showStatus: Boolean(opts.showStatus) || columns.includes("status"),
  };
}

/**
 * @param {GinaTableViewInput} opts
 * @returns {GinaTableLayoutId}
 */
function resolveLayoutId(opts) {
  if (opts.layout) return opts.layout;
  if (opts.scheduleScope === "week") return "schedules_week";
  if (opts.scheduleScope === "today") return "schedules_today";
  if (opts.scheduleScope === "all") return "schedules_all";
  if (opts.showSchedule && opts.showStatus && opts.timedOnly === false) return "all_docs";
  if (opts.showSchedule && !opts.showStatus) return "schedules_all";
  return null;
}

function layoutStartsWithSchedules(layout) {
  return layout === "schedules_all" || layout === "schedules_week" || layout === "schedules_today";
}

/**
 * @param {string | null | undefined} rail
 * @returns {GinaTableRailMode}
 */
function normalizeRail(rail) {
  if (rail === "none" || rail === "status" || rail === "category" || rail === "weekday") {
    return rail;
  }
  return "department";
}

/**
 * @param {string[]} keys
 */
function uniqueKeys(keys) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const k of keys) {
    const key = String(k || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
