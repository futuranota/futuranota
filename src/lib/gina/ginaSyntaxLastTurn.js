/**
 * Syntax bank: follow-ups that need lastTurn
 * (“este”, modificar, ábrelo, filtrar flexibles+hoy, filtrar categoría, abrir {título}).
 * No schedule mutation — open / clarify / re-list only.
 */

import { foldGinaText } from "./ginaTimeScope.js";
import { formatCategoryPhrase, formatNeedlePhrase } from "./ginaCategoryGrammar.js";

/**
 * @typedef {
 *   | "modify_ref"
 *   | "open_ref"
 *   | "open_first"
 *   | "open_named"
 *   | "refine_exclude_flexible_today"
 *   | "refine_filter_category"
 *   | "refine_filter_department"
 *   | "refine_filter_folder"
 * } GinaLastTurnIntent
 */

/** Modify / change stems incl. conjugations + typos (modifiques / modiques). */
const MODIFY_ES = /\b(modif\w*|modiqu\w*|cambia\w*|mover|muev\w*|edit\w*|ajust\w*)\b/;
const MODIFY_EN = /\b(modify|modifying|change|changing|edit|editing|move|moving|adjust|adjusting)\b/;
const THIS_ES = /\b(este|esto|esta|ese|esa|calendario|horario|sheet|agenda|documento)\b/;
const THIS_EN = /\b(this|that|schedule|calendar|sheet|document)\b/;

/** Open verbs incl. subjunctive abras / abres (used in open_first / title extract). */
const OPEN_FIRST = /\b(abra[s]?|abre[s]?|abrir|open)\s+(el\s+)?primero\b/;

/**
 * Exclude flexibles + keep only timed-for-today (on anchored table).
 * @param {string} q folded
 */
function isRefineExcludeFlexibleToday(q) {
  if (!q) return false;
  // Classic global sheet ask — not a table refine
  if (
    /\bmuestra(?:me)?\s+los\s+horarios\s+de\s+hoy\b/.test(q)
    || /\bshow\s+me\s+today'?s\s+schedule\b/.test(q)
  ) {
    return false;
  }

  const mentionsFlexible = /\bflexibl\w*\b/.test(q) || /\bflexibles?\b/.test(q);
  const excludeCue = /\b(excluir|excluya[s]?|excluye|quitar|quita|sin|omitir|omite|sacar|saca)\b/.test(q);
  const todayCue = /\b(para\s+hoy|de\s+hoy|hoy)\b/.test(q) || /\b(for\s+)?today\b/.test(q);
  const scheduleCue = /\b(horario\w*|agenda|schedule\w*|timed)\b/.test(q)
    || /\btienen\s+horarios?\b/.test(q)
    || /\bwith\s+(a\s+)?(time|schedule)\b/.test(q);

  // "excluir flexibles … solo … hoy"
  if (mentionsFlexible && excludeCue && (todayCue || scheduleCue)) return true;
  // "solo los que tienen horarios para hoy" + flexible mention
  if (mentionsFlexible && todayCue && scheduleCue) return true;
  // "deja solamente los de hoy" + exclude flexible
  if (mentionsFlexible && excludeCue && todayCue) return true;

  return false;
}

/** Pivot anchored / corpus table to a live department. */
function isRefineFilterDepartment(q) {
  if (!q) return false;
  if (!/\b(departamento|depto)\b/.test(q)) return false;
  if (/\b(tabla\s+anterior|lista\s+anterior)\b/.test(q) && /\bfiltr\w*\b/.test(q)) {
    // "filtrame la tabla anterior por blogs" stays category refine
    return false;
  }
  return (
    /\b(entreg\w*|mejor|solo|filtr\w*|filter|mostrar|muestra\w*|dame|list\w*|quiero)\b/.test(q)
    || /\bdel\s+departamento\b/.test(q)
    || /\bdepartamento\s+(de|del)\b/.test(q)
  );
}

