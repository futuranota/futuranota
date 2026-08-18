import { useMemo } from "react";
import {
  listDocumentLibraryGroups,
  normalizeFolderLibraryItems,
  normalizeLibraryOwnerKind,
  normalizeLibrarySets,
  normalizePromptClasses,
} from "../lib/folderLibrary.js";
import { useDocsStore } from "../stores/docsStore.js";
import { useNodesStore } from "../stores/nodesStore.js";

/**
 * Live library fichas for a folder or document owner.
 * @param {string} [ownerKind]
 * @param {string} [ownerId]
 * @returns {import("../lib/folderLibraryNormalize.js").FolderLibraryItem[]}
 */
export function useLibraryItems(ownerKind, ownerId) {
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const id = String(ownerId || "").trim();
  const folderItems = useDocsStore((s) => (kind === "folder" ? s.docs?.[id]?.libraryItems : undefined));
  const nodeItems = useNodesStore((s) => (kind === "document" ? s.nodes?.[id]?.libraryItems : undefined));
  return useMemo(
    () => normalizeFolderLibraryItems(kind === "document" ? nodeItems : folderItems),
    [kind, folderItems, nodeItems],
  );
}

/**
 * Live library sets for a document owner (folders have none).
 * @param {string} [ownerKind]
 * @param {string} [ownerId]
 * @returns {import("../lib/folderLibraryNormalize.js").LibrarySet[]}
 */
export function useLibrarySets(ownerKind, ownerId) {
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const id = String(ownerId || "").trim();
  const nodeSets = useNodesStore((s) => (kind === "document" ? s.nodes?.[id]?.librarySets : undefined));
  return useMemo(
    () => (kind === "document" ? normalizeLibrarySets(nodeSets) : []),
    [kind, nodeSets],
  );
}

/**
 * User-created Prompt classifications for a folder or document.
 * @param {string} [ownerKind]
 * @param {string} [ownerId]
 * @returns {string[]}
 */
export function usePromptClasses(ownerKind, ownerId) {
  const kind = normalizeLibraryOwnerKind(ownerKind);
  const id = String(ownerId || "").trim();
  const folderClasses = useDocsStore((s) => (kind === "folder" ? s.docs?.[id]?.promptClasses : undefined));
  const nodeClasses = useNodesStore((s) => (kind === "document" ? s.nodes?.[id]?.promptClasses : undefined));
  const items = useLibraryItems(kind, id);
  return useMemo(() => {
    const stored = kind === "document" ? nodeClasses : folderClasses;
    const used = items.map((item) => item.promptClass).filter(Boolean);
    return normalizePromptClasses([...(stored || []), ...used]);
  }, [folderClasses, items, kind, nodeClasses]);
}

/**
 * Document sub-libraries under a folder (only docs that already have fichas).
 * @param {string} [folderId]
 */
export function useDocumentLibraryGroups(folderId) {
  const id = String(folderId || "").trim();
  const nodeIds = useDocsStore((s) => s.docs?.[id]?.nodeIds);
  const nodes = useNodesStore((s) => s.nodes);
  return useMemo(
    () => listDocumentLibraryGroups(id),
    [id, nodeIds, nodes],
  );
}
