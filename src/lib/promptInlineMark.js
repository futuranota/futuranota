/**
 * Map inline clipboard styles to editor marks. Paper/transparent
 * backgrounds are not highlights — Word and Google Docs put those on every span.
 */

function channel(part) {
  const raw = String(part || "").trim();
  if (raw.endsWith("%")) return Math.round(Number(raw.slice(0, -1)) * 2.55);
  return Number(raw);
}

function parseColor(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value || /^(none|transparent|inherit|initial|unset|currentcolor)$/.test(value)) return null;
  if (value === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (value === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (value === "yellow") return { r: 255, g: 255, b: 0, a: 1 };
  if (value === "gold") return { r: 255, g: 215, b: 0, a: 1 };
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("");
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a,
    };
  }
  const rgb = value.match(/^rgba?\((.+)\)$/);
  if (!rgb) return null;
  const bits = rgb[1].split(/[\s,/]+/).filter(Boolean);
  if (bits.length < 3) return null;
  return {
    r: channel(bits[0]),
    g: channel(bits[1]),
    b: channel(bits[2]),
    a: bits[3] == null ? 1 : bits[3].endsWith("%") ? Number(bits[3].slice(0, -1)) / 100 : Number(bits[3]),
  };
}

function isPaperColor(color) {
  if (!color || !Number.isFinite(color.r)) return true;
  if (color.a < 0.12) return true;
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  return lum > 0.88 && sat < 0.22;
}

function firstColorToken(value) {
  const text = String(value || "").trim();
  const rgb = text.match(/rgba?\([^)]+\)/i);
  if (rgb) return rgb[0];
  const hex = text.match(/#[0-9a-f]{3,8}/i);
  if (hex) return hex[0];
  const named = text.match(/\b(yellow|gold|white|black|transparent|none)\b/i);
  return named ? named[1] : "";
}

function backgroundColorFromStyle(style) {
  const text = String(style || "");
  const mso = text.match(/(?:^|;)\s*mso-highlight\s*:\s*([^;]+)/i);
  if (mso) return mso[1].trim();
  const bgc = text.match(/(?:^|;)\s*background-color\s*:\s*([^;]+)/i);
  if (bgc) return bgc[1].trim();
  const bg = text.match(/(?:^|;)\s*background\s*:\s*([^;]+)/i);
  if (!bg) return "";
  return firstColorToken(bg[1]);
}

/** @param {string} [style] */
export function hasHighlightBackground(style) {
  const color = parseColor(backgroundColorFromStyle(style));
  return Boolean(color) && !isPaperColor(color);
}

/** @param {string} [style] */
export function markFromInlineStyle(style) {
  const text = String(style || "");
  if (hasHighlightBackground(text)) return "mark";
  if (/font-weight:\s*(bold|[6-9]00)/i.test(text)) return "strong";
  if (/font-style:\s*italic/i.test(text)) return "em";
  if (/line-through/i.test(text)) return "s";
  if (/(?:^|;)\s*text-decoration[^;]*underline/i.test(text) && !/text-decoration[^;]*none/i.test(text)) return "u";
  return "";
}
