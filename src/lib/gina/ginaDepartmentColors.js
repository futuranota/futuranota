/**
 * Stable department colors for Gina document-list rail + legend.
 * Dark-surface friendly (#151515). Cycles if more depts than slots.
 */

/** @type {string[]} */
export const GINA_DEPT_RAIL_COLORS = [
  "#008AF5",
  "#57BC6C",
  "#EAA65D",
  "#9675FF",
  "#E87898",
  "#3db8a8",
  "#D88840",
  "#5a88e0",
];

/** Unassigned / Independent inbox */
export const GINA_DEPT_RAIL_UNASSIGNED = "#8a8a8a";

/**
 * @param {number} index
 * @param {number} [total]
 */
export function ginaDepartmentRailColor(index, total = GINA_DEPT_RAIL_COLORS.length) {
  const n = Math.max(1, GINA_DEPT_RAIL_COLORS.length);
  if (total > 0 && total <= n) {
    // Spread across the palette when few departments
    const step = Math.max(1, Math.floor(n / total));
    return GINA_DEPT_RAIL_COLORS[(index * step) % n];
  }
  return GINA_DEPT_RAIL_COLORS[index % n];
}

/**
 * Build ordered rail segments from mapped document rows (already dept-sorted).
 * Collapses all rows of the same department into one segment (first-seen order).
 * Use for corpus listados where rows are sorted by department.
 * @param {object[]} docs
 * @returns {{ name: string, count: number, color: string }[]}
 */
export function buildGinaDepartmentRail(docs = []) {
  /** @type {{ name: string, count: number }[]} */
  const ordered = [];
  /** @type {Map<string, number>} */
  const indexByName = new Map();

  for (const doc of docs) {
    const raw = doc?.department || doc?.hierarchy?.department || "";
    const name = String(raw).trim() || "# Department";
    if (indexByName.has(name)) {
      ordered[indexByName.get(name)].count += 1;
    } else {
      indexByName.set(name, ordered.length);
      ordered.push({ name, count: 1 });
    }
  }

  const total = ordered.length;
  return ordered.map((seg, i) => ({
    name: seg.name,
    count: seg.count,
    color: seg.name === "# Department"
      ? GINA_DEPT_RAIL_UNASSIGNED
      : ginaDepartmentRailColor(i, total),
  }));
}

/**
 * Contiguous runs in row order — merge only adjacent same-department rows.
 * Use for chronologically sorted tables (today overview) so rail colors
 * align with each row when departments interleave.
 *
 * @param {object[]} docs
 * @param {{ colorByDept?: Record<string, string> }} [opts]
 * @returns {{ name: string, count: number, color: string }[]}
 */
export function buildGinaDepartmentRailRuns(docs = [], opts = {}) {
  const colorByDept = opts.colorByDept && typeof opts.colorByDept === "object"
    ? opts.colorByDept
    : {};
  /** @type {{ name: string, count: number, color: string }[]} */
  const runs = [];
  /** @type {Map<string, number>} first-seen index for palette fallback */
  const firstIndex = new Map();

  for (const doc of docs) {
    const raw = doc?.department || doc?.hierarchy?.department || "";
    const name = String(raw).trim() || "—";
    if (!firstIndex.has(name)) firstIndex.set(name, firstIndex.size);

    const color = String(doc?.departmentColor || "").trim()
      || colorByDept[name]
      || (name === "# Department" || name === "—"
        ? GINA_DEPT_RAIL_UNASSIGNED
        : ginaDepartmentRailColor(firstIndex.get(name), Math.max(1, firstIndex.size)));

    const last = runs[runs.length - 1];
    if (last && last.name === name) {
      last.count += 1;
    } else {
      runs.push({ name, count: 1, color });
    }
  }

  return runs;
}
