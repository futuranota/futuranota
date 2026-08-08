/**
 * Document-status colors for Gina week-schedule table rail + legend.
 * Matches .doc-status-chip--* text colors on dark #151515.
 */

import { DOC_WORK_STATUS, resolveDocWorkStatus } from "../docWorkStatus.js";

/** @typedef {import("../docWorkStatus.js").DocWorkStatus} DocWorkStatus */

/** Narrative week order — past due first, completed last. null = no status. */
export const GINA_STATUS_RAIL_ORDER = [
  DOC_WORK_STATUS.PAST_DUE,
  DOC_WORK_STATUS.IN_PROGRESS,
  DOC_WORK_STATUS.SUBMITTED,
  DOC_WORK_STATUS.NOT_STARTED,
  DOC_WORK_STATUS.RESERVED,
  DOC_WORK_STATUS.FLEXIBLE,
  null,
  DOC_WORK_STATUS.COMPLETED,
];

/** @type {Record<string, string>} */
export const GINA_STATUS_RAIL_COLORS = {
  /* Brighter / more distinct on #151515 — chip hue family, higher chroma */
  [DOC_WORK_STATUS.PAST_DUE]: "#F2F2F2",
  [DOC_WORK_STATUS.IN_PROGRESS]: "#4DB3FF",
  [DOC_WORK_STATUS.SUBMITTED]: "#B794FF",
  [DOC_WORK_STATUS.NOT_STARTED]: "#F0A090",
  [DOC_WORK_STATUS.RESERVED]: "#FFB347",
  [DOC_WORK_STATUS.FLEXIBLE]: "#6EC9C0",
  [DOC_WORK_STATUS.COMPLETED]: "#5CFF9A",
  _none: "#5A5A5A",
};

/**
 * Resolve a doc row / node to a rail status id (null = unassigned).
 * @param {{ status?: unknown, completed?: unknown, struck?: unknown } | null | undefined} doc
 * @returns {DocWorkStatus | null}
 */
export function resolveStatusRailId(doc) {
  return resolveDocWorkStatus(doc);
}

/**
 * Sort key for week table (lower = higher in list).
 * @param {unknown} status
 * @returns {number}
 */
export function statusRailSortKey(status) {
  const id = typeof status === "string" || status == null
    ? resolveDocWorkStatus({ status })
    : resolveStatusRailId(status);
  const idx = GINA_STATUS_RAIL_ORDER.indexOf(id);
  if (idx >= 0) return idx;
  return GINA_STATUS_RAIL_ORDER.indexOf(null);
}

/**
 * @param {DocWorkStatus | null} statusId
 * @param {string} [locale]
 */
export function statusRailLabel(statusId, locale = "es") {
  const en = locale === "en";
  if (statusId == null) return en ? "No status" : "Sin status";
  const map = {
    [DOC_WORK_STATUS.PAST_DUE]: { es: "Vencidos", en: "Past due" },
    [DOC_WORK_STATUS.IN_PROGRESS]: { es: "En progreso", en: "In progress" },
    [DOC_WORK_STATUS.SUBMITTED]: { es: "Submitted", en: "Submitted" },
    [DOC_WORK_STATUS.NOT_STARTED]: { es: "Sin empezar", en: "Not started" },
    [DOC_WORK_STATUS.RESERVED]: { es: "Reserved", en: "Reserved" },
    [DOC_WORK_STATUS.FLEXIBLE]: { es: "Flexible", en: "Flexible" },
    [DOC_WORK_STATUS.COMPLETED]: { es: "Completed", en: "Completed" },
  };
  const row = map[statusId];
  if (!row) return String(statusId);
  return en ? row.en : row.es;
}

/**
 * @param {DocWorkStatus | null} statusId
 */
export function statusRailColor(statusId) {
  if (statusId == null) return GINA_STATUS_RAIL_COLORS._none;
  return GINA_STATUS_RAIL_COLORS[statusId] || GINA_STATUS_RAIL_COLORS._none;
}

/**
 * Build ordered rail segments from mapped document rows (already status-sorted).
 * Only statuses with count > 0.
 * @param {object[]} docs
 * @param {string} [locale]
 * @returns {{ id: string, name: string, count: number, color: string }[]}
 */
export function buildGinaStatusRail(docs = [], locale = "es") {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const doc of docs) {
    const id = resolveStatusRailId(doc);
    const key = id == null ? "_none" : id;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  /** @type {{ id: string, name: string, count: number, color: string }[]} */
  const rail = [];
  for (const statusId of GINA_STATUS_RAIL_ORDER) {
    const key = statusId == null ? "_none" : statusId;
    const count = counts.get(key) || 0;
    if (count <= 0) continue;
    rail.push({
      id: key,
      name: statusRailLabel(statusId, locale),
      count,
      color: statusRailColor(statusId),
    });
  }
  return rail;
}

/**
 * Contiguous status runs in row order — merge only adjacent same-status rows.
 * Use when rows are NOT re-sorted by status (e.g. Quick sheet completed→urgency→pending).
 *
 * @param {object[]} docs
 * @param {string} [locale]
 * @returns {{ id: string, name: string, count: number, color: string }[]}
 */
export function buildGinaStatusRailRuns(docs = [], locale = "es") {
  /** @type {{ id: string, name: string, count: number, color: string }[]} */
  const runs = [];

  for (const doc of docs) {
    const statusId = resolveStatusRailId(doc);
    const key = statusId == null ? "_none" : statusId;
    const last = runs[runs.length - 1];
    if (last && last.id === key) {
      last.count += 1;
    } else {
      runs.push({
        id: key,
        name: statusRailLabel(statusId, locale),
        count: 1,
        color: statusRailColor(statusId),
      });
    }
  }

  return runs;
}

/**
 * Compare two mapped docs for week status-rail table order.
 * @param {object} a
 * @param {object} b
 */
export function compareDocsByStatusThenTime(a, b) {
  const ka = statusRailSortKey(a);
  const kb = statusRailSortKey(b);
  if (ka !== kb) return ka - kb;
  const ta = String(a?.anchorAt || "");
  const tb = String(b?.anchorAt || "");
  if (ta && tb) return ta.localeCompare(tb);
  if (ta) return -1;
  if (tb) return 1;
  return String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
    sensitivity: "base",
  });
}
