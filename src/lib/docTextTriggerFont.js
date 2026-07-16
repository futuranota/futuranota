import { rangesToSegments } from "./docTextBoldRanges.js";

/** @typedef {{ start: number, end: number }} TriggerRange */

export const DOC_TRIGGER_CHARS = Object.freeze([":", ")"]);

/**
 * Ranges for non-whitespace tokens that contain `:` or `)`.
 * Space / newline ends the token — rest of the text stays normal.
 *
 * `a) hola` → only "a)" is highlighted
 * `1:1 more` → only "1:1" is highlighted
 */
export function triggerTokenRanges(text, triggers = DOC_TRIGGER_CHARS) {
  const str = String(text ?? "");
  if (!str || !triggers.length) return [];

  const set = new Set(triggers);
  /** @type {TriggerRange[]} */
  const ranges = [];
  let i = 0;
  while (i < str.length) {
    if (/\s/.test(str[i])) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < str.length && !/\s/.test(str[i])) i += 1;
    const token = str.slice(start, i);
    for (const ch of token) {
      if (set.has(ch)) {
        ranges.push({ start, end: i });
        break;
      }
    }
  }
  return ranges;
}

export function hasTriggerTokens(text, triggers = DOC_TRIGGER_CHARS) {
  return triggerTokenRanges(text, triggers).length > 0;
}

/** @returns {{ type: 'plain'|'bold', text: string }[]} */
export function triggerTokenSegments(text, triggers = DOC_TRIGGER_CHARS) {
  return rangesToSegments(text, triggerTokenRanges(text, triggers));
}
