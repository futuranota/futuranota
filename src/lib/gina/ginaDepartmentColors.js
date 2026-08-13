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
 * Category rail — same palette as department; used when Doc+Folder tables
 * group by category instead of department.
 * @param {object[]} docs
 * @returns {{ name: string, count: number, color: string }[]}
 */
export function buildGinaCategoryRail(docs = []) {
  /** @type {{ name: string, count: number }[]} */
  const ordered = [];
  /** @type {Map<string, number>} */
  const indexByName = new Map();

  for (const doc of docs) {
    const raw = doc?.category || doc?.hierarchy?.category || "";
    const name = String(raw).trim() || "# Category";
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
    color: seg.name === "# Category"
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

/** ES single letters (legacy / weekday field) indexed by Date#getDay() (0=Sun). */
const WEEKDAY_LETTER_ES = ["D", "L", "M", "X", "J", "V", "S"];
const WEEKDAY_LETTER_EN = ["S", "M", "T", "W", "T", "F", "S"];
/** Medium rail labels — 2-letter ES abbreviations (Lu, Ma…). */
const WEEKDAY_ABBR_ES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const WEEKDAY_ABBR_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
/** Full labels for legend */
const WEEKDAY_NAME_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEKDAY_NAME_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Weekday sidebar rail for “horarios de la semana”.
 * Rows should already be sorted by weekday then time.
 * @param {object[]} docs
 * @param {{ locale?: string, weekStartsOn?: 0|1 }} [opts]
 * @returns {{ name: string, letter: string, abbr: string, dayIndex: number, count: number, color: string }[]}
 */
export function buildGinaWeekdayRail(docs = [], opts = {}) {
  const locale = opts.locale === "en" ? "en" : "es";
  const weekStartsOn = opts.weekStartsOn === 0 ? 0 : 1;
  const letters = locale === "en" ? WEEKDAY_LETTER_EN : WEEKDAY_LETTER_ES;
  const abbrs = locale === "en" ? WEEKDAY_ABBR_EN : WEEKDAY_ABBR_ES;
  const names = locale === "en" ? WEEKDAY_NAME_EN : WEEKDAY_NAME_ES;
  const order = weekStartsOn === 0
    ? [0, 1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6, 0];

  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const doc of docs) {
    const idx = weekdayIndexFromDoc(doc);
    if (idx == null) continue;
    counts.set(idx, (counts.get(idx) || 0) + 1);
  }

  /** @type {{ name: string, letter: string, abbr: string, dayIndex: number, count: number, color: string }[]} */
  const segs = [];
  for (const dayIndex of order) {
    const count = counts.get(dayIndex) || 0;
    if (!count) continue;
    const paletteIndex = order.indexOf(dayIndex);
    segs.push({
      id: `wd-${dayIndex}`,
      name: names[dayIndex],
      letter: letters[dayIndex],
      abbr: abbrs[dayIndex],
      dayIndex,
      count,
      color: ginaDepartmentRailColor(paletteIndex, 7),
    });
  }
  return segs;
}

/**
 * @param {object} doc
 * @returns {number | null} 0–6
 */
function weekdayIndexFromDoc(doc) {
  const anchor = doc?.anchorAt || null;
  if (anchor) {
    const d = new Date(anchor);
    if (!Number.isNaN(d.getTime())) return d.getDay();
  }
  const letter = String(doc?.weekday || "").trim().toUpperCase();
  if (!letter) return null;
  const es = WEEKDAY_LETTER_ES.indexOf(letter);
  if (es >= 0) return es;
  // EN ambiguous S/T — prefer first match only for unique letters
  if (letter === "M") return 1;
  if (letter === "W") return 3;
  if (letter === "F") return 5;
  return null;
}

/**
 * Sort docs by weekday (weekStartsOn order) then anchorAt.
 * @param {object[]} docs
 * @param {{ weekStartsOn?: 0|1 }} [opts]
 */
export function sortDocsByWeekdayThenTime(docs = [], opts = {}) {
  const weekStartsOn = opts.weekStartsOn === 0 ? 0 : 1;
  const order = weekStartsOn === 0
    ? [0, 1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6, 0];
  const rank = (day) => {
    const i = order.indexOf(day);
    return i < 0 ? 99 : i;
  };
  return [...docs].sort((a, b) => {
    const da = weekdayIndexFromDoc(a);
    const db = weekdayIndexFromDoc(b);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    const ra = rank(da) - rank(db);
    if (ra !== 0) return ra;
    const ta = a?.anchorAt ? new Date(a.anchorAt).getTime() : 0;
    const tb = b?.anchorAt ? new Date(b.anchorAt).getTime() : 0;
    return ta - tb;
  });
}

