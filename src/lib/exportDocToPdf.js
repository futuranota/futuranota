/**
 * Export document writing blocks to a downloadable PDF.
 * Includes prose, code, todos, steps, links, agent notes, and images.
 * Password vault secrets are never written to the PDF.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  NODE_BLOCK_TYPES,
  normalizeWritingBlocks,
} from "./nodeInlineContent.js";

/**
 * @typedef {{ text: string, checked?: boolean }} PdfListItem
 * @typedef {{
 *   kind: "h1" | "h2" | "h3" | "text" | "code" | "todo" | "steps"
 *     | "links" | "agent" | "image" | "note",
 *   text?: string,
 *   language?: string,
 *   title?: string,
 *   items?: PdfListItem[] | { name?: string, url?: string, description?: string }[],
 *   src?: string,
 *   caption?: string,
 * }} PdfExportSegment
 */

/**
 * @param {object[]} blocks
 * @returns {PdfExportSegment[]}
 */
export function collectWritingProseSegments(blocks) {
  return collectPdfExportSegments(blocks);
}

/**
 * Structured export segments from writing blocks (document order).
 * @param {object[]} blocks
 * @returns {PdfExportSegment[]}
 */
export function collectPdfExportSegments(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  /** @type {PdfExportSegment[]} */
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
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.CODE) {
      const code = String(block.code ?? "");
      if (!code.trim()) continue;
      segments.push({
        kind: "code",
        language: String(block.language || "").trim(),
        text: code.replace(/\s+$/g, ""),
      });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.TODO) {
      const items = (Array.isArray(block.items) ? block.items : [])
        .map((item) => ({
          text: String(item?.text ?? "").trim(),
          checked: Boolean(item?.checked),
        }))
        .filter((item) => item.text);
      const title = String(block.listTitle ?? "").trim();
      if (!title && !items.length) continue;
      segments.push({ kind: "todo", title, items });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.STEP_SEQUENCE) {
      const items = (Array.isArray(block.steps) ? block.steps : [])
        .map((step) => ({ text: String(step?.text ?? "").trim() }))
        .filter((item) => item.text);
      const title = String(block.title ?? "").trim();
      if (!title && !items.length) continue;
      segments.push({ kind: "steps", title, items });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.LINK_VAULT) {
      const items = (Array.isArray(block.entries) ? block.entries : [])
        .map((entry) => ({
          name: String(entry?.name ?? "").trim(),
          url: String(entry?.url ?? "").trim(),
          description: String(entry?.description ?? "").trim(),
        }))
        .filter((entry) => entry.name || entry.url);
      if (!items.length) continue;
      segments.push({ kind: "links", items });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.PASSWORD_VAULT) {
      const count = Array.isArray(block.entries) ? block.entries.length : 0;
      if (!count) continue;
      segments.push({
        kind: "note",
        text: `Password vault (${count} entr${count === 1 ? "y" : "ies"} omitted for security)`,
      });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.AGENT) {
      const text = String(block.instruction ?? "").trim();
      if (!text) continue;
      segments.push({ kind: "agent", text });
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.IMAGE) {
      pushImageSegments(segments, block);
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.IMAGE_SPLIT) {
      const captionParts = [
        String(block.overlayTitle || block.title || "").trim(),
        String(block.overlayDescription || block.description || "").trim(),
        String(block.body || "").trim(),
        String(block.libraryPrompt || "").trim(),
      ].filter(Boolean);
      pushImageSegments(segments, block, captionParts.join("\n"));
      if (block.bodyMode === "todo" && Array.isArray(block.todoItems)) {
        const items = block.todoItems
          .map((item) => ({
            text: String(item?.text ?? "").trim(),
            checked: Boolean(item?.checked),
          }))
          .filter((item) => item.text);
        if (items.length) {
          segments.push({
            kind: "todo",
            title: String(block.todoListTitle || "").trim(),
            items,
          });
        }
      }
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.BANNER) {
      const caption = [
        String(block.headline || "").trim(),
        String(block.caption || "").trim(),
      ].filter(Boolean).join("\n");
      pushImageSegments(segments, block, caption);
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.SPECS_CARD) {
      const specs = block.specs && typeof block.specs === "object" ? block.specs : {};
      const lines = [];
      const displayName = String(specs.name || specs.partNumber || "").trim();
      if (displayName) lines.push(displayName);
      if (specs.name && specs.partNumber) lines.push(`Part: ${specs.partNumber}`);
      const dimLine = [
        specs.dimensions?.x,
        specs.dimensions?.y,
        specs.dimensions?.z,
      ].filter(Boolean).join(" x ");
      if (dimLine) {
        lines.push(
          `Dimensions: ${dimLine}${specs.dimensions?.unit ? ` ${specs.dimensions.unit}` : ""}`,
        );
      }
      if (specs.material) lines.push(`Material: ${specs.material}`);
      if (specs.weight?.value) {
        lines.push(
          `Weight: ${specs.weight.value}${specs.weight.unit ? ` ${specs.weight.unit}` : ""}`,
        );
      }
      pushImageSegments(segments, block, lines.join("\n"));
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.MOODBOARD) {
      const caption = [
        String(block.caption || "").trim(),
        String(block.body || "").trim(),
      ].filter(Boolean).join("\n");
      if (caption) segments.push({ kind: "text", text: caption });
      for (const src of collectMoodboardSrcs(block)) {
        segments.push({ kind: "image", src });
      }
      continue;
    }
    if (block.type === NODE_BLOCK_TYPES.PRODUCT_CARD) {
      const title = String(block.title || "").trim();
      if (title) segments.push({ kind: "h3", text: title });
      const images = Array.isArray(block.images) ? block.images : [];
      for (const img of images) {
        const src = String(img?.src || "").trim();
        if (src) segments.push({ kind: "image", src, caption: String(img?.name || "").trim() });
      }
      const specs = block.specs && typeof block.specs === "object" ? block.specs : null;
      if (specs) {
        const lines = [];
        if (specs.material) lines.push(`Material: ${specs.material}`);
        if (specs.mountingPointDistance) {
          lines.push(`Mounting: ${specs.mountingPointDistance}`);
        }
        const dims = specs.dimensions;
        if (dims && (dims.x || dims.y || dims.z)) {
          lines.push(
            `Dimensions: ${[dims.x, dims.y, dims.z].filter(Boolean).join(" x ")}`
            + (dims.unit ? ` ${dims.unit}` : ""),
          );
        }
        if (lines.length) segments.push({ kind: "text", text: lines.join("\n") });
      }
    }
  }

  return segments;
}

