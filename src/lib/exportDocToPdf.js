/**
 * Phase 1 — export document writing prose (H1/H2/H3/TEXT) to a downloadable PDF.
 * Skips widgets, todos, vaults, and other non-prose blocks.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";

/**
 * @typedef {{ kind: "h1" | "h2" | "h3" | "text", text: string }} PdfProseSegment
 */

/**
 * Structured prose from writing blocks (no markdown hashes — real levels).
 * @param {object[]} blocks
 * @returns {PdfProseSegment[]}
 */
export function collectWritingProseSegments(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  /** @type {PdfProseSegment[]} */
  const segments = [];
  for (const block of normalized) {
    if (block.type === NODE_BLOCK_TYPES.H1) {
      const title = String(block.title ?? "").trim();
      if (title) segments.push({ kind: "h1", text: title });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.H2) {
      const title = String(block.title ?? "").trim();
      if (title) segments.push({ kind: "h2", text: title });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.H3) {
      const title = String(block.title ?? "").trim();
      if (title) segments.push({ kind: "h3", text: title });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.TEXT && !block.embedded) {
      const text = String(block.text ?? "").trim();
      if (text) segments.push({ kind: "text", text });
    }
  }
  return segments;
}

/**
 * @param {object[]} blocks
 */
export function writingBlocksHaveExportableProse(blocks) {
  return collectWritingProseSegments(blocks).length > 0;
}

/**
 * @param {string} name
 */
export function sanitizePdfFileName(name) {
  const raw = sanitizePdfText(String(name ?? "").trim() || "document")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const base = raw || "document";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * Helvetica/WinAnsi cannot draw emoji and many symbols. Map common punctuation,
 * then drop or replace anything the font still cannot encode.
 * @param {string} text
 * @param {import("pdf-lib").PDFFont} [font]
 */
export function sanitizePdfText(text, font) {
  const mapped = String(text ?? "")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[\u2022\u25CF\u25E6]/g, "-");

  if (!font || typeof font.encodeText !== "function") {
    // Without a font, strip code points outside Latin-1 (approx WinAnsi body).
    return Array.from(mapped)
      .map((ch) => {
        const code = ch.codePointAt(0) ?? 0;
        if (code === 0x0a || code === 0x0d) return ch;
        if (code >= 0x20 && code <= 0xff) return ch;
        return "";
      })
      .join("");
  }

  let out = "";
  for (const ch of mapped) {
    if (ch === "\n" || ch === "\r") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      /* skip unsupported glyph (emoji, CJK, etc.) */
    }
  }
  return out;
}

/**
 * @param {string} text
 * @param {import("pdf-lib").PDFFont} font
 * @param {number} fontSize
 * @param {number} maxWidth
 */
function wrapLine(text, font, fontSize, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  /** @type {string[]} */
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, fontSize);
    if (width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Preserve intentional newlines inside a paragraph.
 * @param {string} text
 * @param {import("pdf-lib").PDFFont} font
 * @param {number} fontSize
 * @param {number} maxWidth
 */
function wrapParagraph(text, font, fontSize, maxWidth) {
  const safe = sanitizePdfText(text, font);
  const chunks = String(safe ?? "").split(/\n/);
  /** @type {string[]} */
  const lines = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    lines.push(...wrapLine(trimmed, font, fontSize, maxWidth));
  }
  return lines;
}

/**
 * Build a PDF blob from writing blocks.
 * @param {object[]} blocks
 * @param {{ title?: string }} [options]
 * @returns {Promise<{ bytes: Uint8Array, fileName: string, empty: boolean }>}
 */
export async function buildWritingBlocksPdf(blocks, options = {}) {
  const segments = collectWritingProseSegments(blocks);
  const docTitleRaw = String(options.title ?? "").trim() || "Document";
  const fileName = sanitizePdfFileName(docTitleRaw);

  if (!segments.length) {
    return { bytes: new Uint8Array(), fileName, empty: true };
  }

  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 54;
  const marginTop = 54;
  const marginBottom = 54;
  const maxWidth = pageWidth - marginX * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  const ensureSpace = (needed) => {
    if (y - needed >= marginBottom) return;
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
  };

  const drawLines = (lines, font, size, lineHeight, color, gapAfter = 0) => {
    for (const line of lines) {
      ensureSpace(lineHeight);
      if (line) {
        page.drawText(line, {
          x: marginX,
          y: y - size,
          size,
          font,
          color,
        });
      }
      y -= lineHeight;
    }
    if (gapAfter) y -= gapAfter;
  };

  const docTitle = sanitizePdfText(docTitleRaw, fontBold) || "Document";

  // Cover title from document query/title when first segment isn't already that H1.
  const first = segments[0];
  const skipCover = first?.kind === "h1" && first.text === docTitleRaw;
  if (!skipCover && docTitle) {
    const titleLines = wrapParagraph(docTitle, fontBold, 18, maxWidth);
    drawLines(titleLines, fontBold, 18, 24, rgb(0.08, 0.08, 0.08), 16);
  }

  for (const seg of segments) {
    if (seg.kind === "h1") {
      const lines = wrapParagraph(seg.text, fontBold, 16, maxWidth);
      drawLines(lines, fontBold, 16, 22, rgb(0.1, 0.1, 0.1), 10);
      continue;
    }
    if (seg.kind === "h2") {
      const lines = wrapParagraph(seg.text, fontBold, 13, maxWidth);
      drawLines(lines, fontBold, 13, 18, rgb(0.12, 0.12, 0.12), 8);
      continue;
    }
    if (seg.kind === "h3") {
      const lines = wrapParagraph(seg.text, fontBold, 11, maxWidth);
      drawLines(lines, fontBold, 11, 16, rgb(0.15, 0.15, 0.15), 6);
      continue;
    }
    const lines = wrapParagraph(seg.text, fontRegular, 11, maxWidth);
    drawLines(lines, fontRegular, 11, 15, rgb(0.18, 0.18, 0.18), 10);
  }

  const bytes = await pdf.save();
  return { bytes, fileName, empty: false };
}

/**
 * Trigger a browser download for the given bytes.
 * @param {Uint8Array} bytes
 * @param {string} fileName
 */
export function downloadPdfBytes(bytes, fileName) {
  // Copy into a standalone buffer — some runtimes reject shared/view buffers.
  const copy = bytes instanceof Uint8Array
    ? bytes.slice()
    : new Uint8Array(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizePdfFileName(fileName);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * @param {object[]} blocks
 * @param {{ title?: string }} [options]
 * @returns {Promise<{ ok: boolean, empty?: boolean, fileName?: string }>}
 */
export async function exportWritingBlocksToPdf(blocks, options = {}) {
  const result = await buildWritingBlocksPdf(blocks, options);
  if (result.empty) return { ok: false, empty: true };
  downloadPdfBytes(result.bytes, result.fileName);
  return { ok: true, fileName: result.fileName };
}
