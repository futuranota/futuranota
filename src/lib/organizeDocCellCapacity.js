/**
 * Estimate how many characters fit in an expanded writing TEXT cell.
 * Used by Organize to pack prose into available empty / partial cells.
 */

/** Fallback when DOM is unavailable or cells are too small to measure. */
export const DEFAULT_CELL_CHARS = 280;

/** Floor so tiny empty shells (24px) still count as a usable line slot. */
export const MIN_CELL_CHARS = 48;

/**
 * @param {{ widthPx?: number, heightPx?: number, fontSizePx?: number, lineHeightPx?: number }} metrics
 */
export function estimateCharsCapacity(metrics = {}) {
  const widthPx = Math.max(80, Number(metrics.widthPx) || 480);
  const heightPx = Math.max(16, Number(metrics.heightPx) || 72);
  const fontSizePx = Math.max(10, Number(metrics.fontSizePx) || 14);
  const lineHeightPx = Math.max(fontSizePx, Number(metrics.lineHeightPx) || fontSizePx * 1.45);
  const avgCharWidth = fontSizePx * 0.52;
  const charsPerLine = Math.max(12, Math.floor(widthPx / avgCharWidth));
  const lines = Math.max(1, Math.floor(heightPx / lineHeightPx));
  return Math.max(MIN_CELL_CHARS, charsPerLine * lines);
}

/**
 * @param {Element | null | undefined} el
 */
export function estimateCapacityFromElement(el) {
  if (!el || typeof el.getBoundingClientRect !== "function") {
    return DEFAULT_CELL_CHARS;
  }
  const rect = el.getBoundingClientRect();
  let fontSizePx = 14;
  let lineHeightPx = 20;
  let minHeightPx = 0;
  if (typeof window !== "undefined" && window.getComputedStyle) {
    const style = window.getComputedStyle(el);
    fontSizePx = parseFloat(style.fontSize) || fontSizePx;
    const lh = parseFloat(style.lineHeight);
    lineHeightPx = Number.isFinite(lh) ? lh : fontSizePx * 1.45;
    minHeightPx = parseFloat(style.minHeight) || 0;
  }
  const heightPx = Math.max(rect.height || 0, el.clientHeight || 0, minHeightPx, lineHeightPx);
  const widthPx = Math.max(rect.width || 0, el.clientWidth || 0, 200);
  return estimateCharsCapacity({ widthPx, heightPx, fontSizePx, lineHeightPx });
}

/**
 * Measure each writing TEXT field under a document root (expanded modal body).
 * @param {ParentNode | null | undefined} root
 * @returns {number[]}
 */
export function measureWritingCellCapacities(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  const fields = root.querySelectorAll(
    ".node-writing-block-stack__text .node-writing-text-field, .node-writing-block-stack__text .doc-text-block__field",
  );
  if (!fields.length) return [];
  return Array.from(fields).map((el) => estimateCapacityFromElement(el));
}

/**
 * Pick a representative cell size from measured capacities (median, floored).
 * @param {number[]} capacities
 */
export function resolvePackCellChars(capacities) {
  const list = (Array.isArray(capacities) ? capacities : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!list.length) return DEFAULT_CELL_CHARS;
  const mid = list[Math.floor(list.length / 2)];
  return Math.max(MIN_CELL_CHARS, Math.round(mid));
}

/**
 * Split prose into chunks that fit ~charsPerCell without cutting mid-word when possible.
 * Prefers paragraph / sentence boundaries.
 * @param {string} text
 * @param {number} charsPerCell
 * @returns {string[]}
 */
export function packTextIntoCellChunks(text, charsPerCell = DEFAULT_CELL_CHARS) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const limit = Math.max(MIN_CELL_CHARS, Number(charsPerCell) || DEFAULT_CELL_CHARS);
  if (raw.length <= limit) return [raw];

  const paragraphs = raw.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  /** @type {string[]} */
  const chunks = [];
  /** @type {string[]} */
  let buf = [];
  let bufLen = 0;

  const flush = () => {
    if (!buf.length) return;
    chunks.push(buf.join("\n\n"));
    buf = [];
    bufLen = 0;
  };

  for (const para of paragraphs) {
    if (para.length > limit) {
      flush();
      for (const piece of splitLongParagraph(para, limit)) {
        chunks.push(piece);
      }
      continue;
    }
    const nextLen = bufLen ? bufLen + 2 + para.length : para.length;
    if (bufLen && nextLen > limit) {
      flush();
    }
    buf.push(para);
    bufLen = bufLen ? bufLen + 2 + para.length : para.length;
  }
  flush();
  return chunks.length ? chunks : [raw];
}

/**
 * @param {string} para
 * @param {number} limit
 */
function splitLongParagraph(para, limit) {
  /** @type {string[]} */
  const out = [];
  let rest = para;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf(" ", limit);
    if (cut < Math.floor(limit * 0.45)) cut = limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
