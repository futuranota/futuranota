import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import {
  buildFolderLibraryItem,
  inferAttachmentKind,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryItems,
  normalizeWallColor,
} from "./folderLibraryNormalize.js";

export {
  FOLDER_LIBRARY_CATEGORIES,
  FOLDER_LIBRARY_DEFAULT_WALL,
  FOLDER_LIBRARY_FILTER_TABS,
  buildFolderLibraryItem,
  folderLibraryItemMatchesFilter,
  inferAttachmentKind,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryFilterTab,
  normalizeFolderLibraryItem,
  normalizeFolderLibraryItems,
  normalizeWallColor,
  resolveWallColor,
} from "./folderLibraryNormalize.js";

/** @typedef {"folder"|"document"} LibraryOwnerKind */

/**
 * @param {unknown} value
 * @returns {LibraryOwnerKind}
 */
export function normalizeLibraryOwnerKind(value) {
  return String(value || "").trim().toLowerCase() === "document"
    ? "document"
    : "folder";
}

/**
 * @param {object|null|undefined} node
 * @returns {string}
 */
export function libraryDocumentTitle(node) {
  return String(node?.sourceQuery || node?.title || "")
    .trim() || "Untitled";
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function listLibraryItems(ownerKind, ownerId) {
  const id = String(ownerId || "").trim();
  if (!id) return [];
  const kind = normalizeLibraryOwnerKind(ownerKind);
  if (kind === "document") {
    const node = useNodesStore.getState().getNode?.(id)
      ?? useNodesStore.getState().nodes?.[id]
      ?? null;
    return normalizeFolderLibraryItems(node?.libraryItems);
  }
  const doc = useDocsStore.getState().getDoc?.(id)
    ?? useDocsStore.getState().docs?.[id]
    ?? null;
  return normalizeFolderLibraryItems(doc?.libraryItems);
}

/**
 * @param {string} folderId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function listFolderLibraryItems(folderId) {
  return listLibraryItems("folder", folderId);
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {import("./folderLibraryNormalize.js").FolderLibraryItem[]} items
 * @returns {boolean}
 */
function writeLibraryItems(ownerKind, ownerId, items) {
  const id = String(ownerId || "").trim();
  if (!id) return false;
  const kind = normalizeLibraryOwnerKind(ownerKind);
  if (kind === "document") {
    const node = useNodesStore.getState().getNode?.(id)
      ?? useNodesStore.getState().nodes?.[id]
      ?? null;
    if (!node) return false;
    useNodesStore.getState().updateNode(id, { libraryItems: items });
    return true;
  }
  const doc = useDocsStore.getState().getDoc?.(id)
    ?? useDocsStore.getState().docs?.[id]
    ?? null;
  if (!doc) return false;
  useDocsStore.getState().updateDoc(id, { libraryItems: items });
  return true;
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {object} input
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function createLibraryItem(ownerKind, ownerId, input = {}) {
  const id = String(ownerId || "").trim();
  if (!id) return null;
  const item = buildFolderLibraryItem(input);
  if (!item) return null;
  const prev = listLibraryItems(ownerKind, id);
  if (!writeLibraryItems(ownerKind, id, [...prev, item])) return null;
  return item;
}

/**
 * @param {string} folderId
 * @param {object} input
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function createFolderLibraryItem(folderId, input = {}) {
  return createLibraryItem("folder", folderId, input);
}

/**
 * @param {object} current
 * @param {object} patch
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
function applyLibraryItemPatch(current, patch = {}) {
  const nextTag = patch.tag !== undefined ? String(patch.tag).trim() : current.tag;
  if (!nextTag) return null;

  const category = patch.category !== undefined
    ? normalizeFolderLibraryCategory(patch.category)
    : current.category;

  const mediaUrl = patch.mediaUrl !== undefined
    ? (typeof patch.mediaUrl === "string" && patch.mediaUrl.trim()
      ? patch.mediaUrl.trim()
      : null)
    : current.mediaUrl;

  const attachmentUrl = patch.attachmentUrl !== undefined
    ? (typeof patch.attachmentUrl === "string" && patch.attachmentUrl.trim()
      ? patch.attachmentUrl.trim()
      : null)
    : current.attachmentUrl;

  const attachmentName = patch.attachmentName !== undefined
    ? (typeof patch.attachmentName === "string" && patch.attachmentName.trim()
      ? patch.attachmentName.trim()
      : null)
    : (attachmentUrl ? current.attachmentName : null);

  const attachmentKind = attachmentUrl
    ? (patch.attachmentKind !== undefined
      ? (typeof patch.attachmentKind === "string" && patch.attachmentKind.trim()
        ? patch.attachmentKind.trim().toLowerCase()
        : inferAttachmentKind(attachmentName || "", ""))
      : (current.attachmentKind || inferAttachmentKind(attachmentName || "", "")))
    : null;

  const wallColor = patch.wallColor !== undefined
    ? normalizeWallColor(patch.wallColor)
    : current.wallColor;

  return {
    ...current,
    tag: nextTag,
    description: patch.description !== undefined
      ? String(patch.description).trim()
      : current.description,
    category,
    mediaUrl,
    mediaKind: mediaUrl
      ? (category === "video" || current.mediaKind === "video" ? "video" : "image")
      : null,
    attachmentUrl,
    attachmentName: attachmentUrl ? attachmentName : null,
    attachmentKind,
    wallColor,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} itemId
 * @param {object} patch
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function updateLibraryItem(ownerKind, ownerId, itemId, patch = {}) {
  const owner = String(ownerId || "").trim();
  const targetId = String(itemId || "").trim();
  if (!owner || !targetId) return null;

  const prev = listLibraryItems(ownerKind, owner);
  const index = prev.findIndex((item) => item.id === targetId);
  if (index < 0) return null;

  const next = applyLibraryItemPatch(prev[index], patch);
  if (!next) return null;

  const items = [...prev];
  items[index] = next;
  if (!writeLibraryItems(ownerKind, owner, items)) return null;
  return next;
}

/**
 * @param {string} folderId
 * @param {string} itemId
 * @param {object} patch
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function updateFolderLibraryItem(folderId, itemId, patch = {}) {
  return updateLibraryItem("folder", folderId, itemId, patch);
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} itemId
 * @returns {boolean}
 */
export function removeLibraryItem(ownerKind, ownerId, itemId) {
  const owner = String(ownerId || "").trim();
  const targetId = String(itemId || "").trim();
  if (!owner || !targetId) return false;

  const prev = listLibraryItems(ownerKind, owner);
  const next = prev.filter((item) => item.id !== targetId);
  if (next.length === prev.length) return false;
  return writeLibraryItems(ownerKind, owner, next);
}

/**
 * @param {string} folderId
 * @param {string} itemId
 * @returns {boolean}
 */
export function removeFolderLibraryItem(folderId, itemId) {
  return removeLibraryItem("folder", folderId, itemId);
}

/**
 * Document libraries that belong to a folder (only docs that already have fichas).
 * @param {string} folderId
 * @returns {{ documentId: string, title: string, items: import("./folderLibraryNormalize.js").FolderLibraryItem[] }[]}
 */
export function listDocumentLibraryGroups(folderId) {
  const id = String(folderId || "").trim();
  if (!id) return [];
  const nodesStore = useNodesStore.getState();
  const children = typeof nodesStore.getNodesByDoc === "function"
    ? nodesStore.getNodesByDoc(id)
    : Object.values(nodesStore.nodes || {}).filter((node) => node?.parentDocId === id);
  const groups = [];
  for (const node of children) {
    if (!node?.id) continue;
    const items = normalizeFolderLibraryItems(node.libraryItems);
    if (!items.length) continue;
    groups.push({
      documentId: node.id,
      title: libraryDocumentTitle(node),
      items,
    });
  }
  groups.sort((a, b) => a.title.localeCompare(b.title));
  return groups;
}
