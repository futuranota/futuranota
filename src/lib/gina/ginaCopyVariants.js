/**
 * Shared random line picker for Gina copy banks (prelude, headlines, etc.).
 * Pass `salt` in tests for a stable pick; omit in production for Math.random.
 */

/**
 * @template T
 * @param {T[]} pool
 * @param {number} [salt]
 * @returns {T}
 */
export function pickGinaRandom(pool, salt) {
  const list = Array.isArray(pool) ? pool : [];
  if (!list.length) return /** @type {T} */ ("");
  const s = Number.isFinite(salt) ? salt : Math.floor(Math.random() * list.length);
  return list[Math.abs(s) % list.length];
}

/** @param {number} n */
function docWordEs(n) {
  return n === 1 ? "documento" : "documentos";
}

/** @param {number} n */
function docWordEn(n) {
  return n === 1 ? "document" : "documents";
}

const PRELUDE_ES = [
  "Dame un segundo mientras pongo todo en orden...",
  "Un instante, déjame juntar las piezas...",
  "Un segundo, estoy organizando la información...",
  "Dame un momento...",
  "Un momento, déjame acomodar esto...",
  "Espera un instante...",
];

const PRELUDE_EN = [
  "Give me a second while I get everything in order...",
  "One moment — let me put the pieces together...",
  "One second, I’m organizing the information...",
  "Give me a moment...",
  "One moment, let me tidy this up...",
  "Hang on a second...",
];

/**
 * Random “wait…” prelude for search sequence.
 * @param {{ locale?: string, salt?: number }} [opts]
 */
export function pickGinaSearchPrelude(opts = {}) {
  const en = opts.locale === "en";
  return pickGinaRandom(en ? PRELUDE_EN : PRELUDE_ES, opts.salt);
}

const DOCS_BY_DEPT_ES = [
  (n) => `Se encontraron **${n}** ${docWordEs(n)} agrupados por departamentos.`,
  (n) => `¡Listo! Encontré **${n}** ${docWordEs(n)} organizados por departamentos.`,
  (n) => `Aquí tienes **${n}** ${docWordEs(n)} · agrupados por departamentos.`,
  (n) => `Encontré **${n}** ${docWordEs(n)} organizados por departamentos.`,
];

const DOCS_BY_DEPT_EN = [
  (n) => `Found **${n}** ${docWordEn(n)} grouped by departments.`,
  (n) => `Done! I found **${n}** ${docWordEn(n)} organized by departments.`,
  (n) => `Here are **${n}** ${docWordEn(n)} · grouped by departments.`,
  (n) => `I found **${n}** ${docWordEn(n)} organized by departments.`,
];

const DOCS_BY_STATUS_ES = [
  (n) => `Se encontraron **${n}** ${docWordEs(n)} agrupados por status.`,
  (n) => `¡Listo! Encontré **${n}** ${docWordEs(n)} organizados por status.`,
  (n) => `Aquí tienes **${n}** ${docWordEs(n)} · agrupados por status.`,
  (n) => `Encontré **${n}** ${docWordEs(n)} organizados por status (vencidos, en curso, pendientes…).`,
];

const DOCS_BY_STATUS_EN = [
  (n) => `Found **${n}** ${docWordEn(n)} grouped by status.`,
  (n) => `Done! I found **${n}** ${docWordEn(n)} organized by status.`,
  (n) => `Here are **${n}** ${docWordEn(n)} · grouped by status.`,
  (n) => `I found **${n}** ${docWordEn(n)} organized by status (past due, in progress, pending…).`,
];

/**
 * Random headline after listado completo (corpus, by department).
 * @param {{ count: number, locale?: string, salt?: number, layerNote?: string }} opts
 */
export function pickGinaDocsByDepartmentHeadline(opts = {}) {
  const en = opts.locale === "en";
  const n = Number(opts.count) || 0;
  const pool = en ? DOCS_BY_DEPT_EN : DOCS_BY_DEPT_ES;
  const fn = pickGinaRandom(pool, opts.salt);
  const line = typeof fn === "function" ? fn(n) : String(fn || "");
  return `${line}${opts.layerNote || ""}`;
}

