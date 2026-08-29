import { generateId } from "./ids.js";
import { normalizeLibraryNameRefs } from "./docLibraryNameRefs.js";
import { normalizeLibrarySpeakRefs } from "./docLibrarySpeakRefs.js";
import { normalizeLibraryFrameAspect } from "./libraryFrameAspect.js";

/** @typedef {"auto"|"image"|"pdf"|"skill"|"video"} FolderLibraryCategory */
/** @typedef {"prompt"|"visual"} LibraryPresentation */

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
 * @property {import("./libraryFrameAspect.js").LibraryFrameAspectId|null} frameAspect Target publish frame (contain + wall fill)
 * @property {string|null} sourceMediaUrl Original photo before frame bake (null when mediaUrl is still the source)
 * @property {string|null} setId Document library set this ficha belongs to (`null` = loose)
 * @property {boolean} loop Document Prompts: copy into assets instead of moving. Folder fichas always loop.
 * @property {string|null} promptClass User classification (`ambiente`, or legacy custom names)
 * @property {LibraryPresentation} presentation Prompt text-first vs image-only (same Prompt tab)
 * @property {string[]} aliases Alternate phrases that also link to this Prompt (e.g. "mi hermana")
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const LIBRARY_ALIAS_MAX = 8;
export const LIBRARY_ALIAS_MAX_LEN = 48;
export const LIBRARY_ALIAS_MAX_WORDS = 4;

/**
 * Normalize user-defined alias phrases for a Prompt ficha.
 * Collapses whitespace, drops empties / duplicates / the canonical tag.
 * @param {unknown} value
 * @param {string} [canonicalTag]
 * @returns {string[]}
 */
export function normalizeLibraryAliases(value, canonicalTag = "") {
  if (!Array.isArray(value) && typeof value !== "string") return [];
  const rawList = Array.isArray(value)
    ? value
    : String(value).split(/[,;\n]+/);
  const tagKey = String(canonicalTag || "").trim().toLowerCase();
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const raw of rawList) {
    if (out.length >= LIBRARY_ALIAS_MAX) break;
    const phrase = String(raw ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, LIBRARY_ALIAS_MAX_LEN);
    if (phrase.length < 2) continue;
    const words = phrase.split(" ");
    if (words.length > LIBRARY_ALIAS_MAX_WORDS) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key) || (tagKey && key === tagKey)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

/**
 * @typedef {Object} LibrarySet
 * @property {string} id
 * @property {string} tag
 * @property {string} description Story / prompt for the pack
 * @property {import("./docLibraryNameRefs.js").DocLibraryNameRef[]} [libraryNameRefs]
 * @property {import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[]} [librarySpeakRefs]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const FOLDER_LIBRARY_DEFAULT_WALL = "#151515";

/** Built-in Prompt classification (Environment / Ambiente). */
export const PROMPT_CLASS_AMBIENTE = "ambiente";

export const FOLDER_LIBRARY_CATEGORIES = /** @type {const} */ ([
  "auto",
  "image",
  "pdf",
  "skill",
  "video",
]);

/**
 * Tabs shown in the library table.
 * `prompt` = image/auto fichas with written description.
 * `visual` = image/auto fichas with a photo.
 * A ficha with both text + photo appears in both tabs.
 * Legacy stored value `image` migrates to `prompt`.
 */
