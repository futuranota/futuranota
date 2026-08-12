/**
 * Syntax bank: follow-ups that need lastTurn (“este”, modificar, ábrelo).
 * No schedule mutation — open / clarify only.
 */

import { foldGinaText } from "./ginaTimeScope.js";

/**
 * @typedef {"modify_ref" | "open_ref" | "open_first"} GinaLastTurnIntent
 */

/** Modify / change stems incl. conjugations + typos (modifiques / modiques). */
const MODIFY_ES = /\b(modif\w*|modiqu\w*|cambia\w*|mover|muev\w*|edit\w*|ajust\w*)\b/;
const MODIFY_EN = /\b(modify|modifying|change|changing|edit|editing|move|moving|adjust|adjusting)\b/;
const THIS_ES = /\b(este|esto|esta|ese|esa|calendario|horario|sheet|agenda|documento)\b/;
const THIS_EN = /\b(this|that|schedule|calendar|sheet|document)\b/;

/**
 * @param {string} text
 * @returns {GinaLastTurnIntent | null}
 */
export function parseLastTurnIntent(text) {
  const q = foldGinaText(text);
  if (!q) return null;

  // Don't steal classic schedule sheet asks (unless they also ask to modify "this")
  if (
    /\bhorarios\s+de\s+hoy\b/.test(q)
    && !MODIFY_ES.test(q)
    && !MODIFY_EN.test(q)
    && !/\b(este|esto|this)\b/.test(q)
  ) {
    return null;
  }

  if (
    /\b(abre|abrir|open)\s+(el\s+)?primero\b/.test(q)
    || /\bopen\s+the\s+first\b/.test(q)
    || /^el\s+primero\b/.test(q)
    || /^the\s+first\b/.test(q)
  ) {
    return "open_first";
  }

  // Open the (last) document — pronoun / bare doc, not a titled “abrir X…”
  if (
    /^(abrelo|abrilo|abre\s+ese|abre\s+esa|abre\s+esto|abre\s+este|open\s+it|open\s+that|open\s+this)([!?.\s]*)$/.test(q)
    || /\babre(me)?\s+(el\s+)?documento\b/.test(q)
    || /\babrir\s+(el\s+)?documento\b/.test(q)
    || /\bopen\s+(the\s+)?document\b/.test(q)
  ) {
    // If they named a specific title after documento, let focus_open handle it.
    if (/\bdocumento\s+\w{3,}/.test(q) && !/\bdocumento\s*$/.test(q.replace(/[!?.]+$/g, "").trim())) {
      const after = q.replace(/^.*\bdocumento\s+/, "").trim();
      if (after && !/^(por\s+favor|please|ahora|ya)$/.test(after)) {
        return null;
      }
    }
    return "open_ref";
  }

  if (MODIFY_ES.test(q) && THIS_ES.test(q)) {
    return "modify_ref";
  }

  if (MODIFY_EN.test(q) && THIS_EN.test(q)) {
    return "modify_ref";
  }

  // "quiero que me modiques…" / "I want you to change this…"
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
      ? "I don’t have a recent schedule anchored. Ask for today’s schedule first, then tell me what you want to change."
      : "No tengo anclado un horario reciente. Pide primero los horarios de hoy y después dime qué quieres modificar.";
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
