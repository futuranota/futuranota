/**
 * Import PDF → plain text for the document writing surface.
 * Reverse of exportDocToPdf (text layer only — scanned/image PDFs return empty).
 */

import {
  createEmptyTextBlock,
  ensureNodeWritingTail,
  normalizeWritingBlocks,
  NODE_BLOCK_TYPES,
  trimTrailingEmptyTextBlocks,
} from "./nodeInlineContent.js";

let workerConfigured = false;

/**
 * @param {unknown} items
 */
export function textItemsToPageText(items) {
  const list = Array.isArray(items) ? items : [];
  let out = "";
  let lastY = null;

  for (const item of list) {
    if (!item || item.str == null) continue;
    const str = String(item.str);
    if (!str) {
      if (item.hasEOL) out += "\n";
      continue;
    }

    const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
    if (out && lastY != null && Number.isFinite(y) && Math.abs(y - lastY) > 3) {
      if (!/\n$/.test(out)) out += "\n";
    } else if (out && !/\s$/.test(out) && !/^\s/.test(str) && !/^[,.;:!?)\]}]/.test(str)) {
      out += " ";
    }

    out += str;
    if (item.hasEOL) out += "\n";
    if (Number.isFinite(y)) lastY = y;
  }

  return out;
}

/**
 * @param {unknown} text
 */
export function normalizePdfExtractedText(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/^[ \t]+|[ \t]+$/g, "").replace(/[ \t]{2,}/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * PDF → text gate: only writing TEXT cells (textareas) count.
 * Document title / H1–H3 / todos / other blocks do not disable the button.
 * @param {unknown} blocks
 */
export function writingTextAreasAreEmpty(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  const textBlocks = normalized.filter(
    (block) => block?.type === NODE_BLOCK_TYPES.TEXT,
  );
  if (!textBlocks.length) return true;
  return textBlocks.every((block) => !String(block.text || "").trim());
}

/** @deprecated Prefer writingTextAreasAreEmpty for PDF → text. */
export function writingBlocksAreEffectivelyEmpty(blocks) {
  return writingTextAreasAreEmpty(blocks);
}

/**
 * Drop extracted text into writing blocks (append, or replace empty textareas).
 * Keeps one TEXT cell with paragraph breaks so Organize can reshape next.
 *
 * @param {unknown} blocks
 * @param {unknown} text
 * @returns {{ blocks: ReturnType<typeof normalizeWritingBlocks>, changed: boolean, empty: boolean }}
 */
export function mergePdfTextIntoWritingBlocks(blocks, text) {
  const body = normalizePdfExtractedText(text);
  if (!body) {
    return {
      blocks: normalizeWritingBlocks(blocks),
      changed: false,
      empty: true,
    };
  }

  const current = normalizeWritingBlocks(blocks);
  if (writingTextAreasAreEmpty(current)) {
    const withoutEmptyText = current.filter(
      (block) => !(block?.type === NODE_BLOCK_TYPES.TEXT && !String(block.text || "").trim()),
    );
    const onlyEmptyText = withoutEmptyText.length === 0;
    if (onlyEmptyText) {
      return {
        blocks: ensureNodeWritingTail([createEmptyTextBlock(body)]),
        changed: true,
        empty: false,
      };
    }
    return {
      blocks: ensureNodeWritingTail([
        ...withoutEmptyText,
        createEmptyTextBlock(body),
      ]),
      changed: true,
      empty: false,
    };
  }

  const trimmed = trimTrailingEmptyTextBlocks(current);
  return {
    blocks: ensureNodeWritingTail([...trimmed, createEmptyTextBlock(body)]),
    changed: true,
    empty: false,
  };
}

async function ensurePdfjs() {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  if (!workerConfigured && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

/**
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<{ text: string, pageCount: number, empty: boolean }>}
 */
export async function extractTextFromPdfData(data) {
  const pdfjs = await ensurePdfjs();
  const bytes = data instanceof Uint8Array
    ? data
    : new Uint8Array(data);

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    // Vitest / Node has no worker; browser still uses GlobalWorkerOptions when set.
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  /** @type {string[]} */
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    pages.push(textItemsToPageText(content?.items));
  }

  try {
    await pdf.destroy();
  } catch {
    // ignore
  }

  const text = normalizePdfExtractedText(pages.join("\n\n"));
  return {
    text,
    pageCount: pdf.numPages,
    empty: !text,
  };
}

/**
 * @param {File|Blob} file
 */
export async function extractTextFromPdfFile(file) {
  if (!file) {
    return { text: "", pageCount: 0, empty: true };
  }
  const buffer = await file.arrayBuffer();
  return extractTextFromPdfData(buffer);
}

/**
 * Paint PDF pages as JPEG data URLs. The panel shows these pictures;
 * Extraer datos sends the same pictures to Groq.
 * @param {ArrayBuffer|Uint8Array} data
 * @param {{ maxPages?: number, maxWidth?: number }} [opts]
 * @returns {Promise<{ images: string[], pageCount: number }>}
 */
export async function renderPdfPageImages(data, opts = {}) {
  const maxPages = opts.maxPages ?? 3;
  const maxWidth = opts.maxWidth ?? 900;
  const pdfjs = await ensurePdfjs();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdf = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pageCount = pdf.numPages;
  const images = [];
  try {
    const shown = Math.min(pageCount, maxPages);
    for (let i = 1; i <= shown; i += 1) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1.6, maxWidth / Math.max(base.width, 1));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.72));
    }
  } finally {
    try {
      await pdf.destroy();
    } catch {
      // ignore
    }
  }
  return { images, pageCount };
}

/**
 * True when a library attachment looks like a PDF (kind / name / url / category).
 * @param {unknown} item
 */
export function isPdfLibraryAttachment(item) {
  if (!item || typeof item !== "object") return false;
  const category = String(item.category || "").toLowerCase();
  if (category === "pdf") return true;
  const kind = String(item.attachmentKind || "").toLowerCase();
  if (kind.includes("pdf")) return true;
  const name = String(item.attachmentName || item.tag || "").toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const url = String(item.attachmentUrl || "").toLowerCase();
  return url.includes(".pdf") || url.includes("application/pdf");
}

/**
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchPdfBytesFromUrl(url) {
  const href = String(url || "").trim();
  if (!href) throw new Error("missing_url");
  const response = await fetch(href);
  if (!response.ok) throw new Error(`fetch_${response.status}`);
  return response.arrayBuffer();
}