/** Pivot anchored / corpus table to a live folder ("mejor entregamelos por plan de negocio"). */
function isRefineFilterFolder(q) {
  if (!q) return false;
  if (/\b(departamento|depto)\b/.test(q)) return false;
  if (!/\bpor\b/.test(q)) return false;
  return (
    /\b(mejor|solo)\b/.test(q) && /\b(entreg\w*|dame|muestra\w*|trae\w*|list\w*)\b/.test(q)
    || /\b(entreg\w*|dame|muestra\w*|trae\w*)\w*\s+por\b/.test(q)
  );
}

/** Filter anchored table by category / keyword. */
function isRefineFilterCategory(q) {
  if (!q) return false;
  if (isRefineFilterFolder(q)) return false;
  // Opening a named doc from previous table is not a category filter
  if (/\b(abra|abre(?:me)?|abrir|open)\b/.test(q) && /\b(documento|document)\b/.test(q)) {
    return false;
  }
  const filterCue = /\b(filtr\w*|filtra|filter)\b/.test(q);
  const organizeCue = /\b(organiz\w*|orden\w*|reorganiz\w*|agrup\w*|quiero|entreg\w*|dame|muestra\w*|trae\w*)\b/.test(q);
  const tableCue = /\b(de\s+la\s+tabla\s+anterior|tabla\s+anterior|lista\s+anterior|previous\s+table|last\s+table|previous\s+list)\b/.test(q);
  const porCue = /\bpor\s+(todos\s+los|todas\s+las|la\s+categor[ií]a|los|las)\b/.test(q)
    || (/\bpor\b/.test(q) && !/\bpor\s+favor\b/.test(q) && organizeCue);
  // "quiero … tabla anterior" alone without por/filter is often open_named — require por or filtr
  if (tableCue && organizeCue && !filterCue && !porCue && !/\bpor\b/.test(q)) {
    return false;
  }
  if ((filterCue || organizeCue) && (tableCue || porCue)) return true;
  if (/\bfiltr\w*\s+(la\s+)?(tabla|lista)\s+anterior\b/.test(q)) return true;
  return false;
}

/**
 * Extract category / keyword needle from a table-refine utterance.
 * @param {string} text
 * @returns {string}
 */
