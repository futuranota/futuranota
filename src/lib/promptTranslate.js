import { apiClient } from "../api/client.js";

const PROTECT = /<\/?[a-zA-Z][^>]*>|\{\{[^{}]+\}\}|https?:\/\/[^\s<]+|--\/\/[^\n<]*?\/\/--/g;
const BATCH = 40;
const CHUNK = 4000;

/**
 * Split desk text so tags, markers, variables, and URLs stay out of translation.
 * @param {string} text
 * @returns {{ keep: boolean, value: string }[]}
 */
export function splitProtected(text) {
  const source = String(text || "");
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(PROTECT)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ keep: false, value: source.slice(last, index) });
    parts.push({ keep: true, value: match[0] });
    last = index + match[0].length;
  }
  if (last < source.length) parts.push({ keep: false, value: source.slice(last) });
  return parts;
}

/**
 * @param {string} value
 * @param {number} [limit]
 */
export function chunkText(value, limit = CHUNK) {
  if (value.length <= limit) return [value];
  const chunks = [];
  let rest = value;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.4) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.4) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function needsTranslation(value) {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value);
}

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * @param {string[]} pieces
 * @param {string} target
 */
async function requestTranslation(pieces, target) {
  const out = new Array(pieces.length);
  for (let offset = 0; offset < pieces.length; offset += BATCH) {
    const chunk = pieces.slice(offset, offset + BATCH);
    const payload = await apiClient("/api/translate", {
      method: "POST",
      body: JSON.stringify({ texts: chunk, target }),
    });
    if (payload?.source === "passthrough") {
      const error = new Error("passthrough");
      error.code = "passthrough";
      throw error;
    }
    const translations = Array.isArray(payload?.translations) ? payload.translations : [];
    chunk.forEach((piece, index) => {
      const next = translations[index];
      out[offset + index] = typeof next === "string" && next ? decodeEntities(next) : piece;
    });
  }
  return out;
}

/**
 * Translate desk text into `target` (`es` or `en`). Source language is auto-detected.
 * Marker lines, HTML tags, `{{variables}}`, and URLs stay as written.
 * @param {string} text
 * @param {string} target
 * @param {(pieces: string[], target: string) => Promise<string[]>} [translatePieces]
 */
export async function translateDeskText(text, target, translatePieces = requestTranslation) {
  const source = String(text || "");
  if (!source.trim() || (target !== "es" && target !== "en")) return source;

  const parts = splitProtected(source);
  /** @type {{ keep: boolean, value: string, pieces: string[] | null }[]} */
  const slots = parts.map((part) => ({
    keep: part.keep,
    value: part.value,
    pieces: part.keep || !needsTranslation(part.value) ? null : chunkText(part.value),
  }));

  const flat = [];
  slots.forEach((slot, slotIndex) => {
    if (!slot.pieces) return;
    slot.pieces.forEach((piece, pieceIndex) => {
      flat.push({ slotIndex, pieceIndex, piece });
    });
  });
  if (!flat.length) return source;

  const translated = await translatePieces(flat.map((item) => item.piece), target);
  /** @type {string[][]} */
  const rebuilt = slots.map((slot) => (slot.pieces ? slot.pieces.slice() : []));
  flat.forEach((item, index) => {
    const next = translated[index];
    rebuilt[item.slotIndex][item.pieceIndex] = typeof next === "string" && next ? next : item.piece;
  });

  return slots.map((slot, index) => (slot.pieces ? rebuilt[index].join("") : slot.value)).join("");
}
