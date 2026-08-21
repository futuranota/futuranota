/**
 * Export document writing blocks to Markdown (.md) — download or library.
 */

import {
  collectPdfExportSegments,
  sanitizePdfFileName,
  writingBlocksHaveExportableProse,
} from "./exportDocToPdf.js";
import { uploadDocAttachmentFile } from "./docImageStorage.js";
import { createLibraryItem } from "./folderLibrary.js";

/**
 * @param {string} [src]
 */
function isHttpImageSrc(src) {
  return /^https?:\/\//i.test(String(src || "").trim());
}

/**
 * @param {import("./exportDocToPdf.js").PdfExportSegment[]} segments
 * @returns {string}
 */
export function segmentsToMarkdown(segments) {
  /** @type {string[]} */
  const parts = [];
  for (const seg of segments || []) {
    if (!seg) continue;
    if (seg.kind === "h1" && seg.text) {
      parts.push(`# ${seg.text}`);
      continue;
    }
    if (seg.kind === "h2" && seg.text) {
      parts.push(`## ${seg.text}`);
      continue;
    }
    if (seg.kind === "h3" && seg.text) {
      parts.push(`### ${seg.text}`);
      continue;
    }
    if (seg.kind === "text" && seg.text) {
      parts.push(seg.text);
      continue;
    }
    if (seg.kind === "code" && seg.text) {
      const lang = String(seg.language || "").trim();
      parts.push(`\`\`\`${lang}\n${seg.text}\n\`\`\``);
      continue;
    }
    if (seg.kind === "todo") {
      /** @type {string[]} */
      const lines = [];
      if (seg.title) lines.push(`### ${seg.title}`);
      for (const item of seg.items || []) {
        const mark = item.checked ? "x" : " ";
        lines.push(`- [${mark}] ${item.text}`);
      }
      if (lines.length) parts.push(lines.join("\n"));
      continue;
    }
    if (seg.kind === "steps") {
      /** @type {string[]} */
      const lines = [];
      if (seg.title) lines.push(`### ${seg.title}`);
      (seg.items || []).forEach((item, i) => {
        lines.push(`${i + 1}. ${item.text}`);
      });
      if (lines.length) parts.push(lines.join("\n"));
      continue;
    }
    if (seg.kind === "links") {
      /** @type {string[]} */
      const lines = [];
      for (const entry of seg.items || []) {
        const name = entry.name || entry.url || "link";
        if (entry.url) {
          lines.push(entry.description
            ? `- [${name}](${entry.url}) — ${entry.description}`
            : `- [${name}](${entry.url})`);
        } else if (entry.name) {
          lines.push(`- ${entry.name}`);
        }
      }
      if (lines.length) parts.push(lines.join("\n"));
      continue;
    }
    if (seg.kind === "agent" && seg.text) {
      parts.push(`> ${seg.text.replace(/\n/g, "\n> ")}`);
      continue;
    }
    if (seg.kind === "note" && seg.text) {
      parts.push(`_${seg.text}_`);
      continue;
    }
    if (seg.kind === "image") {
      const src = String(seg.src || "").trim();
      if (!isHttpImageSrc(src)) {
        if (seg.caption) parts.push(seg.caption);
        continue;
      }
      const alt = String(seg.caption || "").split("\n")[0].trim() || "image";
      parts.push(`![${alt}](${src})`);
      if (seg.caption && seg.caption.includes("\n")) {
        const rest = seg.caption.split("\n").slice(1).join("\n").trim();
        if (rest) parts.push(rest);
      }
    }
  }
  return parts.join("\n\n").trim();
}

/**
 * @param {object[]} blocks
 * @returns {string}
 */
export function buildWritingBlocksMarkdown(blocks) {
  return segmentsToMarkdown(collectPdfExportSegments(blocks));
}

/**
 * @param {string} name
 */
export function sanitizeMarkdownFileName(name) {
  const base = sanitizePdfFileName(String(name || "").replace(/\.md$/i, "") || "document");
  return base.replace(/\.pdf$/i, "") + ".md";
}

/**
 * @param {string} markdown
 * @param {string} fileName
 */
export function downloadMarkdownText(markdown, fileName) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeMarkdownFileName(fileName);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * @param {object[]} blocks
 * @param {{ title?: string }} [options]
 * @returns {{ ok: boolean, empty?: boolean, fileName?: string, markdown?: string }}
 */
export function exportWritingBlocksToMarkdown(blocks, options = {}) {
  if (!writingBlocksHaveExportableProse(blocks)) {
    return { ok: false, empty: true };
  }
  const markdown = buildWritingBlocksMarkdown(blocks);
  if (!markdown.trim()) {
    return { ok: false, empty: true };
  }
  const fileName = sanitizeMarkdownFileName(options.title || "document");
  downloadMarkdownText(markdown, fileName);
  return { ok: true, fileName, markdown };
}

/**
 * @param {string} markdown
 * @param {string} fileName
 * @returns {File|Blob}
 */
function markdownToUploadFile(markdown, fileName) {
  const type = "text/markdown";
  if (typeof File !== "undefined") {
    try {
      return new File([markdown], fileName, { type });
    } catch {
      /* fall through */
    }
  }
  return new Blob([markdown], { type });
}

/**
 * @param {object[]} blocks
 * @param {{
 *   title?: string,
 *   folderId?: string,
 *   tag?: string,
 *   description?: string,
 * }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   empty?: boolean,
 *   reason?: "no_folder" | "empty" | "create_failed" | "upload_failed",
 *   fileName?: string,
 *   item?: object,
 *   error?: string,
 * }>}
 */
export async function saveWritingBlocksMarkdownToFolderLibrary(blocks, options = {}) {
  const folderId = String(options.folderId || "").trim();
  if (!folderId) return { ok: false, reason: "no_folder" };

  if (!writingBlocksHaveExportableProse(blocks)) {
    return { ok: false, empty: true, reason: "empty" };
  }

  const markdown = buildWritingBlocksMarkdown(blocks);
  if (!markdown.trim()) {
    return { ok: false, empty: true, reason: "empty" };
  }

  const fileName = sanitizeMarkdownFileName(options.title || "document");
  const tag = String(options.tag || options.title || fileName.replace(/\.md$/i, "") || "document")
    .trim()
    .slice(0, 80) || "document";
  const description = String(options.description ?? "").trim();
  const file = markdownToUploadFile(markdown, fileName);

  let uploaded;
  try {
    uploaded = await uploadDocAttachmentFile(file, {
      fileName,
      scopeId: folderId,
      fileId: `md_${Date.now()}`,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "upload_failed",
      fileName,
      error: err?.message || String(err),
    };
  }

  const item = createLibraryItem("folder", folderId, {
    tag,
    description,
    category: "skill",
    attachmentUrl: uploaded.url,
    attachmentName: uploaded.name || fileName,
    attachmentKind: uploaded.kind || "md",
  });

  if (!item) {
    return {
      ok: false,
      reason: "create_failed",
      fileName,
      error: `Could not write library item on folder ${folderId}`,
    };
  }

  return { ok: true, fileName, item };
}