/**
 * Random headline for week schedule table (grouped by document status).
 * @param {{ count: number, locale?: string, salt?: number, layerNote?: string }} opts
 */
export function pickGinaDocsByStatusHeadline(opts = {}) {
  const en = opts.locale === "en";
  const n = Number(opts.count) || 0;
  const pool = en ? DOCS_BY_STATUS_EN : DOCS_BY_STATUS_ES;
  const fn = pickGinaRandom(pool, opts.salt);
  const line = typeof fn === "function" ? fn(n) : String(fn || "");
  return `${line}${opts.layerNote || ""}`;
}

export const GINA_SEARCH_PRELUDE_ES = PRELUDE_ES;
export const GINA_SEARCH_PRELUDE_EN = PRELUDE_EN;

const LIST_REFINE_CAT_HINTS_ES = [
  "Si quieres puedo filtrarlos por una o mas de tus categorias disponibles ?",
];

const LIST_REFINE_CAT_HINTS_EN = [
  "Want me to filter them by one or more of your available categories?",
];

const LIST_REFINE_LAYER_HINTS_ES = [
  "Te dejo otra sugerencia: Si deseas tambien podemos sumar a la tabla los Horarios y Status.",
];

const LIST_REFINE_LAYER_HINTS_EN = [
  "Another suggestion: we can also add Schedule and Status to the table.",
];

const LIST_REFINE_RAIL_HINT_SINGULAR_ES =
  "Te resalté la columna lateral con un color representando al departamento al que pertenece. Los detalles estan en la parte baja de la tabla.";

const LIST_REFINE_RAIL_HINT_PLURAL_ES =
  "Te resalté las columnas laterales con variantes de colores representando al departamento al que le pertenece. Los detalles estan en la parte baja de la tabla.";

const LIST_REFINE_RAIL_HINT_SINGULAR_EN =
  "I highlighted the side column with a color representing the department it belongs to. Details are at the bottom of the table.";

const LIST_REFINE_RAIL_HINT_PLURAL_EN =
  "I highlighted the side columns with color variants representing the department each row belongs to. Details are at the bottom of the table.";

const LIST_REFINE_INTENT_HINT_ES = "Qué quieres lograr con los documentos hoy ?";

const LIST_REFINE_INTENT_HINT_EN = "What do you want to achieve with the documents today?";

/** Unassigned rail segment — not a real department. */
const UNASSIGNED_DEPT_NAME = "Uncategorized";

/**
 * Count real departments on the list rail (excludes unassigned).
 * @param {{ name?: string }[] | null | undefined} departmentRail
 * @returns {number}
 */
export function countGinaRealDepartments(departmentRail) {
  if (!Array.isArray(departmentRail)) return 0;
  return departmentRail.filter((seg) => {
    const name = String(seg?.name || "").trim();
    return name && name !== UNASSIGNED_DEPT_NAME && name !== "# Department";
  }).length;
}

/**
 * Microcopy for post-listado refine chips (fixed copy — user’s wording).
 * @param {{ locale?: string, salt?: number, departmentCount?: number }} [opts]
 * @returns {{ railHint: string | null, intentHint: string, categoryHint: string, layerHint: string }}
 */
export function pickGinaListRefineHints(opts = {}) {
  const en = opts.locale === "en";
  const n = Math.max(0, Number(opts.departmentCount) || 0);
  let railHint = null;
  if (n === 1) {
    railHint = en ? LIST_REFINE_RAIL_HINT_SINGULAR_EN : LIST_REFINE_RAIL_HINT_SINGULAR_ES;
  } else if (n > 1) {
    railHint = en ? LIST_REFINE_RAIL_HINT_PLURAL_EN : LIST_REFINE_RAIL_HINT_PLURAL_ES;
  }
  return {
    railHint,
    intentHint: en ? LIST_REFINE_INTENT_HINT_EN : LIST_REFINE_INTENT_HINT_ES,
    categoryHint: (en ? LIST_REFINE_CAT_HINTS_EN : LIST_REFINE_CAT_HINTS_ES)[0],
    layerHint: (en ? LIST_REFINE_LAYER_HINTS_EN : LIST_REFINE_LAYER_HINTS_ES)[0],
  };
}
