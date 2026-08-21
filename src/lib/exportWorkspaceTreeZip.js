/**
 * Human-readable workspace export: Company / Folder / Document.pdf
 */

import JSZip from "jszip";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import {
  buildWritingBlocksPdf,
  writingBlocksHaveExportableProse,
} from "./exportDocToPdf.js";
import {
  parseNodeWritingBody,
} from "./nodeInlineContent.js";
import { slugify } from "./pack/packV2Paths.js";
import {
  isDedicatedStepPlaybookDoc,
  isKnowledgeDoc,
  isTemplateDoc,
} from "./templateDoc.js";

const README = `Futura Nota — workspace tree export
=====================================

Structure:
  {Company}/{Folder}/{Document}.pdf
  _unfiled/{Document}.pdf   (documents with no folder)

Each PDF is built from the document body (headings, text, code, todos, images…).
Password vault secrets are omitted.
Empty documents (no exportable content) are skipped.
`;

/**
 * @param {object|null|undefined} node
 */
function documentTitle(node) {
  return String(node?.sourceQuery || node?.title || "")
    .trim() || "Untitled";
}

/**
 * @param {string} base
 * @param {Set<string>} used
 */
function uniqueSlug(base, used) {
  let slug = slugify(base);
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${slug}-${n}`)) n += 1;
  slug = `${slug}-${n}`;
  used.add(slug);
  return slug;
}

/**
 * @param {object|null|undefined} doc
 */
function isExportableFolder(doc) {
  if (!doc?.id) return false;
  if (isKnowledgeDoc(doc) || isTemplateDoc(doc)) return false;
  if (isDedicatedStepPlaybookDoc(doc)) return false;
  return true;
}

/**
 * @param {object} node
 */
function nodeHasExportableContent(node) {
  const { blocks } = parseNodeWritingBody(node?.content);
  return writingBlocksHaveExportableProse(blocks);
}

/**
 * Pure planner: zip paths for documents that have exportable content.
 *
 * @param {{
 *   objects?: Record<string, object>,
 *   docs?: Record<string, object>,
 *   nodes?: Record<string, object>,
 * }} state
 * @returns {Array<{
 *   zipPath: string,
 *   nodeId: string,
 *   title: string,
 *   folderId: string|null,
 *   objectId: string|null,
 * }>}
 */
export function planWorkspaceTreeEntries(state = {}) {
  const objects = state.objects && typeof state.objects === "object" ? state.objects : {};
  const docs = state.docs && typeof state.docs === "object" ? state.docs : {};
  const nodes = state.nodes && typeof state.nodes === "object" ? state.nodes : {};

  /** @type {Array<{ zipPath: string, nodeId: string, title: string, folderId: string|null, objectId: string|null }>} */
  const entries = [];
  const usedCompany = new Set();
  /** @type {Map<string, string>} objectId -> company folder slug */
  const companySlugById = new Map();
  /** @type {Map<string, string>} folderId -> full folder prefix Company/Folder */
  const folderPrefixById = new Map();
  /** @type {Map<string, Set<string>>} prefix -> used file stems */
  const usedFilesByPrefix = new Map();

  const ensureFileSet = (prefix) => {
    if (!usedFilesByPrefix.has(prefix)) usedFilesByPrefix.set(prefix, new Set());
    return usedFilesByPrefix.get(prefix);
  };

  const objectList = Object.values(objects).filter((o) => o?.id);
  objectList.sort((a, b) =>
    String(a.name || a.id).localeCompare(String(b.name || b.id)),
  );

  for (const obj of objectList) {
    const companySlug = uniqueSlug(obj.name || obj.id, usedCompany);
    companySlugById.set(obj.id, companySlug);
  }

  const folderList = Object.values(docs).filter(isExportableFolder);
  folderList.sort((a, b) =>
    String(a.title || a.id).localeCompare(String(b.title || b.id)),
  );

  /** @type {Map<string, Set<string>>} companySlug -> used folder slugs */
  const usedFoldersByCompany = new Map();

  for (const folder of folderList) {
    const objectId = String(folder.parentObjectId || "").trim();
    const companySlug = objectId && companySlugById.has(objectId)
      ? companySlugById.get(objectId)
      : uniqueSlug(objectId || "workspace", usedCompany);
    if (!usedFoldersByCompany.has(companySlug)) {
      usedFoldersByCompany.set(companySlug, new Set());
    }
    const folderSlug = uniqueSlug(
      folder.title || folder.id,
      usedFoldersByCompany.get(companySlug),
    );
    folderPrefixById.set(folder.id, `${companySlug}/${folderSlug}`);
  }

  const filedNodeIds = new Set();

  for (const folder of folderList) {
    const prefix = folderPrefixById.get(folder.id);
    if (!prefix) continue;
    const fileSet = ensureFileSet(prefix);
    const children = Object.values(nodes).filter(
      (node) => node?.id && node.parentDocId === folder.id,
    );
    children.sort((a, b) =>
      documentTitle(a).localeCompare(documentTitle(b)),
    );

    for (const node of children) {
      if (!nodeHasExportableContent(node)) continue;
      filedNodeIds.add(node.id);
      const title = documentTitle(node);
      const stem = uniqueSlug(title, fileSet);
      entries.push({
        zipPath: `${prefix}/${stem}.pdf`,
        nodeId: node.id,
        title,
        folderId: folder.id,
        objectId: String(folder.parentObjectId || "").trim() || null,
      });
    }
  }

  const unfiledPrefix = "_unfiled";
  const unfiledSet = ensureFileSet(unfiledPrefix);
  const orphans = Object.values(nodes).filter((node) => {
    if (!node?.id || filedNodeIds.has(node.id)) return false;
    const parentId = String(node.parentDocId || "").trim();
    if (parentId && folderPrefixById.has(parentId)) return false;
    return nodeHasExportableContent(node);
  });
  orphans.sort((a, b) =>
    documentTitle(a).localeCompare(documentTitle(b)),
  );

  for (const node of orphans) {
    const title = documentTitle(node);
    const stem = uniqueSlug(title, unfiledSet);
    entries.push({
      zipPath: `${unfiledPrefix}/${stem}.pdf`,
      nodeId: node.id,
      title,
      folderId: null,
      objectId: null,
    });
  }

  return entries;
}

/**
 * @param {string} [prefix]
 */
function buildTreeZipFileName(prefix = "futuranota-documents") {
  const day = new Date().toISOString().slice(0, 10);
  const safe = String(prefix || "futuranota-documents")
    .replace(/[^\w\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "futuranota-documents";
  return `${safe}-${day}.zip`;
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 */
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/**
 * Build PDFs for each planned entry and download a ZIP.
 * @returns {Promise<{
 *   ok: boolean,
 *   fileName?: string,
 *   counts?: { documents: number, skippedEmpty: number },
 *   error?: string,
 * }>}
 */
export async function exportWorkspaceTreeZip() {
  try {
    const objects = useObjectsStore.getState().objects || {};
    const docs = useDocsStore.getState().docs || {};
    const nodes = useNodesStore.getState().nodes || {};
    const planned = planWorkspaceTreeEntries({ objects, docs, nodes });

    if (!planned.length) {
      return {
        ok: false,
        error: "No exportable documents found",
        counts: { documents: 0, skippedEmpty: Object.keys(nodes).length },
      };
    }

    const zip = new JSZip();
    zip.file("README.txt", README);

    let built = 0;
    for (const entry of planned) {
      const node = nodes[entry.nodeId];
      if (!node) continue;
      const { blocks } = parseNodeWritingBody(node.content);
      const pdf = await buildWritingBlocksPdf(blocks, { title: entry.title });
      if (pdf.empty || !pdf.bytes?.byteLength) continue;
      const copy = pdf.bytes instanceof Uint8Array
        ? pdf.bytes.slice()
        : new Uint8Array(pdf.bytes);
      zip.file(entry.zipPath, copy);
      built += 1;
    }

    if (!built) {
      return {
        ok: false,
        error: "No exportable documents found",
        counts: { documents: 0, skippedEmpty: planned.length },
      };
    }

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const fileName = buildTreeZipFileName();
    downloadBlob(blob, fileName);
    return {
      ok: true,
      fileName,
      counts: {
        documents: built,
        skippedEmpty: Math.max(0, planned.length - built),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }
}
