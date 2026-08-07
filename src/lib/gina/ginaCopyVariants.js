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

/**
 * Microcopy for post-listado refine chips (fixed copy — user’s wording).
 * @param {{ locale?: string, salt?: number }} [opts]
 * @returns {{ categoryHint: string, layerHint: string }}
 */
export function pickGinaListRefineHints(opts = {}) {
  const en = opts.locale === "en";
  return {
    categoryHint: (en ? LIST_REFINE_CAT_HINTS_EN : LIST_REFINE_CAT_HINTS_ES)[0],
    layerHint: (en ? LIST_REFINE_LAYER_HINTS_EN : LIST_REFINE_LAYER_HINTS_ES)[0],
  };
}
