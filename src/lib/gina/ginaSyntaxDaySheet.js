/**
 * Syntax bank: day reference sheet (guardar / abrir / tachar / siguiente).
 * Pattern: every new Gina intent ships a ginaSyntax*.js + tests of variants.
 */

import { foldGinaText } from "./ginaTimeScope.js";

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isDaySheetReopenIntent(text) {
  const q = foldGinaText(text);
  if (!q) return false;
  if (/\bhorario\s+del\s+d[ií]a\b/.test(q)) return true;
  if (/\bsheet\s+del\s+d[ií]a\b/.test(q)) return true;
  if (/\btabla\s+de\s+referencia(\s+del\s+d[ií]a)?\b/.test(q)) return true;
  if (/\babrir\s+(el\s+)?(horario|sheet)(\s+del\s+d[ií]a)?\b/.test(q)) return true;
  if (/\babre(me)?\s+(el\s+)?(horario|sheet)(\s+del\s+d[ií]a)?\b/.test(q)) return true;
  if (/\bvisualizar\s+(el\s+)?horario\s+del\s+d[ií]a\b/.test(q)) return true;
  if (/\bopen\s+(my\s+)?(day\s+)?(sheet|schedule)\b/.test(q)) return true;
  if (/\bday\s+(reference\s+)?(table|sheet|schedule)\b/.test(q)) return true;
  if (/\bshow\s+(me\s+)?(the\s+)?day\s+(sheet|schedule)\b/.test(q)) return true;
  return false;
}

/**
 * Skip anchoring the day sheet (gate chip after save offer).
 * @param {string} text
 * @returns {boolean}
 */
export function isDaySheetSkipSaveIntent(text) {
  const q = foldGinaText(text);
  if (!q) return false;
  if (/\bseguir\s+sin\s+guardar\b/.test(q)) return true;
  if (/\bsin\s+guardar\s+(el\s+)?(sheet|tabla)(\s+del\s+d[ií]a)?\b/.test(q)) return true;
  if (/\bcontinue\s+without\s+saving\b/.test(q)) return true;
  if (/\bskip\s+(saving\s+)?(the\s+)?(day\s+)?sheet\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isDaySheetSaveIntent(text) {
  if (isDaySheetSkipSaveIntent(text)) return false;
  const q = foldGinaText(text);
  if (!q) return false;
  if (/\bguardar\s+(esta\s+)?(tabla|sheet|horario|calendario)(\s+de\s+referencia)?(\s+del\s+d[ií]a)?\b/.test(q)) return true;
  if (/\bguarda(me)?\s+(esta\s+)?(tabla|sheet|horario|calendario)\b/.test(q)) return true;
  if (/\banclar\s+(esta\s+)?(tabla|sheet|horario|calendario)\b/.test(q)) return true;
  if (/\bsave\s+(this\s+)?(day\s+)?(reference\s+)?(table|sheet|schedule|calendar)\b/.test(q)) return true;
  if (/\banchor\s+(this\s+)?(day\s+)?(sheet|schedule)\b/.test(q)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isDaySheetCompleteConfirmIntent(text) {
  const q = foldGinaText(text);
  if (!q) return false;
  if (/\bconfirmar\s+(marcar\s+)?(como\s+)?completed?\b/.test(q)) return true;
  if (/\bconfirm\s+mark\s+(as\s+)?completed?\b/.test(q)) return true;
  if (/\bs[ií],?\s+m[aá]rcalo\s+(como\s+)?completed?\b/.test(q)) return true;
  return false;
}

/**
 * User wants to mark a doc completed (needs confirm unless confirm phrasing).
 * @param {string} text
 * @returns {{ match: boolean, titleHint: string | null }}
 */
export function parseDaySheetCompleteIntent(text) {
  const raw = String(text || "").trim();
  const q = foldGinaText(text);
  if (!q) return { match: false, titleHint: null };
  if (isDaySheetCompleteConfirmIntent(text)) {
    return { match: false, titleHint: null };
  }

  const titled = raw.match(
    /\b(?:ya\s+)?termin[eé]\s+(?:el\s+documento\s+|este\s+documento\s+|con\s+)?["«"]?(.+?)["»"]?\s*$/i,
  ) || raw.match(
    /\bt[aá]cha(?:me|lo)?\s+(?:el\s+documento\s+)?["«"]?(.+?)["»"]?\s*$/i,
  ) || raw.match(
    /\bmarcar?\s+(?:como\s+)?completed?\s+(?:el\s+documento\s+)?["«"]?(.+?)["»"]?\s*$/i,
  ) || raw.match(
    /\bi\s+finished\s+(?:the\s+document\s+|with\s+)?["']?(.+?)["']?\s*$/i,
  ) || raw.match(
    /\bmark\s+(?:as\s+)?completed?\s+["']?(.+?)["']?\s*$/i,
  );

  if (titled?.[1]) {
    const hint = String(titled[1]).trim().replace(/[?.!]+$/, "");
    if (!hint || /^(este|eso|el|la|this|it|documento|document)$/i.test(hint)) {
      return { match: true, titleHint: null };
    }
    return { match: true, titleHint: hint };
  }

  if (/\b(?:ya\s+)?termin[eé]\b/.test(q)) return { match: true, titleHint: null };
  if (/\bt[aá]cha(me|lo|r)?\b/.test(q)) return { match: true, titleHint: null };
  if (/\bi\s+finished\b/.test(q)) return { match: true, titleHint: null };
  if (/\bmark\s+(as\s+)?completed?\b/.test(q)) return { match: true, titleHint: null };
  return { match: false, titleHint: null };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isDaySheetNextIntent(text) {
  const q = foldGinaText(text);
  if (!q) return false;
  if (/\b(quiero\s+ir\s+al\s+)?siguiente(\s+documento)?\b/.test(q)) return true;
  if (/\bqu[eé]\s+sigue\b/.test(q)) return true;
  if (/\bal\s+siguiente\b/.test(q)) return true;
  if (/\bnext\s+(document|doc|one)?\b/.test(q)) return true;
  if (/\bwhat('?s|\s+is)\s+next\b/.test(q)) return true;
  return false;
}
