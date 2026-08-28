import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/useI18n.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import {
  useDocumentLibraryGroups,
  useLibraryItems,
  useLibrarySets,
  usePromptClasses,
} from "../../hooks/useLibraryItems.js";
import { uploadDocAttachmentFile } from "../../lib/docImageStorage.js";
import { generateId } from "../../lib/ids.js";
import {
  extractTextFromPdfData,
  fetchPdfBytesFromUrl,
  isPdfLibraryAttachment,
} from "../../lib/importPdfText.js";
import {
  addPromptClass,
  assignLibraryItemToSet,
  createLibraryItem,
  folderLibraryItemMatchesFilter,
  listAllLibraryCatalogs,
  libraryDocumentTitle,
  normalizeFolderLibraryFilterTab,
  normalizeLibraryOwnerKind,
  removeLibraryItem,
  removeLibrarySet,
  removePromptClass,
  renamePromptClass,
} from "../../lib/folderLibrary.js";
import {
  flattenAttachmentPicksFromCatalogs,
  flattenVisualPicksFromCatalogs,
} from "../../lib/libraryImageCardPick.js";
import {
  LIBRARY_MEDIA_BADGE_SRC,
  fichaShowsMediaBadge,
  pickDocLibraryPreviews,
  promptPreviewText,
  resolveFichaPreviewKind,
  libraryTilePrefer,
} from "../../lib/libraryFichaPreview.js";
import { FolderLibraryElementModal } from "./FolderLibraryElementModal.jsx";
import { FolderLibraryAssetDetail } from "./FolderLibraryAssetDetail.jsx";
import { FolderLibraryImageDetail } from "./FolderLibraryImageDetail.jsx";
import { FolderLibrarySkillDetail } from "./FolderLibrarySkillDetail.jsx";
import { FolderLibraryVideoDetail } from "./FolderLibraryVideoDetail.jsx";
import { LibrarySetInputModal } from "./LibrarySetInputModal.jsx";

const SCOPE_OPTIONS = [
  { id: "workspace", labelKey: "doc.library.scopeWorkspace", iconSrc: "/uploads/docs-main.svg" },
  { id: "folder", labelKey: "doc.library.scopeFolder", iconSrc: "/uploads/folder-main.svg" },
  { id: "docs", labelKey: "doc.library.scopeDocs", iconSrc: "/uploads/folder-view.svg" },
];

const FILTER_STORAGE_PREFIX = "fn-folder-library-filter:";

function resolveLibraryFilterTab(tab, { allowSkill = false, allowDocuments = false } = {}) {
  const next = normalizeFolderLibraryFilterTab(tab);
  if (next === "skill" && !allowSkill) return allowDocuments ? "documents" : "prompt";
  if (next === "documents" && !allowDocuments) return "prompt";
  return next;
}

function readStoredFilter(ownerKey, fallback = "prompt") {
  try {
    const raw = sessionStorage.getItem(`${FILTER_STORAGE_PREFIX}${ownerKey}`);
    if (!raw) return fallback;
    return normalizeFolderLibraryFilterTab(raw);
  } catch {
    return fallback;
  }
}

function writeStoredFilter(ownerKey, tab) {
  try {
    sessionStorage.setItem(
      `${FILTER_STORAGE_PREFIX}${ownerKey}`,
      normalizeFolderLibraryFilterTab(tab),
    );
  } catch {
    /* ignore */
  }
}

function formatBadge(item) {
  if (item.attachmentKind) return String(item.attachmentKind).toUpperCase().slice(0, 6);
  if (item.category === "pdf") return "PDF";
  if (item.category === "skill") return "FILE";
  if (item.category === "image") return "TXT";
  if (item.category === "video") return "VIDEO";
  return "FILE";
}

