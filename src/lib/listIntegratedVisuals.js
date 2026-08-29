import { listLibraryItems } from "./folderLibrary.js";
import { collectLibraryNameRefsFromBlocks } from "./retroactiveLibraryNameRefs.js";
import { normalizeLibraryNameKey } from "./docLibraryNameRefs.js";

/**
 * @typedef {Object} IntegratedVisualRow
 * @property {string} itemId
 * @property {string} tag Canonical Prompt name
 * @property {string} mediaUrl
 * @property {"folder"|"document"} ownerKind
 * @property {string} ownerId
 * @property {string[]} aliases
 * @property {boolean} sponsored User-marked paid placement
 * @property {number} mentionCount How many refs in the open document body
 */

/**
 * Build a lookup of library items by id from document + folder catalogs.
 * Document entries win on duplicate ids (shouldn't happen) and on tag keys.
 * @param {string} documentId
 * @param {string} folderId
 * @returns {Map<string, { item: object, ownerKind: "folder"|"document", ownerId: string }>}
 */
function buildItemLookup(documentId, folderId) {
  /** @type {Map<string, { item: object, ownerKind: "folder"|"document", ownerId: string }>} */
  const byId = new Map();
  const foldId = String(folderId || "").trim();
  const docId = String(documentId || "").trim();

  if (foldId) {
    for (const item of listLibraryItems("folder", foldId)) {
      if (!item?.id) continue;
      byId.set(item.id, { item, ownerKind: "folder", ownerId: foldId });
    }
  }
  if (docId) {
    for (const item of listLibraryItems("document", docId)) {
      if (!item?.id) continue;
      byId.set(item.id, { item, ownerKind: "document", ownerId: docId });
    }
  }
  return byId;
}

/**
 * Visual Prompts referenced in the document body that have a photo.
 * One row per itemId (aliases collapse to the same ficha).
 *
 * @param {object[]} blocks
 * @param {string} documentId
 * @param {string} folderId
 * @returns {IntegratedVisualRow[]}
 */
export function listIntegratedVisualsFromBlocks(blocks, documentId, folderId) {
  const refs = collectLibraryNameRefsFromBlocks(blocks);
  if (!refs.length) return [];

  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const ref of refs) {
    const id = String(ref.itemId || "").trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  if (!counts.size) return [];

  const lookup = buildItemLookup(documentId, folderId);
  /** @type {IntegratedVisualRow[]} */
  const rows = [];

  for (const [itemId, mentionCount] of counts) {
    const entry = lookup.get(itemId);
    if (!entry) continue;
    const mediaUrl = String(entry.item.mediaUrl || "").trim();
    if (!mediaUrl) continue;
    const tag = String(entry.item.tag || "").trim();
    if (!tag) continue;
    rows.push({
      itemId,
      tag,
      mediaUrl,
      ownerKind: entry.ownerKind,
      ownerId: entry.ownerId,
      aliases: Array.isArray(entry.item.aliases) ? entry.item.aliases : [],
      sponsored: Boolean(entry.item.sponsored),
      mentionCount,
    });
  }

  rows.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" }));
  return rows;
}

/**
 * @param {IntegratedVisualRow[]} rows
 * @param {string} query
 * @returns {IntegratedVisualRow[]}
 */
export function filterIntegratedVisuals(rows, query) {
  const q = normalizeLibraryNameKey(query);
  if (!q) return rows || [];
  return (rows || []).filter((row) => {
    if (normalizeLibraryNameKey(row.tag).includes(q)) return true;
    return (row.aliases || []).some((alias) => normalizeLibraryNameKey(alias).includes(q));
  });
}
