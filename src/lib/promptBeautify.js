import { liftPromptPlaceholders } from "./promptVariables.js";

const FICHA = /(?<![\w@#/])(?:https?:\/\/[^\s<]+|https?[^\s<]+|#[^\s<]+|[^\s<]*@[^\s<]+)/gi;

/**
 * Yellow highlight for fichas: leading #, leading http/https, or a token that contains @.
 * Skips text already inside <mark> and {{variable}} tokens.
 * @param {unknown} value
 * @returns {string}
 */
export function highlightFichas(value) {
  const text = typeof value === "string" ? value : "";
  const parts = text.split(/(<mark>[\s\S]*?<\/mark>|\{\{[\s\S]*?\}\})/gi);
  return parts.map((part) => {
    if (/^<mark>/i.test(part) || part.startsWith("{{")) return part;
    return part.replace(FICHA, (token) => {
      const core = token.replace(/[.,;:!?)]+$/g, "");
      const rest = token.slice(core.length);
      if (!core || core === "#" || core === "@") return token;
      return `<mark>${core}</mark>${rest}`;
    });
  }).join("");
}

const PASTED_ATOM = /(<strong>[\s\S]*?<\/strong>|<mark>[\s\S]*?<\/mark>|\{\{[\s\S]*?\}\})/gi;

function isQuestionSentence(sentence) {
  const plain = sentence.replace(/<[^>]+>/g, "").trim();
  return plain.startsWith("?") || plain.endsWith("?");
}

function boldWord(word) {
  const core = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!core) return word;
  const letters = core.match(/\p{L}/gu) || [];
  const allCaps = letters.length >= 2 && letters.every((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
  if (!allCaps && !/\d/.test(core)) return word;
  const at = word.indexOf(core);
  return `${word.slice(0, at)}<strong>${core}</strong>${word.slice(at + core.length)}`;
}

/**
 * Bold a question sentence, an all-caps word, or a word that contains a digit.
 * @param {unknown} value
 * @returns {string}
 */
export function emphasizePastedText(value) {
  const text = typeof value === "string" ? value : "";
  const bits = text.split(/((?<=[.!?])\s+|\n+)/);
  return bits.map((bit) => {
    if (!bit || /^\s+$/.test(bit)) return bit;
    if (isQuestionSentence(bit)) {
      if (/^<strong>[\s\S]*<\/strong>$/i.test(bit.trim())) return bit;
      return `<strong>${bit}</strong>`;
    }
    return bit.split(PASTED_ATOM).map((part) => {
      if (!part || part.startsWith("{{") || /^<strong>/i.test(part)) return part;
      if (/^<mark>/i.test(part)) {
        const inner = part.replace(/<\/?mark>/gi, "");
        const letters = inner.match(/\p{L}/gu) || [];
        const allCaps = letters.length >= 2 && letters.every((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
        if (allCaps || /\d/.test(inner)) return `<strong>${part}</strong>`;
        return part;
      }
      return part.split(/(\s+)/).map((word) => (/^\s+$/.test(word) ? word : boldWord(word))).join("");
    }).join("");
  }).join("");
}

const KEPT_BLOCK = /(<h1>[\s\S]*?<\/h1>|<ul>[\s\S]*?<\/ul>)/gi;

function paintMarks(value) {
  const text = typeof value === "string" ? value : "";
  const paint = (part) => emphasizePastedText(highlightFichas(part));
  KEPT_BLOCK.lastIndex = 0;
  return text.split(KEPT_BLOCK).map((part) => {
    if (/^<h1>/i.test(part)) return part;
    if (/^<ul>/i.test(part)) {
      return part.replace(/<li>([\s\S]*?)<\/li>/gi, (_, inner) => `<li>${paint(inner)}</li>`);
    }
    return paint(part);
  }).join("");
}

/**
 * Marks both fields in place. Variables are lifted only from the prompt.
 * Placeholders left in the instructions stay as written text.
 * @param {unknown} description
 * @param {unknown} prompt
 * @param {object[]} variables
 */
export function beautifyPromptFields(description, prompt, variables) {
  const lifted = liftPromptPlaceholders(prompt, variables || []);
  return {
    description: paintMarks(description),
    prompt: paintMarks(lifted.prompt),
    variables: lifted.variables,
  };
}
