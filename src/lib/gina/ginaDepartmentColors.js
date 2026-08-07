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
