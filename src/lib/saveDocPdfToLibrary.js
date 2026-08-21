/**
 * Build a document PDF and persist it as a folder library attachment.
 */

import { uploadDocAttachmentFile } from "./docImageStorage.js";
import { buildWritingBlocksPdf } from "./exportDocToPdf.js";
import { createLibraryItem } from "./folderLibrary.js";

/**
 * @param {Uint8Array} bytes
 * @param {string} fileName
 * @returns {File|Blob}
 */
function pdfBytesToUploadFile(bytes, fileName) {
  const copy = bytes instanceof Uint8Array
    ? bytes.slice()
    : new Uint8Array(bytes);
  // Detached ArrayBuffer slice — avoids shared-buffer Blob quirks in some runtimes.
  const buffer = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
  const type = "application/pdf";
  if (typeof File !== "undefined") {
    try {
      return new File([buffer], fileName, { type });
    } catch {
      /* fall through to Blob */
    }
  }
  return new Blob([buffer], { type });
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
export async function saveWritingBlocksPdfToFolderLibrary(blocks, options = {}) {
  const folderId = String(options.folderId || "").trim();
  if (!folderId) return { ok: false, reason: "no_folder" };

  let result;
  try {
    result = await buildWritingBlocksPdf(blocks, { title: options.title });
  } catch (err) {
    return {
      ok: false,
      reason: "upload_failed",
      error: err?.message || String(err),
    };
  }

  if (result.empty) {
    return { ok: false, empty: true, reason: "empty", fileName: result.fileName };
  }

  const fileName = result.fileName;
  const tag = String(options.tag || options.title || fileName.replace(/\.pdf$/i, "") || "document")
    .trim()
    .slice(0, 80) || "document";
  const description = String(options.description ?? "").trim();
  const file = pdfBytesToUploadFile(result.bytes, fileName);

  let uploaded;
  try {
    uploaded = await uploadDocAttachmentFile(file, {
      fileName,
      scopeId: folderId,
      fileId: `pdf_${Date.now()}`,
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
    category: "pdf",
    attachmentUrl: uploaded.url,
    attachmentName: uploaded.name || fileName,
    attachmentKind: uploaded.kind || "pdf",
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
