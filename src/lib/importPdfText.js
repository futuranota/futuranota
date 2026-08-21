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
 * @param {unknown} blocks
 */
export function writingBlocksAreEffectivelyEmpty(blocks) {
  const normalized = normalizeWritingBlocks(blocks);
  return !normalized.some((block) => {
    if (!block) return false;
    if (block.type === NODE_BLOCK_TYPES.TEXT) {
      return Boolean(String(block.text || "").trim());
    }
    if (
      block.type === NODE_BLOCK_TYPES.H1
      || block.type === NODE_BLOCK_TYPES.H2
      || block.type === NODE_BLOCK_TYPES.H3
    ) {
      return Boolean(String(block.title || "").trim());
    }
    if (block.type === NODE_BLOCK_TYPES.CODE) {
      return Boolean(String(block.code || "").trim());
    }
    return true;
  });
}

/**
 * Drop extracted text into writing blocks (append, or replace empty doc).
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
  if (writingBlocksAreEffectivelyEmpty(current)) {
    return {
      blocks: ensureNodeWritingTail([createEmptyTextBlock(body)]),
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
