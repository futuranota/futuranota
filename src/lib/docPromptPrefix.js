/** Visible label at the start of a prose line (case-insensitive). */
export const DOC_PROMPT_PREFIX_LABEL = "prompt:";

/**
 * `prompt:` spans at the beginning of a line (after optional indent).
 * Only the prefix is highlighted — the rest of the line stays normal text.
 *
 * @param {unknown} text
 * @returns {{ start: number, end: number }[]}
 */
export function listPromptPrefixRanges(text) {
  const value = String(text ?? "");
  if (!value) return [];

  /** @type {{ start: number, end: number }[]} */
  const ranges = [];
  let lineStart = 0;

  for (let i = 0; i <= value.length; i += 1) {
    if (i < value.length && value[i] !== "\n") continue;

    const line = value.slice(lineStart, i);
    const match = line.match(/^(\s*)(prompt:)/i);
    if (match) {
      const prefixStart = lineStart + match[1].length;
      ranges.push({
        start: prefixStart,
        end: prefixStart + match[2].length,
      });
    }
    lineStart = i + 1;
  }

  return ranges;
}
