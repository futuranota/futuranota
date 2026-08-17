import { generateId } from "./ids.js";

/** @typedef {"auto"|"image"|"pdf"|"skill"|"video"} FolderLibraryCategory */

/**
 * @typedef {Object} FolderLibraryItem
 * @property {string} id
 * @property {string} tag
 * @property {string} description
 * @property {FolderLibraryCategory} category
 * @property {string|null} mediaUrl
 * @property {"image"|"video"|null} mediaKind
 * @property {string|null} attachmentUrl
 * @property {string|null} attachmentName
 * @property {string|null} attachmentKind
 * @property {string|null} wallColor Preview wall / production hex behind image or video (`#RRGGBB`)
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const FOLDER_LIBRARY_DEFAULT_WALL = "#151515";

export const FOLDER_LIBRARY_CATEGORIES = /** @type {const} */ ([
  "auto",
  "image",
  "pdf",
  "skill",
  "video",
]);

/** Tabs shown in the library table (All = no filter). Video tab retired. */
export const FOLDER_LIBRARY_FILTER_TABS = /** @type {const} */ ([
  "all",
  "image",
  "skill",
]);

/**
 * Normalize a CSS hex color for library wall preview.
 * Accepts `#RGB`, `#RRGGBB`, or without `#`. Empty → null.
 * @param {unknown} value
 * @returns {string|null} `#RRGGBB` uppercase or null
 */
export function normalizeWallColor(value) {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  if (raw[0] !== "#") raw = `#${raw}`;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toUpperCase();
  }
  return null;
}

/**
 * Color used for the image/video preview pane.
 * @param {string|null|undefined} wallColor
 * @returns {string}
 */
export function resolveWallColor(wallColor) {
  return normalizeWallColor(wallColor) || FOLDER_LIBRARY_DEFAULT_WALL;
}
/**
 * @param {unknown} value
 * @returns {FolderLibraryCategory}
 */
export function normalizeFolderLibraryCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "image" || raw === "pdf" || raw === "skill" || raw === "video") return raw;
  return "auto";
}

/**
 * @param {unknown} value
 * @returns {"all"|"image"|"skill"}
 */
export function normalizeFolderLibraryFilterTab(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "image" || raw === "skill") return raw;
  // Legacy "video" tab maps to All (create/filter retired).
  return "all";
}

/**
 * @param {FolderLibraryItem} item
 * @param {"all"|"image"|"skill"|string} tab
 */
export function folderLibraryItemMatchesFilter(item, tab) {
  if (!item) return false;
  if (tab === "all") return true;
  if (tab === "image") return item.category === "image";
  if (tab === "skill") return item.category === "skill" || item.category === "pdf";
  return true;
}

/**
 * Infer FileCard-style format kind from a filename or mime.
 * @param {string} [fileName]
 * @param {string} [mime]
 * @returns {string}
 */
export function inferAttachmentKind(fileName = "", mime = "") {
  const name = String(fileName || "").trim().toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const m = String(mime || "").trim().toLowerCase();
  if (ext === "pdf" || m === "application/pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "mdx") return "mdx";
  if (ext === "zip") return "zip";
  if (ext === "tar" || ext === "gz" || ext === "tgz") return "tar";
  if (ext === "json") return "json";
  if (ext === "csv") return "csv";
  if (ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx") return "code";
  if (ext === "css") return "css";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "txt") return "txt";
  if (ext === "doc" || ext === "docx") return "doc";
  if (ext === "ppt" || ext === "pptx") return "ppt";
  if (ext === "xls" || ext === "xlsx") return "xls";
  if (m.startsWith("image/")) return "img";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("text/") || m.includes("javascript") || m.includes("json")) return "code";
  return ext || "file";
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
  let mediaKind = null;
  if (mediaUrl) {
    if (raw.mediaKind === "video" || category === "video") mediaKind = "video";
    else mediaKind = "image";
  }
  const attachmentUrl = typeof raw.attachmentUrl === "string" && raw.attachmentUrl.trim()
    ? raw.attachmentUrl.trim()
    : null;
  const attachmentName = typeof raw.attachmentName === "string" && raw.attachmentName.trim()
    ? raw.attachmentName.trim()
    : null;
  const attachmentKind = attachmentUrl
    ? (typeof raw.attachmentKind === "string" && raw.attachmentKind.trim()
      ? raw.attachmentKind.trim().toLowerCase()
      : inferAttachmentKind(attachmentName || "", ""))
    : null;
  const wallColor = normalizeWallColor(raw.wallColor);
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
    attachmentUrl,
    attachmentName,
    attachmentKind,
    wallColor,
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
 * @param {{
 *   tag?: string,
 *   description?: string,
 *   category?: string,
 *   mediaUrl?: string|null,
 *   attachmentUrl?: string|null,
 *   attachmentName?: string|null,
 *   attachmentKind?: string|null,
 *   wallColor?: string|null,
 * }} input
 * @returns {FolderLibraryItem|null}
 */
export function buildFolderLibraryItem(input = {}) {
  const tag = String(input.tag ?? "").trim();
  if (!tag) return null;
  const now = new Date().toISOString();
  const category = normalizeFolderLibraryCategory(input.category);
  const mediaUrl = typeof input.mediaUrl === "string" && input.mediaUrl.trim()
    ? input.mediaUrl.trim()
    : null;
  const attachmentUrl = typeof input.attachmentUrl === "string" && input.attachmentUrl.trim()
    ? input.attachmentUrl.trim()
    : null;
  const attachmentName = typeof input.attachmentName === "string" && input.attachmentName.trim()
    ? input.attachmentName.trim()
    : null;
  const attachmentKind = attachmentUrl
    ? (input.attachmentKind
      ? String(input.attachmentKind).trim().toLowerCase()
      : inferAttachmentKind(attachmentName || "", ""))
    : null;
  const wallColor = normalizeWallColor(input.wallColor);
  return {
    id: generateId("LIB"),
    tag,
    description: String(input.description ?? "").trim(),
    category,
    mediaUrl,
    mediaKind: mediaUrl ? (category === "video" ? "video" : "image") : null,
    attachmentUrl,
    attachmentName,
    attachmentKind,
    wallColor,
    createdAt: now,
    updatedAt: now,
  };
}
