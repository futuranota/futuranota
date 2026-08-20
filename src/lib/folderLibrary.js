import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";
import { normalizeLibraryNameRefs } from "./docLibraryNameRefs.js";
import { normalizeLibrarySpeakRefs } from "./docLibrarySpeakRefs.js";
import {
  buildFolderLibraryItem,
  buildLibrarySet,
  inferAttachmentKind,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryItems,
  normalizePromptClass,
  normalizePromptClasses,
  normalizeLibrarySetId,
  normalizeLibrarySets,
  normalizeWallColor,
} from "./folderLibraryNormalize.js";

export {
  FOLDER_LIBRARY_CATEGORIES,
  FOLDER_LIBRARY_DEFAULT_WALL,
  FOLDER_LIBRARY_FILTER_TABS,
  PROMPT_CLASS_AMBIENTE,
  buildFolderLibraryItem,
  buildLibrarySet,
  folderLibraryItemMatchesFilter,
  inferAttachmentKind,
  isPromptClassAmbiente,
  normalizeFolderLibraryCategory,
  normalizeFolderLibraryFilterTab,
  libraryItemLoops,
  normalizeFolderLibraryItem,
  normalizeFolderLibraryItems,
  normalizePromptClass,
  normalizePromptClasses,
  normalizeLibrarySet,
  normalizeLibrarySetId,
  normalizeLibrarySets,
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
 * @param {{ ownerKind?: string, ownerId?: string, folderId?: string, documentId?: string }} [hints]
 * @returns {Array<{ ownerKind: LibraryOwnerKind, ownerId: string, items: import("./folderLibraryNormalize.js").FolderLibraryItem[] }>}
 */
export function listHintedLibraryCatalogs(hints = {}) {
  const catalogs = [];
  const seen = new Set();
  const push = (ownerKind, ownerId) => {
    const kind = String(ownerKind || "").trim() === "document" ? "document" : "folder";
    const id = String(ownerId || "").trim();
    if (!id) return;
    const key = `${kind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    catalogs.push({ ownerKind: kind, ownerId: id, items: listLibraryItems(kind, id) });
  };
  if (hints.ownerKind && hints.ownerId) push(hints.ownerKind, hints.ownerId);
  push("folder", hints.folderId);
  push("document", hints.documentId);
  return catalogs;
}

/**
 * All folder + document libraries (used when an Image card is missing owner ids).
 * @returns {Array<{ ownerKind: LibraryOwnerKind, ownerId: string, items: import("./folderLibraryNormalize.js").FolderLibraryItem[] }>}
 */
export function listAllLibraryCatalogs() {
  const catalogs = listHintedLibraryCatalogs();
  const seen = new Set(catalogs.map((entry) => `${entry.ownerKind}:${entry.ownerId}`));
  const push = (ownerKind, ownerId) => {
    const id = String(ownerId || "").trim();
    if (!id) return;
    const key = `${ownerKind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    catalogs.push({ ownerKind, ownerId: id, items: listLibraryItems(ownerKind, id) });
  };
  for (const id of Object.keys(useDocsStore.getState().docs || {})) {
    push("folder", id);
  }
  for (const id of Object.keys(useNodesStore.getState().nodes || {})) {
    push("document", id);
  }
  return catalogs;
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

function readPromptClasses(ownerKind, ownerId) {
  const id = String(ownerId || "").trim();
  if (!id) return [];
  const kind = normalizeLibraryOwnerKind(ownerKind);
  if (kind === "document") {
    const node = useNodesStore.getState().getNode?.(id)
      ?? useNodesStore.getState().nodes?.[id]
      ?? null;
    return normalizePromptClasses(node?.promptClasses);
  }
  const doc = useDocsStore.getState().getDoc?.(id)
    ?? useDocsStore.getState().docs?.[id]
    ?? null;
  return normalizePromptClasses(doc?.promptClasses);
}

function writePromptClasses(ownerKind, ownerId, names) {
  const id = String(ownerId || "").trim();
  if (!id) return false;
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const next = normalizePromptClasses(names);
  if (kind === "document") {
    const node = useNodesStore.getState().getNode?.(id)
      ?? useNodesStore.getState().nodes?.[id]
      ?? null;
    if (!node) return false;
    useNodesStore.getState().updateNode(id, { promptClasses: next });
    return true;
  }
  const doc = useDocsStore.getState().getDoc?.(id)
    ?? useDocsStore.getState().docs?.[id]
    ?? null;
  if (!doc) return false;
  useDocsStore.getState().updateDoc(id, { promptClasses: next });
  return true;
}

/**
 * Stored class names plus any classes already used on fichas.
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @returns {string[]}
 */
export function listPromptClasses(ownerKind, ownerId) {
  const stored = readPromptClasses(ownerKind, ownerId);
  const used = listLibraryItems(ownerKind, ownerId)
    .map((item) => item.promptClass)
    .filter(Boolean);
  return normalizePromptClasses([...stored, ...used]);
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} name
 * @returns {string|null} canonical name or null
 */
export function addPromptClass(ownerKind, ownerId, name) {
  const nextName = normalizePromptClass(name);
  if (!nextName) return null;
  const prev = listPromptClasses(ownerKind, ownerId);
  const exists = prev.some((entry) => entry.toLowerCase() === nextName.toLowerCase());
  if (exists) return prev.find((entry) => entry.toLowerCase() === nextName.toLowerCase()) || nextName;
  if (!writePromptClasses(ownerKind, ownerId, [...readPromptClasses(ownerKind, ownerId), nextName])) {
    return null;
  }
  return nextName;
}

/**
 * Remove a classification and clear it from fichas that used it.
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} name
 * @returns {boolean}
 */
export function removePromptClass(ownerKind, ownerId, name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return false;
  const stored = readPromptClasses(ownerKind, ownerId).filter(
    (entry) => entry.toLowerCase() !== target,
  );
  const wrote = writePromptClasses(ownerKind, ownerId, stored);
  const items = listLibraryItems(ownerKind, ownerId);
  let cleared = false;
  for (const item of items) {
    if (String(item.promptClass || "").toLowerCase() !== target) continue;
    if (updateLibraryItem(ownerKind, ownerId, item.id, { promptClass: null })) {
      cleared = true;
    }
  }
  return wrote || cleared;
}

/**
 * Rename a classification and retarget fichas that used the old name.
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} fromName
 * @param {string} toName
 * @returns {string|null}
 */
export function renamePromptClass(ownerKind, ownerId, fromName, toName) {
  const fromKey = String(fromName || "").trim().toLowerCase();
  const nextName = normalizePromptClass(toName);
  if (!fromKey || !nextName) return null;

  const stored = readPromptClasses(ownerKind, ownerId);
  const nextStored = [];
  const seen = new Set();
  const push = (name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    nextStored.push(name);
  };
  let replaced = false;
  for (const entry of stored) {
    if (entry.toLowerCase() === fromKey) {
      push(nextName);
      replaced = true;
      continue;
    }
    push(entry);
  }
  if (!replaced) push(nextName);
  writePromptClasses(ownerKind, ownerId, nextStored);

  for (const item of listLibraryItems(ownerKind, ownerId)) {
    if (String(item.promptClass || "").toLowerCase() !== fromKey) continue;
    if (item.promptClass === nextName) continue;
    updateLibraryItem(ownerKind, ownerId, item.id, { promptClass: nextName });
  }
  return nextName;
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {object} input
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function createLibraryItem(ownerKind, ownerId, input = {}) {
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const id = String(ownerId || "").trim();
  if (!id) return null;
  const category = normalizeFolderLibraryCategory(input.category);
  // Attachments live on the folder only — document library icon opens the folder corpus.
  if (kind === "document" && (category === "skill" || category === "pdf")) return null;
  const item = buildFolderLibraryItem({
    ...input,
    loop: input.loop !== undefined ? Boolean(input.loop) : kind === "folder",
  });
  if (!item) return null;
  const prev = listLibraryItems(kind, id);
  if (!writeLibraryItems(kind, id, [...prev, item])) return null;
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

  const setId = patch.setId !== undefined
    ? normalizeLibrarySetId(patch.setId)
    : current.setId;

  const loop = patch.loop !== undefined ? Boolean(patch.loop) : Boolean(current.loop);
  const promptClass = patch.promptClass !== undefined
    ? normalizePromptClass(patch.promptClass)
    : current.promptClass;

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
    setId,
    loop,
    promptClass,
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
    const items = normalizeFolderLibraryItems(node.libraryItems)
      .filter((item) => item.category !== "skill" && item.category !== "pdf");
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

/**
 * @param {string} ownerId
 * @returns {import("./folderLibraryNormalize.js").LibrarySet[]}
 */
function readDocumentLibrarySets(ownerId) {
  const id = String(ownerId || "").trim();
  if (!id) return [];
  const node = useNodesStore.getState().getNode?.(id)
    ?? useNodesStore.getState().nodes?.[id]
    ?? null;
  return normalizeLibrarySets(node?.librarySets);
}

/**
 * @param {string} ownerId
 * @param {import("./folderLibraryNormalize.js").LibrarySet[]} sets
 * @returns {boolean}
 */
function writeLibrarySets(ownerId, sets) {
  const id = String(ownerId || "").trim();
  if (!id) return false;
  const node = useNodesStore.getState().getNode?.(id)
    ?? useNodesStore.getState().nodes?.[id]
    ?? null;
  if (!node) return false;
  useNodesStore.getState().updateNode(id, { librarySets: sets });
  return true;
}

/**
 * Document sets only. Folders do not store sets in this slice.
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @returns {import("./folderLibraryNormalize.js").LibrarySet[]}
 */
export function listLibrarySets(ownerKind, ownerId) {
  if (normalizeLibraryOwnerKind(ownerKind) !== "document") return [];
  return readDocumentLibrarySets(ownerId);
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {{ tag?: string, description?: string, libraryNameRefs?: import("./docLibraryNameRefs.js").DocLibraryNameRef[], librarySpeakRefs?: import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[] }} input
 * @returns {import("./folderLibraryNormalize.js").LibrarySet|null}
 */
export function createLibrarySet(ownerKind, ownerId, input = {}) {
  if (normalizeLibraryOwnerKind(ownerKind) !== "document") return null;
  const id = String(ownerId || "").trim();
  if (!id) return null;
  const set = buildLibrarySet(input);
  if (!set) return null;
  const prev = readDocumentLibrarySets(id);
  if (!writeLibrarySets(id, [...prev, set])) return null;
  return set;
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} setId
 * @param {{ tag?: string, description?: string, libraryNameRefs?: import("./docLibraryNameRefs.js").DocLibraryNameRef[]|null, librarySpeakRefs?: import("./docLibrarySpeakRefs.js").DocLibrarySpeakRef[]|null }} patch
 * @returns {import("./folderLibraryNormalize.js").LibrarySet|null}
 */
export function updateLibrarySet(ownerKind, ownerId, setId, patch = {}) {
  if (normalizeLibraryOwnerKind(ownerKind) !== "document") return null;
  const owner = String(ownerId || "").trim();
  const targetId = String(setId || "").trim();
  if (!owner || !targetId) return null;

  const prev = readDocumentLibrarySets(owner);
  const index = prev.findIndex((set) => set.id === targetId);
  if (index < 0) return null;

  const current = prev[index];
  const nextTag = patch.tag !== undefined ? String(patch.tag).trim() : current.tag;
  if (!nextTag) return null;

  const nextDescription = patch.description !== undefined
    ? String(patch.description).trim()
    : current.description;
  const libraryNameRefs = normalizeLibraryNameRefs(
    nextDescription,
    patch.libraryNameRefs !== undefined
      ? (patch.libraryNameRefs || [])
      : current.libraryNameRefs,
  );
  const librarySpeakRefs = normalizeLibrarySpeakRefs(
    nextDescription,
    patch.librarySpeakRefs !== undefined
      ? (patch.librarySpeakRefs || [])
      : current.librarySpeakRefs,
  );
  const next = {
    ...current,
    tag: nextTag,
    description: nextDescription,
    libraryNameRefs: libraryNameRefs.length ? libraryNameRefs : undefined,
    librarySpeakRefs: librarySpeakRefs.length ? librarySpeakRefs : undefined,
    updatedAt: new Date().toISOString(),
  };
  const sets = [...prev];
  sets[index] = next;
  if (!writeLibrarySets(owner, sets)) return null;
  return next;
}

/**
 * Remove a set and unassign its fichas (they become loose).
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} setId
 * @returns {boolean}
 */
export function removeLibrarySet(ownerKind, ownerId, setId) {
  if (normalizeLibraryOwnerKind(ownerKind) !== "document") return false;
  const owner = String(ownerId || "").trim();
  const targetId = String(setId || "").trim();
  if (!owner || !targetId) return false;

  const prev = readDocumentLibrarySets(owner);
  const next = prev.filter((set) => set.id !== targetId);
  if (next.length === prev.length) return false;
  if (!writeLibrarySets(owner, next)) return false;

  const items = listLibraryItems("document", owner);
  const cleared = items.map((item) => (
    item.setId === targetId ? { ...item, setId: null, updatedAt: new Date().toISOString() } : item
  ));
  if (cleared.some((item, index) => item.setId !== items[index].setId)) {
    writeLibraryItems("document", owner, cleared);
  }
  return true;
}

/**
 * Fichas with no set, or whose set no longer exists.
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function listLooseLibraryItems(ownerKind, ownerId) {
  const items = listLibraryItems(ownerKind, ownerId);
  if (normalizeLibraryOwnerKind(ownerKind) !== "document") return items;
  const known = new Set(listLibrarySets(ownerKind, ownerId).map((set) => set.id));
  return items.filter((item) => !item.setId || !known.has(item.setId));
}

/**
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} setId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function listLibrarySetItems(ownerKind, ownerId, setId) {
  const targetId = String(setId || "").trim();
  if (!targetId) return [];
  return listLibraryItems(ownerKind, ownerId).filter((item) => item.setId === targetId);
}

/**
 * Assign a document ficha to a set, or `null` to make it loose.
 * @param {LibraryOwnerKind|string} ownerKind
 * @param {string} ownerId
 * @param {string} itemId
 * @param {string|null} setId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function assignLibraryItemToSet(ownerKind, ownerId, itemId, setId) {
  if (normalizeLibraryOwnerKind(ownerKind) !== "document") return null;
  const owner = String(ownerId || "").trim();
  const targetItem = String(itemId || "").trim();
  if (!owner || !targetItem) return null;

  const nextSetId = normalizeLibrarySetId(setId);
  if (nextSetId) {
    const sets = listLibrarySets("document", owner);
    if (!sets.some((set) => set.id === nextSetId)) return null;
  }
  return updateLibraryItem("document", owner, targetItem, { setId: nextSetId });
}

/**
 * Duplicate a ficha into a document asset. The source is left in place
 * (same wardrobe in another park).
 * @param {string} ownerId
 * @param {object} source
 * @param {string} setId
 * @returns {import("./folderLibraryNormalize.js").FolderLibraryItem|null}
 */
export function cloneLibraryItemIntoSet(ownerId, source, setId) {
  const owner = String(ownerId || "").trim();
  const nextSetId = normalizeLibrarySetId(setId);
  const tag = String(source?.tag || "").trim();
  if (!owner || !nextSetId || !tag) return null;
  const sets = listLibrarySets("document", owner);
  if (!sets.some((set) => set.id === nextSetId)) return null;
  return createLibraryItem("document", owner, {
    tag,
    description: source.description || "",
    category: source.category,
    mediaUrl: source.mediaUrl,
    attachmentUrl: source.attachmentUrl,
    attachmentName: source.attachmentName,
    attachmentKind: source.attachmentKind,
    wallColor: source.wallColor,
    setId: nextSetId,
    loop: false,
    promptClass: source.promptClass,
  });
}
