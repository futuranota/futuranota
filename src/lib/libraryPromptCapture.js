/** Delimiter for capturing a library prompt from document prose. */
export const LIBRARY_PROMPT_DELIM = "--";

/**
 * @typedef {Object} LibraryPromptCapture
 * @property {number} start
 * @property {number} end
 * @property {string} prompt
 * @property {string} raw
 */

/**
 * Closed `--prompt--` pairs in text (non-greedy). Empty inner is ignored.
 * @param {unknown} text
 * @returns {LibraryPromptCapture[]}
 */
export function listLibraryPromptCaptures(text) {
  const source = String(text ?? "");
  /** @type {LibraryPromptCapture[]} */
  const found = [];
  const re = /--([\s\S]+?)--/g;
  let match = re.exec(source);
  while (match) {
    const inner = String(match[1] || "").trim();
    if (inner) {
      found.push({
        start: match.index,
        end: match.index + match[0].length,
        prompt: inner,
        raw: match[0],
      });
    }
    match = re.exec(source);
  }
  return found;
}

/**
 * Capture that just closed in `next` (new pair vs `prev`).
 * Prefers a pair that ends at the end of `next` (caret after closing `--`).
 * @param {unknown} prev
 * @param {unknown} next
 * @returns {LibraryPromptCapture|null}
 */
export function findNewlyClosedLibraryPrompt(prev, next) {
  const before = listLibraryPromptCaptures(prev);
  const after = listLibraryPromptCaptures(next);
  if (!after.length) return null;

  const prevKeys = new Set(before.map((item) => `${item.start}:${item.prompt}`));
  const fresh = after.filter((item) => !prevKeys.has(`${item.start}:${item.prompt}`));
  if (!fresh.length) return null;

  const nextText = String(next ?? "");
  const atEnd = fresh.filter((item) => item.end === nextText.length);
  return (atEnd[atEnd.length - 1] || fresh[fresh.length - 1]) ?? null;
}

/**
 * Replace the wrapped `--prompt--` with the inner prompt (keep prose, drop delimiters).
 * @param {string} text
 * @param {LibraryPromptCapture} capture
 * @returns {string}
 */
export function stripLibraryPromptDelimiters(text, capture) {
  const source = String(text ?? "");
  if (!capture || capture.start < 0 || capture.end > source.length) return source;
  return `${source.slice(0, capture.start)}${capture.prompt}${source.slice(capture.end)}`;
}