/**
 * @param {PdfExportSegment[]} segments
 * @param {object} block
 * @param {string} [extraCaption]
 */
function pushImageSegments(segments, block, extraCaption = "") {
  const src = String(block?.src || "").trim();
  const caption = [
    String(block?.alt || "").trim(),
    String(extraCaption || "").trim(),
  ].filter(Boolean).join("\n");
  if (src) {
    segments.push({ kind: "image", src, caption: caption || undefined });
    return;
  }
  if (caption) segments.push({ kind: "text", text: caption });
}

/**
 * @param {object} block
 * @returns {string[]}
 */
function collectMoodboardSrcs(block) {
  /** @type {string[]} */
  const out = [];
  const push = (src) => {
    const value = String(src || "").trim();
    if (value && !out.includes(value)) out.push(value);
  };
  push(block?.src);
  push(block?.a?.src);
  push(block?.b?.src);
  if (Array.isArray(block?.images)) {
    for (const img of block.images) push(img?.src);
  }
  if (Array.isArray(block?.columns)) {
    for (const col of block.columns) {
      if (Array.isArray(col?.images)) {
        for (const img of col.images) push(img?.src);
      }
    }
  }
  return out;
}

/**
 * @param {object[]} blocks
 */
export function writingBlocksHaveExportableProse(blocks) {
  return collectPdfExportSegments(blocks).length > 0;
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
      /* skip unsupported glyph */
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
 * Wrap long code lines by character width (preserve indentation spaces).
 * @param {string} text
 * @param {import("pdf-lib").PDFFont} font
 * @param {number} fontSize
 * @param {number} maxWidth
 */
function wrapCodeLine(text, font, fontSize, maxWidth) {
  const raw = String(text ?? "");
  if (!raw) return [""];
  if (font.widthOfTextAtSize(raw, fontSize) <= maxWidth) return [raw];
  /** @type {string[]} */
  const lines = [];
  let current = "";
  for (const ch of raw) {
    const next = current + ch;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = ch;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/**
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
 * @param {string} text
 * @param {import("pdf-lib").PDFFont} font
 * @param {number} fontSize
 * @param {number} maxWidth
 */
function wrapCodeParagraph(text, font, fontSize, maxWidth) {
  const safe = sanitizePdfText(text, font);
  const chunks = String(safe ?? "").split(/\n/);
  /** @type {string[]} */
  const lines = [];
  for (const chunk of chunks) {
    lines.push(...wrapCodeLine(chunk, font, fontSize, maxWidth));
  }
  return lines.length ? lines : [""];
}

/**
 * Decode any browser-loadable image (incl. webp) to PNG bytes for pdf-lib.
 * @param {string} src
 * @returns {Promise<Uint8Array|null>}
 */
async function rasterizeSrcToPngBytes(src) {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = src;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * @param {import("pdf-lib").PDFDocument} pdf
 * @param {string} src
 * @returns {Promise<import("pdf-lib").PDFImage|null>}
 */
async function embedImageFromSrc(pdf, src) {
  const url = String(src || "").trim();
  if (!url) return null;

  if (typeof fetch === "function") {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        try {
          return await pdf.embedPng(bytes);
        } catch {
          /* not png */
        }
        try {
          return await pdf.embedJpg(bytes);
        } catch {
          /* not jpg */
        }
      }
    } catch {
      /* fall through to canvas */
    }
  }

  const pngBytes = await rasterizeSrcToPngBytes(url);
  if (!pngBytes) return null;
  try {
    return await pdf.embedPng(pngBytes);
  } catch {
    return null;
  }
}

/**
 * Build a PDF from writing blocks.
 * @param {object[]} blocks
 * @param {{ title?: string }} [options]
 * @returns {Promise<{ bytes: Uint8Array, fileName: string, empty: boolean }>}
 */
export async function buildWritingBlocksPdf(blocks, options = {}) {
  const segments = collectPdfExportSegments(blocks);
  const docTitleRaw = String(options.title ?? "").trim() || "Document";
  const fileName = sanitizePdfFileName(docTitleRaw);

  if (!segments.length) {
    return { bytes: new Uint8Array(), fileName, empty: true };
  }

  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

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

  const drawLabel = (label) => {
    const lines = wrapParagraph(label, fontBold, 9, maxWidth);
    drawLines(lines, fontBold, 9, 12, rgb(0.35, 0.35, 0.38), 4);
  };

  const docTitle = sanitizePdfText(docTitleRaw, fontBold) || "Document";
  const first = segments[0];
  const skipCover = first?.kind === "h1" && first.text === docTitleRaw;
  if (!skipCover && docTitle) {
    const titleLines = wrapParagraph(docTitle, fontBold, 18, maxWidth);
    drawLines(titleLines, fontBold, 18, 24, rgb(0.08, 0.08, 0.08), 16);
  }

  for (const seg of segments) {
    if (seg.kind === "h1") {
      const lines = wrapParagraph(seg.text || "", fontBold, 16, maxWidth);
      drawLines(lines, fontBold, 16, 22, rgb(0.1, 0.1, 0.1), 10);
      continue;
    }
    if (seg.kind === "h2") {
      const lines = wrapParagraph(seg.text || "", fontBold, 13, maxWidth);
      drawLines(lines, fontBold, 13, 18, rgb(0.12, 0.12, 0.12), 8);
      continue;
    }
    if (seg.kind === "h3") {
      const lines = wrapParagraph(seg.text || "", fontBold, 11, maxWidth);
      drawLines(lines, fontBold, 11, 16, rgb(0.15, 0.15, 0.15), 6);
      continue;
    }
    if (seg.kind === "text") {
      const lines = wrapParagraph(seg.text || "", fontRegular, 11, maxWidth);
      drawLines(lines, fontRegular, 11, 15, rgb(0.18, 0.18, 0.18), 10);
      continue;
    }
    if (seg.kind === "note") {
      const lines = wrapParagraph(seg.text || "", fontRegular, 10, maxWidth);
      drawLines(lines, fontRegular, 10, 13, rgb(0.45, 0.45, 0.48), 10);
      continue;
    }
    if (seg.kind === "agent") {
      drawLabel("Agent");
      const lines = wrapParagraph(seg.text || "", fontRegular, 11, maxWidth);
      drawLines(lines, fontRegular, 11, 15, rgb(0.18, 0.18, 0.18), 10);
      continue;
    }
    if (seg.kind === "code") {
      const lang = String(seg.language || "").trim();
      drawLabel(lang ? `Code (${lang})` : "Code");
      const lines = wrapCodeParagraph(seg.text || "", fontMono, 9, maxWidth);
      const blockPad = 8;
      const lineH = 12;
      const blockH = lines.length * lineH + blockPad * 2;
      ensureSpace(blockH + 8);
      page.drawRectangle({
        x: marginX - 4,
        y: y - blockH,
        width: maxWidth + 8,
        height: blockH,
        color: rgb(0.94, 0.94, 0.95),
        borderColor: rgb(0.82, 0.82, 0.84),
        borderWidth: 0.5,
      });
      let ty = y - blockPad - 9;
      for (const line of lines) {
        if (line) {
          page.drawText(line, {
            x: marginX,
            y: ty,
            size: 9,
            font: fontMono,
            color: rgb(0.12, 0.12, 0.14),
          });
        }
        ty -= lineH;
      }
      y -= blockH + 12;
      continue;
    }
    if (seg.kind === "todo") {
      if (seg.title) {
        const titleLines = wrapParagraph(seg.title, fontBold, 11, maxWidth);
        drawLines(titleLines, fontBold, 11, 15, rgb(0.15, 0.15, 0.15), 4);
      }
      for (const item of seg.items || []) {
        const mark = item.checked ? "[x]" : "[ ]";
        const lines = wrapParagraph(`${mark} ${item.text}`, fontRegular, 11, maxWidth);
        drawLines(lines, fontRegular, 11, 15, rgb(0.18, 0.18, 0.18), 2);
      }
      y -= 8;
      continue;
    }
    if (seg.kind === "steps") {
      if (seg.title) {
        const titleLines = wrapParagraph(seg.title, fontBold, 11, maxWidth);
        drawLines(titleLines, fontBold, 11, 15, rgb(0.15, 0.15, 0.15), 4);
      }
      (seg.items || []).forEach((item, index) => {
        const lines = wrapParagraph(`${index + 1}. ${item.text}`, fontRegular, 11, maxWidth);
        drawLines(lines, fontRegular, 11, 15, rgb(0.18, 0.18, 0.18), 2);
      });
      y -= 8;
      continue;
    }
    if (seg.kind === "links") {
      drawLabel("Links");
      for (const entry of seg.items || []) {
        const head = entry.name || entry.url || "Link";
        const headLines = wrapParagraph(head, fontBold, 11, maxWidth);
        drawLines(headLines, fontBold, 11, 14, rgb(0.15, 0.15, 0.15), 2);
        if (entry.url && entry.url !== entry.name) {
          const urlLines = wrapParagraph(entry.url, fontRegular, 9, maxWidth);
          drawLines(urlLines, fontRegular, 9, 12, rgb(0.25, 0.35, 0.55), 2);
        }
        if (entry.description) {
          const descLines = wrapParagraph(entry.description, fontRegular, 10, maxWidth);
          drawLines(descLines, fontRegular, 10, 13, rgb(0.3, 0.3, 0.32), 4);
        }
      }
      y -= 6;
      continue;
    }
    if (seg.kind === "image") {
      const embedded = await embedImageFromSrc(pdf, seg.src || "");
      if (embedded) {
        const maxH = 280;
        const dims = embedded.scale(
          Math.min(1, maxWidth / embedded.width, maxH / embedded.height),
        );
        ensureSpace(dims.height + 16);
        page.drawImage(embedded, {
          x: marginX,
          y: y - dims.height,
          width: dims.width,
          height: dims.height,
        });
        y -= dims.height + 8;
      } else {
        const lines = wrapParagraph(
          seg.src ? `[Image: ${seg.src}]` : "[Image unavailable]",
          fontRegular,
          9,
          maxWidth,
        );
        drawLines(lines, fontRegular, 9, 12, rgb(0.45, 0.45, 0.48), 6);
      }
      if (seg.caption) {
        const capLines = wrapParagraph(seg.caption, fontRegular, 10, maxWidth);
        drawLines(capLines, fontRegular, 10, 13, rgb(0.3, 0.3, 0.32), 10);
      } else {
        y -= 6;
      }
    }
  }

  const bytes = await pdf.save();
  return { bytes, fileName, empty: false };
}

/**
 * @param {Uint8Array} bytes
 * @param {string} fileName
 */
export function downloadPdfBytes(bytes, fileName) {
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
