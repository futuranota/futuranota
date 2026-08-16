import { generateId } from "./ids.js";

/** @typedef {"auto"|"image"|"pdf"|"skill"} FolderLibraryCategory */

/**
 * @typedef {Object} FolderLibraryItem
 * @property {string} id
 * @property {string} tag
 * @property {string} description
 * @property {FolderLibraryCategory} category
 * @property {string|null} mediaUrl
 * @property {"image"|null} mediaKind
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const FOLDER_LIBRARY_CATEGORIES = /** @type {const} */ ([
  "auto",
  "image",
  "pdf",
  "skill",
]);

/**
 * @param {unknown} value
 * @returns {FolderLibraryCategory}
 */
export function normalizeFolderLibraryCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "image" || raw === "pdf" || raw === "skill") return raw;
  return "auto";
}

/**
 * @param {unknown} raw
 * @returns {FolderLibraryItem|null}
 */
export function normalizeFolderLibraryItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  if (!id) return null;
  const tag = typeof raw.tag === "string" ? raw.tag.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const category = normalizeFolderLibraryCategory(raw.category);
  const mediaUrl = typeof raw.mediaUrl === "string" && raw.mediaUrl.trim()
    ? raw.mediaUrl.trim()
    : null;
  const mediaKind = mediaUrl ? "image" : null;
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt
    ? raw.createdAt
    : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt
    ? raw.updatedAt
    : createdAt;
  return {
    id,
    tag,
    description,
    category,
    mediaUrl,
    mediaKind,
    createdAt,
    updatedAt,
  };
}

/**
 * @param {unknown} value
 * @returns {FolderLibraryItem[]}
 */
export function normalizeFolderLibraryItems(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    const item = normalizeFolderLibraryItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Build a new ficha (does not persist).
 * @param {{ tag?: string, description?: string, category?: string, mediaUrl?: string|null }} input
 * @returns {FolderLibraryItem|null}
 */
export function buildFolderLibraryItem(input = {}) {
  const tag = String(input.tag ?? "").trim();
  if (!tag) return null;
  const now = new Date().toISOString();
  const mediaUrl = typeof input.mediaUrl === "string" && input.mediaUrl.trim()
    ? input.mediaUrl.trim()
    : null;
  return {
    id: generateId("LIB"),
    tag,
    description: String(input.description ?? "").trim(),
    category: normalizeFolderLibraryCategory(input.category),
    mediaUrl,
    mediaKind: mediaUrl ? "image" : null,
    createdAt: now,
    updatedAt: now,
  };
}