export const FOLDER_LIBRARY_FILTER_TABS = /** @type {const} */ ([
  "prompt",
  "visual",
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
 * Classification name for Prompt fichas (`characters`, `element`, …).
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizePromptClass(value) {
  const raw = String(value || "").trim().slice(0, 48);
  return raw || null;
}

/**
 * Explicit presentation only — null when missing / unknown (caller may infer).
 * @param {unknown} value
 * @returns {LibraryPresentation|null}
 */
export function normalizeLibraryPresentation(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "visual" || raw === "image" || raw === "image_only" || raw === "image-only") {
    return "visual";
  }
  if (raw === "prompt" || raw === "text") return "prompt";
  return null;
}

/**
 * Prompt = text-first (default). Visual = image-only chip on the same Prompt tab.
 * Legacy fichas without the field: media + empty description → visual; else prompt.
 * @param {{ presentation?: unknown, description?: string|null, mediaUrl?: string|null }|null|undefined} item
 * @returns {LibraryPresentation}
 */
export function resolveLibraryPresentation(item) {
  const explicit = normalizeLibraryPresentation(item?.presentation);
  if (explicit) return explicit;
  const hasPrompt = Boolean(String(item?.description || "").trim());
  const hasMedia = Boolean(String(item?.mediaUrl || "").trim());
  if (hasMedia && !hasPrompt) return "visual";
  return "prompt";
}

/**
 * @param {{ presentation?: unknown, description?: string|null, mediaUrl?: string|null }|null|undefined} item
 */
export function isLibraryVisualPresentation(item) {
  return resolveLibraryPresentation(item) === "visual";
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPromptClassAmbiente(value) {
  return String(value || "").trim().toLowerCase() === PROMPT_CLASS_AMBIENTE;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizePromptClasses(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    const name = normalizePromptClass(
      typeof entry === "string" ? entry : (entry?.tag || entry?.name),
    );
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Folder fichas always loop. Document fichas loop only when marked.
 * @param {string} [ownerKind]
 * @param {{ loop?: boolean, sourceKind?: string }|null|undefined} item
 */
export function libraryItemLoops(ownerKind, item) {
  if (item?.sourceKind === "folder") return true;
  if (String(ownerKind || "").trim().toLowerCase() === "folder") return true;
  return Boolean(item?.loop);
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
 * @returns {"documents"|"prompt"|"visual"|"skill"}
 */
export function normalizeFolderLibraryFilterTab(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "prompt" || raw === "visual" || raw === "skill") return raw;
  if (raw === "documents" || raw === "docs") return "documents";
  // Legacy "image" / "all" / "video" → Prompt (previous default Prompt tab).
  if (raw === "image" || raw === "all" || raw === "video" || raw === "images") {
    return raw === "images" || raw === "visual" ? "visual" : "prompt";
  }
  return "prompt";
}

/**
 * Image/auto ficha with written prompt text.
 * @param {FolderLibraryItem|null|undefined} item
 */
export function folderLibraryItemHasPromptText(item) {
  if (!item) return false;
  const cat = String(item.category || "").trim().toLowerCase();
  if (cat !== "image" && cat !== "auto") return false;
  return Boolean(String(item.description || "").trim());
}

/**
 * Image/auto ficha with a photo.
 * @param {FolderLibraryItem|null|undefined} item
 */
export function folderLibraryItemHasVisualMedia(item) {
  if (!item) return false;
  const cat = String(item.category || "").trim().toLowerCase();
  if (cat !== "image" && cat !== "auto") return false;
  return Boolean(String(item.mediaUrl || "").trim());
}

/**
 * @param {FolderLibraryItem} item
 * @param {"documents"|"prompt"|"visual"|"skill"|"image"|string} tab
 */
export function folderLibraryItemMatchesFilter(item, tab) {
  if (!item) return false;
  if (tab === "documents") return true;
  if (tab === "prompt" || tab === "image") return folderLibraryItemHasPromptText(item);
  if (tab === "visual") return folderLibraryItemHasVisualMedia(item);
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
  const frameAspect = normalizeLibraryFrameAspect(raw.frameAspect);
  const sourceMediaUrl = typeof raw.sourceMediaUrl === "string" && raw.sourceMediaUrl.trim()
    ? raw.sourceMediaUrl.trim()
    : null;
  const setId = normalizeLibrarySetId(raw.setId);
  const loop = Boolean(raw.loop);
  const promptClass = normalizePromptClass(raw.promptClass)
    || normalizePromptClass(raw.imageRole);
  const presentation = resolveLibraryPresentation({
    presentation: raw.presentation,
    description,
    mediaUrl,
  });
  const aliases = normalizeLibraryAliases(raw.aliases, tag);
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
    frameAspect,
    sourceMediaUrl,
    setId,
    loop,
    promptClass,
    presentation,
    aliases,
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
 *   frameAspect?: string|null,
 *   sourceMediaUrl?: string|null,
 *   setId?: string|null,
 *   loop?: boolean,
 *   promptClass?: string|null,
 *   presentation?: string|null,
 *   aliases?: string[]|string|null,
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
  const description = String(input.description ?? "").trim();
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
  const frameAspect = normalizeLibraryFrameAspect(input.frameAspect);
  const sourceMediaUrl = typeof input.sourceMediaUrl === "string" && input.sourceMediaUrl.trim()
    ? input.sourceMediaUrl.trim()
    : null;
  const presentation = resolveLibraryPresentation({
    presentation: input.presentation,
    description,
    mediaUrl,
  });
  const aliases = normalizeLibraryAliases(input.aliases, tag);
  return {
    id: generateId("LIB"),
    tag,
    description,
    category,
    mediaUrl,
    mediaKind: mediaUrl ? (category === "video" ? "video" : "image") : null,
    attachmentUrl,
    attachmentName,
    attachmentKind,
    wallColor,
    frameAspect,
    sourceMediaUrl,
    setId: normalizeLibrarySetId(input.setId),
    loop: Boolean(input.loop),
    promptClass: normalizePromptClass(input.promptClass),
    presentation,
    aliases,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeLibrarySetId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return id || null;
}

/**
 * @param {unknown} raw
 * @returns {LibrarySet|null}
 */
export function normalizeLibrarySet(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
  if (!id) return null;
  const tag = typeof raw.tag === "string" ? raw.tag.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt
    ? raw.createdAt
    : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt
    ? raw.updatedAt
    : createdAt;
  const libraryNameRefs = normalizeLibraryNameRefs(description, raw.libraryNameRefs);
  const librarySpeakRefs = normalizeLibrarySpeakRefs(description, raw.librarySpeakRefs);
  return {
    id,
    tag,
    description,
    ...(libraryNameRefs.length ? { libraryNameRefs } : {}),
    ...(librarySpeakRefs.length ? { librarySpeakRefs } : {}),
    createdAt,
    updatedAt,
  };
}

/**
 * @param {unknown} value
 * @returns {LibrarySet[]}
 */
export function normalizeLibrarySets(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    const set = normalizeLibrarySet(entry);
    if (!set || seen.has(set.id)) continue;
    seen.add(set.id);
    out.push(set);
  }
  return out;
}

/**
 * Build a new document library set (does not persist).
 * @param {{ tag?: string, description?: string, libraryNameRefs?: import("./docLibraryNameRefs.js").DocLibraryNameRef[], librarySpeakRefs?: import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[] }} input
 * @returns {LibrarySet|null}
 */
export function buildLibrarySet(input = {}) {
  const tag = String(input.tag ?? "").trim();
  if (!tag) return null;
  const now = new Date().toISOString();
  const description = String(input.description ?? "").trim();
  const libraryNameRefs = normalizeLibraryNameRefs(description, input.libraryNameRefs);
  const librarySpeakRefs = normalizeLibrarySpeakRefs(description, input.librarySpeakRefs);
  return {
    id: generateId("SET"),
    tag,
    description,
    ...(libraryNameRefs.length ? { libraryNameRefs } : {}),
    ...(librarySpeakRefs.length ? { librarySpeakRefs } : {}),
    createdAt: now,
    updatedAt: now,
  };
}