export function extractLastTurnCategoryHint(text) {
  const raw = String(text || "").trim();
  const q = foldGinaText(raw);
  if (!q) return "";

  const stripNoise = (s) => String(s || "")
    .replace(/\b(por\s+favor|please|gina|tabla\s+anterior|lista\s+anterior|de\s+la\s+tabla\s+anterior)\b/gi, " ")
    .replace(/\b(todos|todas)\s+(los|las)\s+/gi, " ")
    .replace(/\b(la\s+categor[ií]a|category)\s+/gi, " ")
    .replace(/[.?!,;]+$/g, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const todoSobre = raw.match(/\btodo\s+sobre\s+(.+)$/i);
  if (todoSobre) {
    const hint = stripNoise(todoSobre[1]);
    if (hint.length >= 2) return hint;
  }

  const sobreOnly = raw.match(/\bsobre\s+(.+)$/i);
  if (sobreOnly && /\b(entreg\w*|dame|muestra\w*|todo)\b/i.test(raw)) {
    const hint = stripNoise(sobreOnly[1]);
    if (hint.length >= 2 && !/^(documentos?|docs?)$/i.test(hint)) return hint;
  }

  const porMatch = raw.match(/\bpor\s+(?:todos\s+los|todas\s+las|la\s+categor[ií]a\s+)?(.+)$/i);
  if (porMatch) {
    const hint = stripNoise(porMatch[1]);
    if (hint.length >= 2) return hint;
  }

  const filterMatch = raw.match(/\bfiltr\w*\s+(?:la\s+)?(?:tabla|lista)\s+anterior\s+(?:por\s+)?(.+)$/i);
  if (filterMatch) {
    const hint = stripNoise(filterMatch[1]);
    if (hint.length >= 2) return hint;
  }

  return "";
}

/**
 * Extract department needle from pivot / refine utterance.
 * @param {string} text
 * @returns {string}
 */
export function extractLastTurnDepartmentHint(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const stripNoise = (s) => String(s || "")
    .replace(/\b(por\s+favor|please|gina|ok|okay|gracias|thanks|mejor|tabla\s+anterior|lista\s+anterior)\b/gi, " ")
    .replace(/[.?!,;]+$/g, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const delDept = raw.match(/\bdel\s+departamento\s+(?:de|del)\s+(.+)$/i);
  if (delDept) {
    const hint = stripNoise(delDept[1]);
    if (hint.length >= 2) return hint;
  }

  const deptDe = raw.match(/\b(?:departamento|depto)\s+(?:de|del)\s+(.+)$/i);
  if (deptDe) {
    const hint = stripNoise(deptDe[1]);
    if (hint.length >= 2) return hint;
  }

  // Folder pivot ("por plan de negocio") — not a department hint
  if (/\bpor\s+/i.test(raw) && !/\b(departamento|depto)\b/i.test(raw)) {
    return "";
  }

  const sobre = raw.match(/\b(?:sobre|de|del|en)\s+(?:el\s+)?(?:departamento\s+(?:de|del)\s+)?(.+)$/i);
  if (sobre && /\b(revisar|entreg\w*|mejor|solo)\b/i.test(raw)) {
    const hint = stripNoise(sobre[1]);
    if (hint.length >= 2 && !/^(documentos?|docs?)$/i.test(hint)) return hint;
  }

  return "";
}

/**
 * Folder needle from "mejor entregamelos por plan de negocio".
 * @param {string} text
 * @returns {string}
 */
export function extractLastTurnFolderHint(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const por = raw.match(/\bpor\s+(.+)$/i);
  if (!por) return "";
  const hint = String(por[1] || "")
    .replace(/\b(por\s+favor|please|gina)\b/gi, " ")
    .replace(/[.?!,;]+$/g, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return hint.length >= 2 ? hint : "";
}

/**
 * @param {string} raw
 */
function cleanOpenTitle(raw) {
  return String(raw || "")
    .replace(/^[«"']+|[»"']+$/g, "")
    .replace(/\b(por\s+favor|please|ahora|ya|gracias)\b/gi, " ")
    .replace(/[!?.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Title after “documento …” / open verb (for open_named).
 * @param {string} text
 * @returns {string | null}
 */
export function extractLastTurnOpenTitle(text) {
  const q = foldGinaText(text);
  if (!q) return null;

  const afterDoc = q.match(/\bdocumento\s+(.+)$/);
  if (afterDoc) {
    const title = cleanOpenTitle(afterDoc[1]);
    if (title && title.length >= 2 && !/^(por\s+favor|please|ahora|ya)$/.test(title)) {
      return title;
    }
  }

  const afterOpen = q.match(
    /\b(?:abra[s]?|abre(?:me)?|abrir|open)\s+(?:el\s+)?(?:documento\s+)?(.+)$/,
  );
  if (afterOpen) {
    const title = cleanOpenTitle(afterOpen[1]);
    // Ignore bare pronouns
    if (
      title
      && title.length >= 3
      && !/^(ese|esa|esto|este|it|that|this|primero|first|documento|document)$/.test(title)
    ) {
      return title;
    }
  }

  return null;
}

/**
 * @param {string} text
 * @returns {GinaLastTurnIntent | null}
 */
export function parseLastTurnIntent(text) {
  const q = foldGinaText(text);
  if (!q) return null;

  // Table refine first — before classic "horarios de hoy" null-out
  if (isRefineExcludeFlexibleToday(q)) {
    return "refine_exclude_flexible_today";
  }

  if (isRefineFilterCategory(q)) {
    return "refine_filter_category";
  }

  if (isRefineFilterDepartment(q)) {
    return "refine_filter_department";
  }

  if (isRefineFilterFolder(q)) {
    return "refine_filter_folder";
  }

  // Don't steal classic schedule sheet asks (unless modify "this")
  if (
    /\bhorarios\s+de\s+hoy\b/.test(q)
    && !MODIFY_ES.test(q)
    && !MODIFY_EN.test(q)
    && !/\b(este|esto|this)\b/.test(q)
    && !/\bflexibl\w*\b/.test(q)
  ) {
    return null;
  }

  if (
    OPEN_FIRST.test(q)
    || /\bopen\s+the\s+first\b/.test(q)
    || /^el\s+primero\b/.test(q)
    || /^the\s+first\b/.test(q)
  ) {
    return "open_first";
  }

  const namedTitle = extractLastTurnOpenTitle(text);
  const fromPrevTable = /\b(de\s+la\s+tabla\s+anterior|tabla\s+anterior|from\s+the\s+(previous|last)\s+(table|list))\b/.test(q);
  const mentionsDocumento = /\bdocumento\b/.test(q) || /\bdocument\b/.test(q);
  // Require "documento" or "tabla anterior" — bare "Abrir Blog Post" stays global focus_open.
  if (namedTitle && (fromPrevTable || mentionsDocumento)) {
    return "open_named";
  }

  // Open the (last) document — pronoun / bare doc, not a titled “abrir X…”
  if (
    /^(abrelo|abrilo|abre\s+ese|abre\s+esa|abre\s+esto|abre\s+este|open\s+it|open\s+that|open\s+this)([!?.\s]*)$/.test(q)
    || (
      (/\babre(me)?\s+(el\s+)?documento\b/.test(q)
        || /\babra[s]?\s+(el\s+)?documento\b/.test(q)
        || /\babrir\s+(el\s+)?documento\b/.test(q)
        || /\bopen\s+(the\s+)?document\b/.test(q))
      && !namedTitle
    )
  ) {
    return "open_ref";
  }

  if (MODIFY_ES.test(q) && THIS_ES.test(q)) {
    return "modify_ref";
  }

  if (MODIFY_EN.test(q) && THIS_EN.test(q)) {
    return "modify_ref";
  }

  if (
    /\b(quiero|necesito)\s+(que\s+)?(me\s+)?(modif\w*|modiqu\w*|cambia\w*|edites?|muevas?)\b/.test(q)
    && THIS_ES.test(q)
  ) {
    return "modify_ref";
  }

  if (
    /\b(i\s+want|i\s+need)\s+(you\s+to\s+)?(modify|change|edit|move)\b/.test(q)
    && THIS_EN.test(q)
  ) {
    return "modify_ref";
  }

  return null;
}

/**
 * @param {string} text
 */
export function wantsGinaLastTurnFollowUp(text) {
  return parseLastTurnIntent(text) != null;
}

/**
 * Match a title needle against lastTurn (or any) doc list.
 * @param {string} titleNeedle
 * @param {Array<{ id?: string, title?: string, name?: string }>} documents
 * @returns {string | null} document id
 */
export function matchLastTurnDocumentId(titleNeedle, documents) {
  const needle = foldGinaText(titleNeedle);
  if (!needle || needle.length < 2) return null;
  const list = Array.isArray(documents) ? documents : [];
  let best = null;
  let bestLen = 0;
  for (const d of list) {
    if (!d?.id) continue;
    const title = foldGinaText(d.title || d.name || "");
    if (!title || title.length < 2) continue;
    if (title === needle || needle.includes(title) || title.includes(needle)) {
      if (title.length > bestLen) {
        best = String(d.id);
        bestLen = title.length;
      }
    }
  }
  return best;
}

/**
 * @param {{
 *   locale?: "es"|"en",
 *   hasLastTurn?: boolean,
 *   refKind?: string | null,
 *   documents?: Array<{ id?: string, title?: string }>,
 * }} opts
 */
export function buildLastTurnModifyMessage(opts = {}) {
  const en = opts.locale === "en";
  const docs = Array.isArray(opts.documents) ? opts.documents : [];
  const refKind = opts.refKind || null;

  if (!opts.hasLastTurn) {
    return en
      ? "I don’t have a recent list anchored. Ask for the department docs or today’s schedule first, then tell me what to change."
      : "No tengo anclada una lista reciente. Pide primero los docs del departamento o los horarios de hoy y después dime qué quieres modificar.";
  }

  if (refKind === "schedule") {
    if (docs.length === 0) {
      return en
        ? "That schedule was empty — nothing to open yet. Ask again for today’s schedule when you have timed docs."
        : "Ese horario estaba vacío — no hay documento para abrir. Pide de nuevo los horarios de hoy cuando haya docs con hora.";
    }
    return en
      ? "From the schedule I just showed — I don’t move schedules myself yet. Which document do you want to open to edit?"
      : "Del horario que te mostré — aún no muevo schedules yo. ¿Qué documento quieres abrir para editarlo?";
  }

  if (refKind === "folder") {
    return en
      ? "The last result was that folder list. I can’t rewrite it here — which document do you want to open?"
      : "El último resultado fue esa lista del folder. Aquí no la reescribo — ¿qué documento quieres abrir?";
  }

  if (docs.length) {
    return en
      ? "I still have the last list. Which document do you want to open?"
      : "Todavía tengo la última lista. ¿Qué documento quieres abrir?";
  }

  return en
    ? "I don’t have a clear document from the last turn. Ask for today’s schedule or name the document."
    : "No tengo claro un documento del último turno. Pide los horarios de hoy o nombra el documento.";
}

/**
 * Short copy after refining anchored table (no save-reference pitch).
 * @param {{
 *   locale?: "es"|"en",
 *   department?: string | null,
 *   count?: number,
 * }} opts
 */
export function buildLastTurnRefineMessage(opts = {}) {
  const en = opts.locale === "en";
  const dept = String(opts.department || "").trim();
  const n = Number(opts.count) || 0;
  if (en) {
    return dept
      ? `${dept} — excluding flexible, only timed for today (${n}).`
      : `Excluding flexible — only timed for today (${n}).`;
  }
  return dept
    ? `${dept} · sin flexibles · solo horarios de hoy (${n}).`
    : `Sin flexibles · solo horarios de hoy (${n}).`;
}

/**
 * Copy after category / keyword refine on anchored table.
 * @param {{
 *   locale?: "es"|"en",
 *   matchKind?: "category" | "department" | "title" | "empty",
 *   department?: string | null,
 *   category?: string | null,
 *   needle?: string | null,
 *   folderCount?: number,
 *   singleFolderName?: string | null,
 *   count?: number,
 * }} opts
 */
export function buildLastTurnCategoryRefineMessage(opts = {}) {
  const en = opts.locale === "en";
  const matchKind = opts.matchKind || "category";
  const n = Number(opts.count) || 0;
  const dept = String(opts.department || "").trim();
  const category = String(opts.category || "").trim();
  const needle = String(opts.needle || category || "").trim();
  const folderCount = Number(opts.folderCount) || 0;
  const singleFolder = String(opts.singleFolderName || "").trim();

  if (matchKind === "empty") {
    const word = formatNeedlePhrase(needle, { locale: en ? "en" : "es" });
    return en
      ? `I haven't found absolutely anything about ${word}.`
      : `No he encontrado absolutamente nada sobre ${word}.`;
  }

  if (matchKind === "title") {
    const word = formatNeedlePhrase(needle, { locale: en ? "en" : "es" });
    return en
      ? `I found this information containing the word «${word}» (${n}). Here you go.`
      : `Encontré esta información que contiene la palabra «${word}» (${n}). Aquí te la muestro.`;
  }

  if (matchKind === "department") {
    return en
      ? `${dept} — ${n} document${n === 1 ? "" : "s"} in that department.`
      : `${dept} — ${n} documento${n === 1 ? "" : "s"} en ese departamento.`;
  }

  const catPhrase = formatCategoryPhrase(category || needle, { locale: en ? "en" : "es" });
  if (folderCount === 1 && singleFolder) {
    return en
      ? `I found a single folder with the **${category || needle}** category: **${singleFolder}**. Here are the ${n} document${n === 1 ? "" : "s"}.`
      : `Te encontré un solo folder que contiene la categoría ${category || needle}: ${singleFolder}. Aquí te muestro ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
  }
  if (folderCount > 1) {
    return en
      ? `I found folders with the **${category || needle}** category (${n} document${n === 1 ? "" : "s"}). Here you go.`
      : `Te encontré los folders que contienen la categoría ${category || needle}. Aquí te muestro ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
  }
  const deptBit = dept
    ? (en ? `In **${dept}**` : `Del departamento de ${dept}, ${catPhrase.ofPhrase}`)
    : catPhrase.ofPhrase;
  return en
    ? `${deptBit} — ${n} document${n === 1 ? "" : "s"} with schedule metadata when applicable.`
    : `${deptBit}, aquí tienes ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
}

/**
 * Copy after department pivot on anchored / corpus table.
 * @param {{
 *   locale?: "es"|"en",
 *   department?: string | null,
 *   count?: number,
 * }} opts
 */
export function buildLastTurnDepartmentRefineMessage(opts = {}) {
  const en = opts.locale === "en";
  const dept = String(opts.department || "").trim();
  const n = Number(opts.count) || 0;
  if (!dept) {
    return en
      ? `Here are ${n} document${n === 1 ? "" : "s"}.`
      : `Aquí tienes ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
  }
  return en
    ? `From **${dept}** — ${n} document${n === 1 ? "" : "s"}.`
    : `Del departamento de ${dept}, aquí tienes ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
}

/**
 * Copy after folder pivot on anchored / corpus table.
 * @param {{
 *   locale?: "es"|"en",
 *   folderName?: string | null,
 *   department?: string | null,
 *   count?: number,
 * }} opts
 */
export function buildLastTurnFolderRefineMessage(opts = {}) {
  const en = opts.locale === "en";
  const folder = String(opts.folderName || "").trim();
  const dept = String(opts.department || "").trim();
  const n = Number(opts.count) || 0;
  if (!folder) {
    return en
      ? `Here are ${n} document${n === 1 ? "" : "s"}.`
      : `Aquí tienes ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
  }
  const deptBit = dept
    ? (en ? `in **${dept}**` : `del departamento de ${dept}`)
    : "";
  return en
    ? `Folder **${folder}**${deptBit ? ` ${deptBit}` : ""} — ${n} document${n === 1 ? "" : "s"}.`
    : `Del folder ${folder}${deptBit ? `, ${deptBit}` : ""}, aquí tienes ${n === 1 ? "el documento" : `los ${n} documentos`}.`;
}

/**
 * @param {{
 *   locale?: "es"|"en",
 *   documents?: Array<{ id?: string, title?: string }>,
 * }} [opts]
 */
export function buildLastTurnModifyChips(opts = {}) {
  const en = opts.locale === "en";
  const docs = Array.isArray(opts.documents) ? opts.documents : [];
  /** @type {Array<{ id: string, label: string, text: string, primary?: boolean }>} */
  const chips = [];

  for (const d of docs.slice(0, 5)) {
    if (!d?.id) continue;
    const title = String(d.title || "").trim() || (en ? "document" : "documento");
    chips.push({
      id: `last_turn_open_${d.id}`,
      label: en ? `Open «${title}»` : `Abrir «${title}»`,
      text: `GinaOpenDocument:${d.id}`,
      primary: chips.length === 0,
    });
  }

  chips.push({
    id: "last_turn_resheet",
    label: en ? "Today's schedule" : "Horarios de hoy",
    text: en ? "Show me today's schedule" : "Muéstrame los horarios de hoy",
  });

  return chips;
}
