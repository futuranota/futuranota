/** Line-start visual guide token (typed as two chars; mirror paints SVG). */
export const DOC_GUIDE_ARROW_TOKEN = "->";

/** `svg` (default) | `text` — override via localStorage `fn-guide-arrow-mode`. */
export const DOC_GUIDE_ARROW_RENDER_MODES = ["svg", "text"];

export function getGuideArrowRenderMode() {
  if (typeof window === "undefined") return "svg";
  const stored = String(window.localStorage.getItem("fn-guide-arrow-mode") || "").trim();
  return stored === "text" ? "text" : "svg";
}

/**
 * `->` spans at the beginning of a line (after optional indent).
 * Only the arrow token is highlighted — the rest of the line stays normal text.
 *
 * @param {unknown} text
 * @returns {{ start: number, end: number }[]}
 */
export function listGuideArrowRanges(text) {
  const value = String(text ?? "");
  if (!value) return [];

  /** @type {{ start: number, end: number }[]} */
  const ranges = [];
  let lineStart = 0;

  for (let i = 0; i <= value.length; i += 1) {
    if (i < value.length && value[i] !== "\n") continue;

    const line = value.slice(lineStart, i);
    const match = line.match(/^(\s*)(->)/);
    if (match) {
      const arrowStart = lineStart + match[1].length;
      ranges.push({
        start: arrowStart,
        end: arrowStart + DOC_GUIDE_ARROW_TOKEN.length,
      });
    }
    lineStart = i + 1;
  }

  return ranges;
}