function MediaBadge({ item, prefer }) {
  if (!fichaShowsMediaBadge(item, prefer)) return null;
  return (
    <img
      className="folder-library-overlay__cell-media-badge"
      src={LIBRARY_MEDIA_BADGE_SRC}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}

function renderFichaFace(item, prefer) {
  const isAttachment = item?.category === "skill" || item?.category === "pdf";
  const kind = isAttachment ? "badge" : resolveFichaPreviewKind(item, prefer);
  if (kind === "prompt") {
    return (
      <>
        <span className="folder-library-overlay__cell-prompt">
          {promptPreviewText(item)}
        </span>
        <MediaBadge item={item} prefer={prefer} />
      </>
    );
  }
  if (kind === "image") {
    return (
      <img
        className="folder-library-overlay__cell-img"
        src={item.mediaUrl}
        alt=""
      />
    );
  }
  return (
    <span
      className={
        "folder-library-overlay__cell-badge"
        + ` folder-library-overlay__cell-badge--${item.category}`
      }
      aria-hidden
    >
      <span className="folder-library-overlay__cell-badge-lines" />
      <span className="folder-library-overlay__cell-badge-fmt">
        {formatBadge(item)}
      </span>
    </span>
  );
}

function renderMiniFichaFace(item, prefer) {
  const kind = resolveFichaPreviewKind(item, prefer);
  if (kind === "image") {
    return <img src={item.mediaUrl} alt="" />;
  }
  return (
    <>
      {promptPreviewText(item)}
      <MediaBadge item={item} prefer={prefer} />
    </>
  );
}

function miniFichaClass(item, prefer) {
  const kind = resolveFichaPreviewKind(item, prefer);
  return "folder-library-overlay__mini-prompt"
    + (kind === "image" ? " folder-library-overlay__mini-prompt--media" : "");
}

/**
 * Folder / document library table.
 * Folder: Prompt row + Attachments tab; contextual [+].
 * Document: Assets + Attachments + Prompt. Attachments always read/write the
 * parent folder corpus (same list as folder Library).
 */
export function FolderLibraryOverlay({
  folderId,
  folderLibraryId = "",
  ownerKind = "folder",
  ownerId,
  initialTab = null,
  /** When true, PDF → text is enabled (document writing surface is empty). */
  writingEmpty = false,
  /**
   * Import extracted PDF text into the open document writing area.
   * @type {null|((payload: { text: string, tag?: string }) => Promise<void>|void)}
   */
  onImportPdfToWriting = null,
  /** Gina: open PDF file picker once, upload attachment, then run PDF → text. */
  autoStartPdfImport = false,
  onAutoStartPdfImportConsumed = null,
  onClose,
}) {
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const rootKind = normalizeLibraryOwnerKind(ownerKind);
  const rootId = String(ownerId || folderId || "").trim();
  const isDocumentRoot = rootKind === "document";

  const [scope, setScope] = useState("folder");
  const [focusedDocumentId, setFocusedDocumentId] = useState(null);
  const [focusedAssetId, setFocusedAssetId] = useState(null);
  const [workspaceInspect, setWorkspaceInspect] = useState(null);
  const activeKind = isDocumentRoot || focusedDocumentId ? "document" : "folder";
  const activeId = isDocumentRoot ? rootId : (focusedDocumentId || rootId);

  const docsMap = useDocsStore((s) => s.docs);
  const nodesMap = useNodesStore((s) => s.nodes);

  const itemsPrimary = useLibraryItems(activeKind, activeId);
  const assets = useLibrarySets(activeKind, activeId);
  const promptClasses = usePromptClasses(activeKind, activeId);
  const docGroups = useDocumentLibraryGroups(isDocumentRoot ? "" : rootId);
  const showingWorkspace = !isDocumentRoot && scope === "workspace" && !focusedDocumentId;
  const showScopeBar = !isDocumentRoot;
  const scopeBarOptions = SCOPE_OPTIONS.filter((option) => {
    if (option.id === "docs") return docGroups.length > 0;
    return true;
  });
  const showingDocsIndex = !isDocumentRoot && scope === "docs" && !focusedDocumentId;
  const showingDocumentGrid = isDocumentRoot || Boolean(focusedDocumentId);
  // Attachments always belong to the folder. Document Library shows the same button
  // and the same folder files (resolve parent if prop is missing).
  const documentParentFolderId = useNodesStore((s) => {
    if (!isDocumentRoot && !focusedDocumentId) return "";
    const docId = isDocumentRoot ? rootId : focusedDocumentId;
    const node = s.getNode?.(docId) ?? s.nodes?.[docId] ?? null;
    return String(node?.parentDocId || "").trim();
  });
  const documentRootTitle = useNodesStore((s) => {
    if (!isDocumentRoot || !rootId) return "";
    const node = s.getNode?.(rootId) ?? s.nodes?.[rootId] ?? null;
    return libraryDocumentTitle(node);
  });
  const attachmentOwnerId = String(
    isDocumentRoot || focusedDocumentId
      ? (folderLibraryId || documentParentFolderId || "")
      : rootId,
  ).trim();
  const canUseAttachments = !showingDocsIndex && Boolean(attachmentOwnerId);
  const folderAttachmentItems = useLibraryItems("folder", attachmentOwnerId);
  const folderAttachmentCount = folderAttachmentItems.filter(
    (item) => item.category === "skill" || item.category === "pdf",
  ).length;
  const hasFolderAttachments = folderAttachmentCount > 0;

  const filterKey = `${activeKind}:${activeId}`;
  const defaultTab = showingDocumentGrid ? "documents" : "prompt";
  const tabOptions = { allowSkill: canUseAttachments, allowDocuments: showingDocumentGrid };
  const requestedTab = initialTab
    ? resolveLibraryFilterTab(initialTab, tabOptions)
    : null;

  const [filterTab, setFilterTab] = useState(() => {
    if (requestedTab) return requestedTab;
    return resolveLibraryFilterTab(readStoredFilter(filterKey, defaultTab), tabOptions);
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [createCategory, setCreateCategory] = useState("image");
  const [createMediaUrl, setCreateMediaUrl] = useState("");
  const [createPresentation, setCreatePresentation] = useState("prompt");
  const [lockCategory, setLockCategory] = useState(false);
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailKind, setDetailKind] = useState(null);
  const [promptClassFilter, setPromptClassFilter] = useState("");
  const [classDraftOpen, setClassDraftOpen] = useState(false);
  const [classDraft, setClassDraft] = useState("");
  const [editingClass, setEditingClass] = useState("");
  const [classEditDraft, setClassEditDraft] = useState("");
  const classDraftRef = useRef(null);
  const classEditRef = useRef(null);
  const pdfAutoUploadInputRef = useRef(null);
  const autoPdfImportStartedRef = useRef(false);
  const [pdfToTextBusy, setPdfToTextBusy] = useState(false);
  const [pdfToTextError, setPdfToTextError] = useState("");
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);

  useEffect(() => {
    if (requestedTab) {
      setFilterTab(requestedTab);
      writeStoredFilter(filterKey, requestedTab);
      return;
    }
    setFilterTab(resolveLibraryFilterTab(readStoredFilter(filterKey, defaultTab), tabOptions));
  }, [filterKey, requestedTab, defaultTab, canUseAttachments, showingDocumentGrid]);

  useEffect(() => {
    setPromptClassFilter("");
    setClassDraftOpen(false);
    setClassDraft("");
    setEditingClass("");
    setClassEditDraft("");
  }, [filterKey]);

  useEffect(() => {
    if (!classDraftOpen) return;
    classDraftRef.current?.focus();
  }, [classDraftOpen]);

  useEffect(() => {
    if (!editingClass) return;
    classEditRef.current?.focus();
    classEditRef.current?.select();
  }, [editingClass]);

  useEffect(() => {
    const allowed = new Set(
      showingDocumentGrid ? ["documents", "prompt", "visual", "skill"] : ["prompt", "visual", "skill"],
    );
    if (!allowed.has(filterTab)) {
      setFilterTab(defaultTab);
      writeStoredFilter(filterKey, defaultTab);
    }
  }, [filterKey, filterTab, showingDocumentGrid, defaultTab]);

  useEffect(() => {
    if (isDocumentRoot) {
      setScope("folder");
      setFocusedDocumentId(null);
      return;
    }
    if (scope === "docs" && docGroups.length === 0) {
      setScope("folder");
      setFocusedDocumentId(null);
    }
  }, [isDocumentRoot, docGroups.length, scope]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (pdfPickerOpen) {
        event.preventDefault();
        setPdfPickerOpen(false);
        return;
      }
      if (modalOpen || assetModalOpen || detailItemId) return;
      if (focusedAssetId) {
        event.preventDefault();
        setFocusedAssetId(null);
        return;
      }
      if (focusedDocumentId) {
        event.preventDefault();
        setFocusedDocumentId(null);
        return;
      }
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    onClose,
    modalOpen,
    assetModalOpen,
    detailItemId,
    focusedAssetId,
    focusedDocumentId,
    pdfPickerOpen,
  ]);

  const showingDocumentsTab = showingDocumentGrid && filterTab === "documents";
  const showingAttachments = canUseAttachments && filterTab === "skill";
  const attachmentMutateKind = "folder";
  const attachmentMutateId = attachmentOwnerId;
  const items = showingAttachments ? folderAttachmentItems : itemsPrimary;
  const canImportPdfToWriting = typeof onImportPdfToWriting === "function";
  const pdfAttachmentItems = useMemo(
    () => (showingAttachments
      ? folderAttachmentItems.filter(
        (item) => isPdfLibraryAttachment(item) && Boolean(item?.attachmentUrl),
      )
      : []),
    [showingAttachments, folderAttachmentItems],
  );

  useEffect(() => {
    if (showingAttachments) return;
    setPdfPickerOpen(false);
    setPdfToTextError("");
  }, [showingAttachments]);

  const looseItems = useMemo(
    () => (showingDocumentGrid ? items.filter((item) => !item.setId) : items),
    [items, showingDocumentGrid],
  );

  const focusedAsset = assets.find((asset) => asset.id === focusedAssetId) || null;
  const assetCounts = useMemo(() => {
    const counts = {};
    for (const asset of assets) counts[asset.id] = 0;
    for (const item of itemsPrimary) {
      if (item.setId && counts[item.setId] != null) counts[item.setId] += 1;
    }
    return counts;
  }, [assets, itemsPrimary]);

  const filteredItems = useMemo(() => {
    const source = showingAttachments
      ? items
      : (showingDocumentGrid ? looseItems : items);
    const byTab = source.filter((item) => folderLibraryItemMatchesFilter(item, filterTab));
    if (filterTab !== "prompt" || !promptClassFilter) return byTab;
    return byTab.filter(
      (item) => String(item.promptClass || "").toLowerCase() === promptClassFilter.toLowerCase(),
    );
  }, [items, looseItems, filterTab, showingDocumentGrid, showingAttachments, promptClassFilter]);

  const focusedGroup = focusedDocumentId
    ? docGroups.find((group) => group.documentId === focusedDocumentId)
    : null;

  const setFilter = (next) => {
    const tab = normalizeFolderLibraryFilterTab(next);
    setFilterTab(tab);
    writeStoredFilter(filterKey, tab);
    setFocusedAssetId(null);
  };

  const openCreate = (category, presentation = "prompt") => {
    setEditingItem(null);
    setCreateCategory(category);
    setCreatePresentation(presentation === "visual" ? "visual" : "prompt");
    setLockCategory(true);
    setModalOpen(true);
  };

  const openCreatePrompt = () => {
    setCreateMediaUrl("");
    openCreate("image", "prompt");
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setCreateCategory(item.category || "auto");
    setLockCategory(false);
    setModalOpen(true);
  };

  const openEditFromDetail = (item) => {
    setDetailItemId(null);
    setDetailKind(null);
    openEdit(item);
  };

  const openItem = (item) => {
    if (item.category === "image") {
      setDetailKind("image");
      setDetailItemId(item.id);
      return;
    }
    if (item.category === "video") {
      setDetailKind("video");
      setDetailItemId(item.id);
      return;
    }
    if (item.category === "skill" || item.category === "pdf") {
      setDetailKind("skill");
      setDetailItemId(item.id);
      return;
    }
    openEdit(item);
  };

  const pdfToTextTitle = (() => {
    if (pdfToTextError) return pdfToTextError;
    if (!canImportPdfToWriting) return t("doc.library.pdfToTextUnavailable");
    if (!writingEmpty) return t("doc.library.pdfToTextNeedEmpty");
    return t("doc.library.pdfToTextTitle");
  })();

  const pdfToTextEnabled = canImportPdfToWriting
    && writingEmpty
    && !pdfToTextBusy;

  const openLocalPdfUpload = () => {
    if (!canImportPdfToWriting || pdfToTextBusy) return;
    if (!writingEmpty) {
      setPdfToTextError(t("doc.library.pdfToTextNeedEmpty"));
      return;
    }
    setPdfToTextError("");
    setPdfPickerOpen(false);
    pdfAutoUploadInputRef.current?.click();
  };

  const importPdfAttachment = async (target) => {
    if (!target?.attachmentUrl) {
      setPdfToTextError(t("doc.library.pdfToTextNeedPdf"));
      return;
    }
    setPdfToTextError("");
    setPdfPickerOpen(false);
    setPdfToTextBusy(true);
    try {
      const bytes = await fetchPdfBytesFromUrl(target.attachmentUrl);
      const extracted = await extractTextFromPdfData(bytes);
      if (extracted.empty) {
        setPdfToTextError(t("docs.importPdfEmpty"));
        return;
      }
      await onImportPdfToWriting({
        text: extracted.text,
        tag: target.tag || target.attachmentName || "",
      });
    } catch (err) {
      console.error("[pdfToText]", err);
      setPdfToTextError(t("docs.importPdfFailed"));
    } finally {
      setPdfToTextBusy(false);
    }
  };

  const handlePdfToText = () => {
    if (!canImportPdfToWriting || pdfToTextBusy) return;
    if (!writingEmpty) {
      setPdfToTextError(t("doc.library.pdfToTextNeedEmpty"));
      return;
    }
    setPdfToTextError("");
    setPdfPickerOpen(true);
  };

  const handleAutoPdfUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf = String(file.type || "").toLowerCase() === "application/pdf"
      || /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      setPdfToTextError(t("docs.importPdfInvalid"));
      return;
    }
    if (!canImportPdfToWriting) {
      setPdfToTextError(t("doc.library.pdfToTextUnavailable"));
      return;
    }
    if (!writingEmpty) {
      setPdfToTextError(t("doc.library.pdfToTextNeedEmpty"));
      return;
    }
    if (!attachmentOwnerId) {
      setPdfToTextError(t("doc.library.pdfToTextUnavailable"));
      return;
    }
    setPdfToTextError("");
    setPdfToTextBusy(true);
    try {
      const uploaded = await uploadDocAttachmentFile(file, {
        fileId: generateId("LIBPDF"),
        scopeId: attachmentOwnerId || "folder-lib",
        fileName: file.name,
      });
      const tagBase = String(file.name || "").replace(/\.pdf$/i, "").trim() || "PDF";
      const created = createLibraryItem("folder", attachmentOwnerId, {
        tag: tagBase,
        category: "pdf",
        attachmentUrl: uploaded.url,
        attachmentName: uploaded.name || file.name,
        attachmentKind: uploaded.kind || "pdf",
      });
      if (!created?.attachmentUrl) {
        setPdfToTextError(t("docs.importPdfFailed"));
        setPdfToTextBusy(false);
        return;
      }
      await importPdfAttachment(created);
    } catch (err) {
      console.error("[autoPdfImport]", err);
      setPdfToTextError(err?.message || t("docs.importPdfFailed"));
      setPdfToTextBusy(false);
    }
  };

  useEffect(() => {
    if (!autoStartPdfImport) {
      autoPdfImportStartedRef.current = false;
      return undefined;
    }
    if (autoPdfImportStartedRef.current) return undefined;
    autoPdfImportStartedRef.current = true;
    onAutoStartPdfImportConsumed?.();
    if (!canImportPdfToWriting) {
      setPdfToTextError(t("doc.library.pdfToTextUnavailable"));
      return undefined;
    }
    if (!writingEmpty) {
      setPdfToTextError(t("doc.library.pdfToTextNeedEmpty"));
      return undefined;
    }
    const timer = window.setTimeout(() => {
      pdfAutoUploadInputRef.current?.click();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    autoStartPdfImport,
    canImportPdfToWriting,
    writingEmpty,
    onAutoStartPdfImportConsumed,
    t,
  ]);

  const handleDelete = async (item, ownerOverride = null) => {
    const tag = String(item?.tag || item?.attachmentName || "").trim() || "—";
    const ok = await askConfirm({
      title: t("doc.library.deleteItemTitle"),
      message: t("doc.library.deleteConfirm").replace("{tag}", tag),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    if (detailItemId === item.id) {
      setDetailItemId(null);
      setDetailKind(null);
    }
    const kind = ownerOverride?.ownerKind
      || workspaceInspect?.ownerKind
      || (showingAttachments ? attachmentMutateKind : activeKind);
    const id = ownerOverride?.ownerId
      || workspaceInspect?.ownerId
      || (showingAttachments ? attachmentMutateId : activeId);
    removeLibraryItem(kind, id, item.id);
  };

  const handleDeleteAsset = async (asset, event) => {
    event.preventDefault();
    event.stopPropagation();
    const tag = String(asset?.tag || "").trim() || "—";
    const ok = await askConfirm({
      title: t("doc.library.assetDeleteTitle"),
      message: t("doc.library.assetDeleteConfirm", { tag }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    removeLibrarySet(activeKind, activeId, asset.id);
    if (focusedAssetId === asset.id) setFocusedAssetId(null);
  };

  const commitClassDraft = () => {
    const created = addPromptClass(activeKind, activeId, classDraft);
    setClassDraftOpen(false);
    setClassDraft("");
    if (created) setPromptClassFilter(created);
  };

  const startClassEdit = (name) => {
    setClassDraftOpen(false);
    setClassDraft("");
    setEditingClass(name);
    setClassEditDraft(name);
    setPromptClassFilter(name);
  };

  const cancelClassEdit = () => {
    setEditingClass("");
    setClassEditDraft("");
  };

  const commitClassEdit = () => {
    const fromName = editingClass;
    if (!fromName) return;
    const next = String(classEditDraft || "").trim();
    if (!next) {
      cancelClassEdit();
      return;
    }
    const renamed = renamePromptClass(activeKind, activeId, fromName, next);
    cancelClassEdit();
    if (renamed) setPromptClassFilter(renamed);
  };

  const handleDeleteClass = async (name, event) => {
    event.preventDefault();
    event.stopPropagation();
    const label = String(name || "").trim();
    if (!label) return;
    const ok = await askConfirm({
      title: t("doc.library.promptClassDeleteTitle"),
      message: t("doc.library.promptClassDeleteConfirm", { name: label }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    removePromptClass(activeKind, activeId, label);
    if (editingClass.toLowerCase() === label.toLowerCase()) {
      cancelClassEdit();
    }
    if (promptClassFilter.toLowerCase() === label.toLowerCase()) {
      setPromptClassFilter("");
    }
  };

  const handleScope = (next) => {
    setScope(next);
    setFocusedDocumentId(null);
    setFocusedAssetId(null);
    setWorkspaceInspect(null);
    setDetailItemId(null);
    setDetailKind(null);
    setModalOpen(false);
    setAssetModalOpen(false);
    setEditingAsset(null);
  };

  const workspaceImagePicks = useMemo(() => {
    if (!showingWorkspace) return [];
    return flattenVisualPicksFromCatalogs(listAllLibraryCatalogs());
  }, [showingWorkspace, docsMap, nodesMap]);

  const workspaceAttachmentPicks = useMemo(() => {
    if (!showingWorkspace) return [];
    return flattenAttachmentPicksFromCatalogs(listAllLibraryCatalogs());
  }, [showingWorkspace, docsMap, nodesMap]);

  const inspectKind = workspaceInspect?.ownerKind
    || (showingAttachments ? attachmentMutateKind : activeKind);
  const inspectId = workspaceInspect?.ownerId
    || (showingAttachments ? attachmentMutateId : activeId);

  const overlayTitle = showingWorkspace
    ? t("doc.library.workspaceTitle")
    : showingDocsIndex
    ? t("doc.library.docsTitle")
    : focusedGroup
      ? t("doc.library.titleWithName", { title: focusedGroup.title })
      : isDocumentRoot
        ? t("doc.library.titleWithName", {
          title: documentRootTitle || "Untitled",
        })
        : t("doc.library.title");

  const showCreate = !showingDocsIndex && !showingWorkspace;
  const createOpensAsset = showingDocumentsTab && !focusedAssetId;
  const showingPromptRow = !showingDocsIndex && !showingWorkspace;
  const gridItems = filteredItems;
  // Always show header [+] next to close (including empty Prompt).
  const showHeaderPlus = showCreate;

  const handleHeaderCreate = () => {
    if (!showingAttachments && !createOpensAsset && !showingDocsIndex && !focusedAssetId) {
      setCreateMediaUrl("");
      openCreate("image", filterTab === "visual" ? "visual" : "prompt");
      return;
    }
    if (focusedAssetId) {
      openCreate("image", "visual");
      return;
    }
    if (createOpensAsset) {
      setAssetModalOpen(true);
      return;
    }
    if (showingAttachments) {
      openCreate("skill");
      return;
    }
    openCreate("image", filterTab === "visual" ? "visual" : "prompt");
  };

  const emptyGridKey = showingAttachments
    ? "doc.library.emptyFilteredSkill"
    : filterTab === "visual"
      ? "doc.library.emptyImagesStart"
      : "doc.library.emptyPromptStart";
  const emptyAttachmentsCopy = showingAttachments && (isDocumentRoot || focusedDocumentId)
    ? t("doc.library.emptyFolderAttachmentsOnDoc")
    : null;

  const renderItemGrid = (list, emptyKey, ownerOverride = null, pickRows = null) => (
    list.length === 0 ? (
      <div className="folder-library-overlay__empty">
        <p>{emptyAttachmentsCopy || (showingAttachments ? t(emptyKey) : t(filterTab === "visual" ? "doc.library.emptyImagesStart" : "doc.library.emptyPromptStart"))}</p>
        <button
          type="button"
          className="folder-library-overlay__empty-add"
          onClick={handleHeaderCreate}
        >
          {showingAttachments
            ? t("doc.library.add")
            : (filterTab === "visual" ? t("doc.library.addImage") : t("doc.library.addPrompt"))}
        </button>
      </div>
    ) : (
      <ul className="folder-library-overlay__grid">
        {list.map((item, index) => {
          const rowOwner = pickRows?.[index]
            ? { ownerKind: pickRows[index].ownerKind, ownerId: pickRows[index].ownerId }
            : ownerOverride;
          return (
          <li
            key={rowOwner
              ? `${rowOwner.ownerKind}:${rowOwner.ownerId}:${item.id}`
              : item.id}
            className="folder-library-overlay__cell"
          >
            <button
              type="button"
              className="folder-library-overlay__cell-main"
              onClick={() => {
                if (rowOwner) setWorkspaceInspect(rowOwner);
                else setWorkspaceInspect(null);
                openItem(item);
              }}
              title={item.tag}
            >
              {renderFichaFace(item, (pickRows || filterTab === "visual") ? "image" : filterTab === "prompt" ? "prompt" : libraryTilePrefer("folder"))}
              <span className="folder-library-overlay__cell-meta">
                <span className="folder-library-overlay__cell-tag">{item.tag}</span>
                {item.frameAspect ? (
                  <span className="folder-library-overlay__cell-frame">{item.frameAspect}</span>
                ) : null}
                {item.promptClass ? (
                  <span className="folder-library-overlay__cell-class">{item.promptClass}</span>
                ) : null}
              </span>
            </button>
            {(item.category === "image"
              || item.category === "video"
              || item.category === "skill"
              || item.category === "pdf") ? (
              <button
                type="button"
                className="folder-library-overlay__cell-edit"
                onClick={(event) => {
                  event.stopPropagation();
                  if (rowOwner) setWorkspaceInspect(rowOwner);
                  else setWorkspaceInspect(null);
                  openEdit(item);
                }}
                aria-label={t("doc.library.edit")}
                title={t("doc.library.edit")}
              >
                {t("doc.library.edit")}
              </button>
            ) : null}
            <button
              type="button"
              className="folder-library-overlay__cell-delete"
              onClick={() => handleDelete(item, rowOwner)}
              aria-label={t("doc.library.delete")}
              title={t("doc.library.delete")}
            >
              ×
            </button>
          </li>
          );
        })}
        {!showingAttachments && !ownerOverride && !pickRows ? (
          <li className="folder-library-overlay__cell folder-library-overlay__cell--add">
            <button
              type="button"
              className="folder-library-overlay__cell-add"
              onClick={handleHeaderCreate}
              aria-label={filterTab === "visual" ? t("doc.library.addImage") : t("doc.library.addPrompt")}
              title={filterTab === "visual" ? t("doc.library.addImage") : t("doc.library.addPrompt")}
            >
              +
            </button>
          </li>
        ) : null}
      </ul>
    )
  );

  return createPortal(
    <>
      <div
        className="folder-library-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={overlayTitle}
      >
        <button
          type="button"
          className="folder-library-overlay__backdrop"
          aria-label={t("doc.library.close")}
          onClick={onClose}
        />
        <div className="folder-library-overlay__shell">
          <header className="folder-library-overlay__header">
            <div className="folder-library-overlay__title-row">
              {focusedDocumentId ? (
                <button
                  type="button"
                  className="folder-library-overlay__back"
                  onClick={() => setFocusedDocumentId(null)}
                >
                  {t("doc.library.backToDocs")}
                </button>
              ) : null}
              <h2 className="folder-library-overlay__title">{overlayTitle}</h2>
            </div>
            <div className="folder-library-overlay__header-actions">
              {showHeaderPlus ? (
                <button
                  type="button"
                  className="folder-library-overlay__add"
                  onClick={handleHeaderCreate}
                  title={t(showingAttachments || createOpensAsset ? "doc.library.add" : "doc.library.newVisualTitle")}
                  aria-label={t(showingAttachments || createOpensAsset ? "doc.library.add" : "doc.library.newVisualTitle")}
                >
                  +
                </button>
              ) : null}
              <input
                ref={pdfAutoUploadInputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={handleAutoPdfUpload}
              />
              <button
                type="button"
                className="folder-library-overlay__close"
                onClick={onClose}
                aria-label={t("doc.library.close")}
              >
                ×
              </button>
            </div>
          </header>

          {showScopeBar ? (
            <div
              className={
                "folder-library-overlay__scope"
                + ` folder-library-overlay__scope--${scopeBarOptions.length}`
              }
              role="tablist"
              aria-label={t("doc.library.scopeAria")}
            >
              {scopeBarOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === option.id}
                  className={
                    "folder-library-overlay__scope-btn"
                    + (scope === option.id ? " is-active" : "")
                  }
                  onClick={() => handleScope(option.id)}
                >
                  <img
                    className="folder-library-overlay__scope-icon"
                    src={option.iconSrc}
                    alt=""
                    aria-hidden
                    draggable={false}
                  />
                  <span>{t(option.labelKey)}</span>
                </button>
              ))}
            </div>
          ) : null}

                    {showingWorkspace ? (
            workspaceImagePicks.length === 0 && workspaceAttachmentPicks.length === 0 ? (
              <div className="folder-library-overlay__empty">
                <p>{t("doc.library.emptyWorkspace")}</p>
              </div>
            ) : (
              <div className="folder-library-overlay__workspace">
                <section className="folder-library-overlay__workspace-section">
                  <h3 className="folder-library-overlay__section-title">
                    {t("doc.library.workspaceAllImages")}
                  </h3>
                  {workspaceImagePicks.length === 0 ? (
                    <p className="folder-library-overlay__section-empty">
                      {t("doc.library.emptyWorkspaceImages")}
                    </p>
                  ) : (
                    renderItemGrid(
                      workspaceImagePicks.map((row) => row.item),
                      "doc.library.emptyWorkspaceImages",
                      null,
                      workspaceImagePicks,
                    )
                  )}
                </section>
                <section className="folder-library-overlay__workspace-section">
                  <h3 className="folder-library-overlay__section-title">
                    {t("doc.library.workspaceAllAttachments")}
                  </h3>
                  {workspaceAttachmentPicks.length === 0 ? (
                    <p className="folder-library-overlay__section-empty">
                      {t("doc.library.emptyWorkspaceAttachments")}
                    </p>
                  ) : (
                    renderItemGrid(
                      workspaceAttachmentPicks.map((row) => row.item),
                      "doc.library.emptyWorkspaceAttachments",
                      null,
                      workspaceAttachmentPicks,
                    )
                  )}
                </section>
              </div>
            )
          ) : showingDocsIndex ? (
            <ul className="folder-library-overlay__grid">
              {docGroups.map((group) => {
                const previews = pickDocLibraryPreviews(group.items, 4);
                return (
                  <li key={group.documentId} className="folder-library-overlay__cell folder-library-overlay__cell--doc">
                    <button
                      type="button"
                      className="folder-library-overlay__cell-main"
                      onClick={() => setFocusedDocumentId(group.documentId)}
                      aria-label={t("doc.library.openDocAria").replace("{title}", group.title)}
                    >
                      <span
                        className={
                          "folder-library-overlay__doc-square"
                          + (previews.length === 0 ? " is-empty" : "")
                        }
                        aria-hidden
                      >
                        {previews.length > 0 ? (
                          previews.map((item) => (
                            <span key={item.id} className={miniFichaClass(item, libraryTilePrefer("document"))}>
                              {renderMiniFichaFace(item, libraryTilePrefer("document"))}
                            </span>
                          ))
                        ) : (
                          <img
                            className="folder-library-overlay__doc-square-icon"
                            src="/uploads/File.svg"
                            alt=""
                            draggable={false}
                          />
                        )}
                      </span>
                      <span className="folder-library-overlay__cell-meta">
                        <span className="folder-library-overlay__cell-tag">{group.title}</span>
                        <span className="folder-library-overlay__cell-class">
                          {t("doc.library.subfolderCount").replace("{count}", String(group.items.length))}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              {showingPromptRow ? (
                <div
                  className="folder-library-overlay__prompt-row"
                  role="tablist"
                  aria-label={t("doc.library.filterAria")}
                >
                  {showingDocumentGrid ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={filterTab === "documents"}
                      className={
                        "folder-library-overlay__tab folder-library-overlay__tab--with-icon"
                        + (filterTab === "documents" ? " is-active" : "")
                      }
                      onClick={() => setFilter("documents")}
                    >
                      <img
                        className="folder-library-overlay__tab-icon"
                        src="/uploads/TreeStructure.svg"
                        alt=""
                        aria-hidden
                        draggable={false}
                      />
                      <span>{t("doc.library.tabDocuments")}</span>
                    </button>
                  ) : null}
                  {canUseAttachments ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={filterTab === "skill"}
                      className={
                        "folder-library-overlay__tab folder-library-overlay__tab--with-icon"
                        + (filterTab === "skill" ? " is-active" : "")
                      }
                      onClick={() => setFilter("skill")}
                      title={
                        hasFolderAttachments
                          ? t("doc.library.attachmentsWithFilesTitle").replace(
                            "{count}",
                            String(folderAttachmentCount),
                          )
                          : t("doc.library.attachmentsAria")
                      }
                    >
                      <img
                        className="folder-library-overlay__tab-icon"
                        src="/uploads/attachment.svg"
                        alt=""
                        aria-hidden
                        draggable={false}
                      />
                      <span>{t("doc.library.tabSkills")}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterTab === "visual"}
                    className={
                      "folder-library-overlay__prompt-label"
                      + (filterTab === "visual" ? " is-active" : "")
                    }
                    onClick={() => setFilter("visual")}
                  >
                    <img
                      className="folder-library-overlay__tab-icon"
                      src="/uploads/Palette.svg"
                      alt=""
                      aria-hidden
                      draggable={false}
                    />
                    <span>{t("doc.library.tabImageCards")}</span>
                  </button>
                  {showingAttachments && canImportPdfToWriting ? (
                    <span
                      className="folder-library-overlay__pdf-to-text-wrap"
                      title={pdfToTextTitle}
                    >
                      <button
                        type="button"
                        className={
                          "folder-library-overlay__pdf-to-text"
                          + (pdfToTextBusy ? " is-loading" : "")
                          + (pdfToTextError ? " is-error" : "")
                          + (pdfPickerOpen ? " is-open" : "")
                        }
                        onClick={handlePdfToText}
                        disabled={!pdfToTextEnabled}
                        aria-busy={pdfToTextBusy}
                        aria-expanded={pdfPickerOpen}
                        aria-haspopup="dialog"
                        aria-label={t("doc.library.pdfToText")}
                      >
                        {pdfToTextBusy
                          ? t("doc.library.pdfToTextLoading")
                          : t("doc.library.pdfToText")}
                      </button>
                      {pdfPickerOpen ? (
                        <div
                          className="folder-library-overlay__pdf-picker"
                          role="dialog"
                          aria-label={t("doc.library.pdfToTextPickerTitle")}
                        >
                          <div className="folder-library-overlay__pdf-picker-head">
                            <span className="folder-library-overlay__pdf-picker-title">
                              {t("doc.library.pdfToTextPickerTitle")}
                            </span>
                            <button
                              type="button"
                              className="folder-library-overlay__pdf-picker-close"
                              onClick={() => setPdfPickerOpen(false)}
                              aria-label={t("doc.library.close")}
                            >
                              ×
                            </button>
                          </div>
                          <button
                            type="button"
                            className="folder-library-overlay__pdf-picker-upload"
                            disabled={pdfToTextBusy}
                            onClick={openLocalPdfUpload}
                          >
                            {t("doc.library.pdfToTextUpload")}
                          </button>
                        </div>
                      ) : null}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterTab === "prompt"}
                    className={
                      "folder-library-overlay__prompt-label"
                      + (filterTab === "prompt" ? " is-active" : "")
                    }
                    onClick={() => setFilter("prompt")}
                  >
                    <img
                      className="folder-library-overlay__tab-icon"
                      src="/uploads/CursorText.svg"
                      alt=""
                      aria-hidden
                      draggable={false}
                    />
                    <span>{t("doc.library.tabImages")}</span>
                  </button>
                  {filterTab === "prompt" ? (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!promptClassFilter}
                        className={
                          "folder-library-overlay__prompt-class"
                          + (!promptClassFilter ? " is-active" : "")
                        }
                        onClick={() => setPromptClassFilter("")}
                      >
                        {t("doc.library.tabAll")}
                      </button>
                      {promptClasses.map((name) => (
                        editingClass.toLowerCase() === name.toLowerCase() ? (
                          <input
                            key={name}
                            ref={classEditRef}
                            className="folder-library-overlay__prompt-class-input"
                            value={classEditDraft}
                            placeholder={t("doc.library.promptClassPlaceholder")}
                            aria-label={t("doc.library.promptClassPlaceholder")}
                            onChange={(event) => setClassEditDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitClassEdit();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelClassEdit();
                              }
                            }}
                            onBlur={commitClassEdit}
                          />
                        ) : (
                          <span key={name} className="folder-library-overlay__prompt-class-wrap">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={promptClassFilter.toLowerCase() === name.toLowerCase()}
                              className={
                                "folder-library-overlay__prompt-class"
                                + (promptClassFilter.toLowerCase() === name.toLowerCase() ? " is-active" : "")
                              }
                              onClick={() => {
                                setClassDraftOpen(false);
                                setClassDraft("");
                                setPromptClassFilter(name);
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                startClassEdit(name);
                              }}
                            >
                              {name}
                            </button>
                            <button
                              type="button"
                              className="folder-library-overlay__prompt-class-delete"
                              aria-label={t("doc.library.promptClassDeleteAria", { name })}
                              title={t("doc.library.promptClassDeleteAria", { name })}
                              onClick={(event) => handleDeleteClass(name, event)}
                            >
                              ×
                            </button>
                          </span>
                        )
                      ))}
                      {classDraftOpen ? (
                        <input
                          ref={classDraftRef}
                          className="folder-library-overlay__prompt-class-input"
                          value={classDraft}
                          placeholder={t("doc.library.promptClassPlaceholder")}
                          aria-label={t("doc.library.promptClassPlaceholder")}
                          onChange={(event) => setClassDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitClassDraft();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setClassDraftOpen(false);
                              setClassDraft("");
                            }
                          }}
                          onBlur={() => {
                            if (!classDraft.trim()) {
                              setClassDraftOpen(false);
                              return;
                            }
                            commitClassDraft();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="folder-library-overlay__prompt-class-add"
                          onClick={() => {
                            cancelClassEdit();
                            setClassDraftOpen(true);
                          }}
                          aria-label={t("doc.library.promptClassAdd")}
                          title={t("doc.library.promptClassAdd")}
                        >
                          +
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              ) : null}

              {showingDocumentsTab ? (
                assets.length === 0 ? (
                  <div className="folder-library-overlay__empty">
                    <p>{t("doc.library.assetEmpty")}</p>
                    <button
                      type="button"
                      className="folder-library-overlay__empty-add"
                      onClick={() => setAssetModalOpen(true)}
                    >
                      {t("doc.library.add")}
                    </button>
                  </div>
                ) : (
                  <ul className="folder-library-overlay__subfolders">
                    {assets.map((asset) => {
                      const previews = items
                        .filter((item) => item.setId === asset.id)
                        .slice(0, 4);
                      return (
                      <li key={asset.id} className="folder-library-overlay__subfolder-wrap">
                        <button
                          type="button"
                          className="folder-library-overlay__subfolder"
                          onClick={() => setFocusedAssetId(asset.id)}
                          aria-label={t("doc.library.assetOpenAria").replace("{title}", asset.tag)}
                        >
                          <img
                            className="folder-library-overlay__subfolder-icon"
                            src="/uploads/Folders.svg"
                            alt=""
                            aria-hidden
                            draggable={false}
                          />
                          <span className="folder-library-overlay__subfolder-meta">
                            <span className="folder-library-overlay__subfolder-title">{asset.tag}</span>
                            <span className="folder-library-overlay__subfolder-count">
                              {t("doc.library.assetCount").replace(
                                "{count}",
                                String(assetCounts[asset.id] || 0),
                              )}
                            </span>
                          </span>
                          {previews.length > 0 ? (
                            <span className="folder-library-overlay__subfolder-previews" aria-hidden>
                              {previews.map((item) => (
                                <span key={item.id} className={miniFichaClass(item, libraryTilePrefer("folder"))}>
                                  {renderMiniFichaFace(item, libraryTilePrefer("folder"))}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="folder-library-overlay__subfolder-delete"
                          aria-label={t("common.delete")}
                          onClick={(event) => handleDeleteAsset(asset, event)}
                        >
                          ×
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                renderItemGrid(gridItems, emptyGridKey)
              )}
            </>
          )}
        </div>
      </div>

      {focusedAsset ? (
        <FolderLibraryAssetDetail
          ownerKind={inspectKind}
          ownerId={inspectId}
          folderLibraryId={folderLibraryId || (isDocumentRoot ? "" : rootId)}
          assetId={focusedAsset.id}
          escapeEnabled={!modalOpen && !assetModalOpen && !detailItemId}
          onClose={() => setFocusedAssetId(null)}
          onEdit={(asset) => {
            setEditingAsset(asset);
            setAssetModalOpen(true);
          }}
          onOpenItem={(item) => openItem(item)}
        />
      ) : null}

      {detailItemId && detailKind === "image" && !modalOpen ? (
        <FolderLibraryImageDetail
          ownerKind={inspectKind}
          ownerId={inspectId}
          folderId={inspectId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen && !assetModalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={openEditFromDetail}
        />
      ) : null}

      {detailItemId && detailKind === "video" && !modalOpen ? (
        <FolderLibraryVideoDetail
          ownerKind={inspectKind}
          ownerId={inspectId}
          folderId={inspectId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen && !assetModalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={openEditFromDetail}
        />
      ) : null}

      {detailItemId && detailKind === "skill" && !modalOpen ? (
        <FolderLibrarySkillDetail
          ownerKind={attachmentMutateKind}
          ownerId={attachmentMutateId}
          folderId={attachmentMutateId}
          itemId={detailItemId}
          escapeEnabled={!modalOpen && !assetModalOpen}
          onClose={() => {
            setDetailItemId(null);
            setDetailKind(null);
          }}
          onEdit={openEditFromDetail}
        />
      ) : null}

      {modalOpen ? (
        <FolderLibraryElementModal
          ownerKind={inspectKind}
          ownerId={inspectId}
          folderId={inspectId}
          item={editingItem}
          defaultCategory={editingItem ? undefined : createCategory}
          lockCategory={lockCategory && !editingItem}
          defaultPromptClass={editingItem ? undefined : promptClassFilter}
          promptClasses={promptClasses}
          initialMediaUrl={editingItem ? "" : createMediaUrl}
          defaultPresentation={editingItem ? undefined : createPresentation}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
            setCreateMediaUrl("");
            setCreatePresentation("prompt");
            setLockCategory(false);
          }}
          onSaved={(saved) => {
            if (focusedAssetId && saved?.id && !showingAttachments) {
              assignLibraryItemToSet(activeKind, activeId, saved.id, focusedAssetId);
            }
            setModalOpen(false);
            setEditingItem(null);
            setCreateMediaUrl("");
            setCreatePresentation("prompt");
            setLockCategory(false);
          }}
        />
      ) : null}

      {assetModalOpen ? (
        <LibrarySetInputModal
          ownerId={activeId}
          editingSet={editingAsset}
          onClose={() => {
            setAssetModalOpen(false);
            setEditingAsset(null);
          }}
          onSaved={(saved) => {
            const wasEdit = Boolean(editingAsset);
            setAssetModalOpen(false);
            setEditingAsset(null);
            if (!saved?.id) return;
            if (!wasEdit) {
              setFilterTab("documents");
              writeStoredFilter(filterKey, "documents");
            }
            setFocusedAssetId(saved.id);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
