import { useState, useEffect, useRef, useCallback } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { getPlanLimits } from "../../lib/planConfig.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { normalizeKnowledgeImport } from "../../lib/knowledgeImport.js";
import { useI18n } from "../../i18n/useI18n.js";
import { Modal } from "../shared/Modal.jsx";
import { UnsavedChangesConfirm } from "../shared/UnsavedChangesConfirm.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";
import { NodeQueryModal } from "../nodes/NodeQueryModal.jsx";
import {
  dateInputFromIso,
  isoFromDateInput,
  launchDateInputFromIso,
} from "../../lib/docDates.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import {
  isTemplateDoc,
  isProductDoc,
  findProductVersionDoc,
  formatProductDocTitle,
  listProductVersionOptions,
  resolveDocAfterVersionDelete,
  buildProductDeleteConfirmMessage,
  resolveDocKind,
  DOC_KIND_PRODUCT,
  DOC_KIND_CONTENT,
  DOC_KIND_KNOWLEDGE,
} from "../../lib/templateDoc.js";
import { DocDocumentBox } from "./DocDocumentBox.jsx";
import {
  docBlocksFromBody,
  docBlocksHaveContent,
  docBlocksToBody,
  normalizeDocBlocks,
  updateBlockAt,
  DOC_BLOCK_TYPES,
} from "../../lib/docBlocks.js";
import { docBlocksHaveAgentInstruction } from "../../lib/resolveAgentInstruction.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  anchorFieldsFromIso,
  blockDataType,
  ensureNodeForDocBlock,
  getAnswerBelowH1,
  getBlockQueryText,
  getContentForNodeBlock,
  resolveBlockAnchorFields,
  resolveNodeDraftFromDoc,
  setAnswerBelowH1,
  setContentForNodeBlock,
  syncVideoNodeFromH1Blocks,
  syncVideoNodeFromVideoBlock,
  unlinkNodeFromDocBlocks,
  getOwnedTextBlockIndices,
  isDocBlockLinkedToNode,
  shouldMirrorNodeContentInDoc,
} from "../../lib/docNodeSync.js";
import {
  buildDetachedWidgetEmbedded,
  captureDocBlockWidgetSnapshot,
  isEmbeddableWidgetBlock,
} from "../../lib/captureWidgetSnapshot.js";
import { parseCalendarEventNodeContent } from "../../lib/eventCalendarSearch.js";
import { isNoNodeLinkMode, resolveBlockNodeLinkColor } from "../../lib/docNodeLinkColors.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";

/** @param {object[]|null|undefined} blocks */
function docBlocksHaveText(blocks) {
  if (!Array.isArray(blocks)) return false;
  if (docBlocksHaveAgentInstruction(blocks)) return true;
  return docBlocksHaveContent(blocks);
}

function docDraftHasContent(cached) {
  if (!cached) return false;
  if (docBlocksHaveText(cached.blocks)) return true;
  if (Boolean(String(cached.body ?? "").trim())) return true;
  // Keep Launch/schedule drafts across remount even when body is empty.
  if (Boolean(String(cached.launchDate ?? "").trim())) return true;
  return false;
}

function isEmptyDocState(title, blocks, body) {
  return (
    !(title || "").trim()
    && !docBlocksHaveText(blocks)
    && !(body || "").trim()
  );
}

function NodeFromSelectionModal({ query, onClose, onSave }) {
  return (
    <Modal onClose={onClose} title="NEW NOTE">
      <p className="query-line">query: {query}</p>
      <NodeForm
        initialData={{ title: query, dataType: "text", content: "" }}
        onSubmit={onSave}
        onCancel={onClose}
      />
    </Modal>
  );
}

const UNTITLED_DOC_LABEL = "Untitled document";

function resolvePersistTitle({
  draftTitle,
  draftCategory,
  draftVersion,
  draftDocKind,
  draftSubcategoryDocIds,
}) {
  const kind = resolveDocKind({
    docKind: draftDocKind,
    category: draftCategory,
    subcategoryDocIds: draftSubcategoryDocIds,
  });
  if (kind === DOC_KIND_PRODUCT) {
    return formatProductDocTitle(draftCategory, draftVersion)
      || draftCategory.trim()
      || draftTitle.trim()
      || "";
  }
  // Content docs are file-boxes grouped by category — title and category stay in sync.
  if (kind === DOC_KIND_CONTENT) {
    return draftTitle.trim() || draftCategory.trim() || "";
  }
  return draftTitle ?? "";
}

function buildDocEditorDraft({
  title,
  body,
  blocks,
  createdDate,
  version,
  category,
  launchDate,
  campaignActive,
  nodeLinkColor,
  parentId,
  docKind,
  templateKind,
  subcategoryDocIds,
  knowledgeImport,
}) {
  return {
    title: title ?? "",
    body: body ?? "",
    blocks: normalizeDocBlocks(blocks),
    createdDate: createdDate ?? "",
    version: version ?? "",
    category: category ?? "",
    launchDate: launchDate ?? "",
    campaignActive: Boolean(campaignActive),
    nodeLinkColor: nodeLinkColor ?? "dark",
    parentId: parentId ?? "",
    docKind: docKind ?? "standard",
    templateKind: templateKind ?? null,
    subcategoryDocIds: Array.isArray(subcategoryDocIds) ? subcategoryDocIds : [],
    knowledgeImport: knowledgeImport ?? null,
  };
}

function buildDocPersistSnapshot({
  title,
  blocks,
  body = "",
  createdDate,
  version = "",
  category = "",
  launchAt = null,
  campaignActive = false,
  parentObjectId = "",
  nodeLinkColor = "dark",
  docKind = "standard",
  templateKind = null,
  subcategoryDocIds = [],
  knowledgeImport = null,
}) {
  const normalizedBlocks = normalizeDocBlocks(blocks);
  const serializedBody = docBlocksToBody(normalizedBlocks) || body || "";
  const ids = Array.isArray(subcategoryDocIds) ? subcategoryDocIds : [];
  return {
    title: title ?? "",
    blocks: normalizedBlocks,
    body: serializedBody,
    createdAt: isoFromDateInput(createdDate),
    version: String(version ?? "").trim(),
    category: String(category ?? "").trim(),
    launchAt: launchAt ?? null,
    campaignActive: Boolean(campaignActive),
    parentObjectId: parentObjectId || "",
    nodeLinkColor: nodeLinkColor ?? "dark",
    docKind: docKind ?? "standard",
    templateKind: templateKind ?? null,
    subcategoryDocIds: ids,
    templateSubcategoryDocIds: ids,
    knowledgeImport: knowledgeImport ?? null,
  };
}

export function DocExpandedView({
  docId,
  onClose,
  onInsertToCanvas,
  onExpandNode,
  onNavigateToDoc,
  onDocumentDeleted,
  onAfterDocSave,
  onStepPlaybookRemoved,
  initialFocusBlockId = null,
  registerCloseInterceptor = null,
}) {
  const { t } = useI18n();
  const doc = useDocsStore((s) => s.docs[docId]);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const addDoc = useDocsStore((s) => s.addDoc);
  const linkDocToObject = useDocsStore((s) => s.linkDocToObject);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const addNodeFromDoc = useNodesStore((s) => s.addNodeFromDoc);
  const addNode = useNodesStore((s) => s.addNode);
  const getNode = useNodesStore((s) => s.getNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const updateNode = useNodesStore((s) => s.updateNode);
  const deleteNode = useNodesStore((s) => s.deleteNode);
  const deleteNodeEntity = useNodesStore((s) => s.deleteNodeEntity);

  const [selectionModal, setSelectionModal] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const [draftCreatedDate, setDraftCreatedDate] = useState("");
  const [draftVersion, setDraftVersion] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftLaunchDate, setDraftLaunchDate] = useState("");
  const [draftCampaignActive, setDraftCampaignActive] = useState(false);
  const [draftNodeLinkColor, setDraftNodeLinkColor] = useState("dark");
  const [draftParentId, setDraftParentId] = useState("");
  const [draftDocKind, setDraftDocKind] = useState("standard");
  const [draftTemplateKind, setDraftTemplateKind] = useState(null);
  const [draftSubcategoryDocIds, setDraftSubcategoryDocIds] = useState([]);
  const [draftKnowledgeImport, setDraftKnowledgeImport] = useState(null);
  const [activeNodeContext, setActiveNodeContext] = useState(null);
  const [nodeDraftContent, setNodeDraftContent] = useState("");
  const [nodeDraftAnchorDate, setNodeDraftAnchorDate] = useState("");
  const [nodeDraftAnchorTime, setNodeDraftAnchorTime] = useState("");
  const [nodeDraftCompleted, setNodeDraftCompleted] = useState(false);
  const [nodeDraftSourceId, setNodeDraftSourceId] = useState(null);
  const [nodeInitialSnapshot, setNodeInitialSnapshot] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingNavigateDocId, setPendingNavigateDocId] = useState(null);
  const [showNodeUnsavedConfirm, setShowNodeUnsavedConfirm] = useState(false);
  const nodeAutosaveTimerRef = useRef(null);
  const nodeInitialSnapshotRef = useRef(null);
  const docShellRef = useRef(null);
  const docSnapshotRef = useRef(null);
  const pendingCloseActionRef = useRef(null);
  const hideDocForNodeModal = Boolean(activeNodeContext && !showNodeUnsavedConfirm);
  const objects = useObjectsStore((s) => s.objects);
  const allDocs = useDocsStore((s) => s.docs);
  const planProfile = usePlanStore((s) => s.profile);
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);

  useEffect(() => {
    const globalOverlay = docShellRef.current?.closest(".doc-overlay-global");
    if (!globalOverlay) return undefined;
    globalOverlay.classList.toggle("doc-overlay-global--node-active", hideDocForNodeModal);
    return () => globalOverlay.classList.remove("doc-overlay-global--node-active");
  }, [hideDocForNodeModal]);

  useEffect(() => {
    setIsDraftReady(false);
    const d = useDocsStore.getState().docs[docId];
    if (!d) return;
    const cached = useUIStateStore.getState().docEditorDrafts[docId];
    const loadedBlocks = normalizeDocBlocks(
      d.blocks?.length ? d.blocks : docBlocksFromBody(d.body ?? d.content ?? ""),
    );
    const normalized = normalizeDoc(d);
    const savedTitle = isProductDoc(normalized)
      ? (normalized.category?.trim() || normalized.title?.trim() || "")
      : (d.title ?? "");
    const loadedHasText = docBlocksHaveText(loadedBlocks);
    const cachedBlocks = cached?.blocks?.length ? normalizeDocBlocks(cached.blocks) : [];
    const cachedHasText = docDraftHasContent(cached);
    const preferStoreContent = Boolean(
      normalized.reportPresentation?.animateOnOpen
      || (normalized.reportPresentation?.kind === "analyst-strategic-v2" && loadedHasText),
    );
    const useCachedDraft = cached && !preferStoreContent && cachedHasText;

    const blocksForSnapshot = useCachedDraft ? cachedBlocks : loadedBlocks;
    const loadedTitle = useCachedDraft ? (cached.title ?? savedTitle) : savedTitle;
    const loadedBody = useCachedDraft
      ? (cached.body ?? (loadedBlocks.length ? "" : (d.body ?? d.content ?? "")))
      : (loadedBlocks.length ? "" : (d.body ?? d.content ?? ""));
    const loadedCreatedDate = useCachedDraft
      ? (cached.createdDate ?? dateInputFromIso(normalized.createdAt))
      : dateInputFromIso(normalized.createdAt);
    const loadedVersion = useCachedDraft
      ? (cached.version ?? normalized.version ?? "")
      : (normalized.version ?? "");
    const loadedCategory = useCachedDraft
      ? (cached.category ?? normalized.category ?? "")
      : (normalized.category ?? "");
    const loadedLaunchDate = useCachedDraft
      ? (cached.launchDate ?? launchDateInputFromIso(normalized.launchAt))
      : launchDateInputFromIso(normalized.launchAt);
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'pre-fix',hypothesisId:'H4',location:'DocExpandedView.jsx:loadDraft',message:'doc draft load launch/created',data:{docId,useCachedDraft,cachedHasText,loadedLaunchDate,storeLaunchAt:normalized.launchAt??null,loadedCreatedDate,storeCreatedAt:normalized.createdAt??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const loadedCampaignActive = useCachedDraft
      ? (cached.campaignActive ?? Boolean(normalized.campaignActive))
      : Boolean(normalized.campaignActive);
    const loadedNodeLinkColor = useCachedDraft
      ? (cached.nodeLinkColor ?? normalized.nodeLinkColor ?? "dark")
      : (normalized.nodeLinkColor ?? "dark");
    const loadedParentId = useCachedDraft
      ? (cached.parentId ?? d.parentObjectId ?? "")
      : (d.parentObjectId ?? "");
    const loadedDocKind = useCachedDraft
      ? (cached.docKind ?? normalized.docKind ?? "standard")
      : (normalized.docKind ?? "standard");
    const loadedTemplateKind = useCachedDraft
      ? (cached.templateKind ?? normalized.templateKind ?? null)
      : (normalized.templateKind ?? null);
    const loadedSubcategoryDocIds = useCachedDraft
      ? (cached.subcategoryDocIds ?? normalized.subcategoryDocIds ?? [])
      : (normalized.subcategoryDocIds ?? []);
    const loadedKnowledgeImport = useCachedDraft
      ? (cached.knowledgeImport ?? normalized.knowledgeImport ?? null)
      : (normalized.knowledgeImport ?? null);

    if (useCachedDraft) {
      setDraftTitle(loadedTitle);
      setDraftBlocks(cachedBlocks);
      setDraftBody(loadedBody);
      setDraftCreatedDate(loadedCreatedDate);
      setDraftVersion(loadedVersion);
      setDraftCategory(loadedCategory);
      setDraftLaunchDate(loadedLaunchDate);
      setDraftCampaignActive(loadedCampaignActive);
      setDraftNodeLinkColor(loadedNodeLinkColor);
      setDraftParentId(loadedParentId);
      setDraftDocKind(loadedDocKind);
      setDraftTemplateKind(loadedTemplateKind);
      setDraftSubcategoryDocIds(loadedSubcategoryDocIds);
      setDraftKnowledgeImport(loadedKnowledgeImport);
    } else {
      setDraftTitle(loadedTitle);
      setDraftBlocks(loadedBlocks);
      setDraftBody(loadedBody);
      setDraftCreatedDate(loadedCreatedDate);
      setDraftVersion(loadedVersion);
      setDraftCategory(loadedCategory);
      setDraftLaunchDate(loadedLaunchDate);
      setDraftCampaignActive(loadedCampaignActive);
      setDraftNodeLinkColor(loadedNodeLinkColor);
      setDraftParentId(loadedParentId);
      setDraftDocKind(loadedDocKind);
      setDraftTemplateKind(loadedTemplateKind);
      setDraftSubcategoryDocIds(loadedSubcategoryDocIds);
      setDraftKnowledgeImport(loadedKnowledgeImport);
    }

    const openSnapshot = buildDocPersistSnapshot({
      title: resolvePersistTitle({
        draftTitle: loadedTitle,
        draftCategory: loadedCategory,
        draftVersion: loadedVersion,
        draftDocKind: loadedDocKind,
        draftSubcategoryDocIds: loadedSubcategoryDocIds,
      }),
      blocks: blocksForSnapshot,
      body: loadedBody,
      createdDate: loadedCreatedDate,
      version: loadedVersion,
      category: loadedCategory,
      launchAt: loadedLaunchDate ? isoFromDateInput(loadedLaunchDate) : null,
      campaignActive: loadedCampaignActive,
      parentObjectId: loadedParentId,
      nodeLinkColor: loadedNodeLinkColor,
      docKind: loadedDocKind,
      templateKind: loadedTemplateKind,
      subcategoryDocIds: loadedSubcategoryDocIds,
      knowledgeImport: loadedKnowledgeImport,
    });
    setInitialSnapshot(openSnapshot);
    docSnapshotRef.current = JSON.stringify(openSnapshot);
    setShowUnsavedConfirm(false);
    setIsDraftReady(true);
  }, [docId]);

  useEffect(() => {
    if (!doc || !isDraftReady) return;

    const storeBlocks = normalizeDocBlocks(
      doc.blocks?.length ? doc.blocks : docBlocksFromBody(doc.body ?? doc.content ?? ""),
    );
    const storeHasText = docBlocksHaveText(storeBlocks);
    const draftHasText = docBlocksHaveText(draftBlocks);
    const isAgentReport = doc.reportPresentation?.kind === "analyst-strategic-v2";

    if (storeHasText && !draftHasText && (doc.reportPresentation?.animateOnOpen || isAgentReport)) {
      setDraftBlocks(storeBlocks);
      setInitialSnapshot((prev) => {
        if (!prev) return prev;
        const next = { ...prev, blocks: storeBlocks };
        docSnapshotRef.current = JSON.stringify(next);
        return next;
      });
      return;
    }

    if (!initialSnapshot) return;

    const blocksDirty = JSON.stringify(initialSnapshot.blocks) !== JSON.stringify(draftBlocks);
    const bodyDirty = (initialSnapshot.body ?? "") !== (draftBody ?? "");
    if (blocksDirty || bodyDirty) return;

    if (JSON.stringify(draftBlocks) === JSON.stringify(storeBlocks)) return;

    setDraftBlocks(storeBlocks);
    setInitialSnapshot((prev) => {
      if (!prev) return prev;
      const next = { ...prev, blocks: storeBlocks };
      docSnapshotRef.current = JSON.stringify(next);
      return next;
    });
  }, [doc, doc?.reportPresentation?.animateOnOpen, isDraftReady, initialSnapshot, draftBlocks, draftBody]);

  useEffect(() => {
    if (!docId || !isDraftReady) return undefined;
    const persistDraft = () => {
      const storeDoc = useDocsStore.getState().docs[docId];
      const storeBlocks = normalizeDocBlocks(
        storeDoc?.blocks?.length
          ? storeDoc.blocks
          : docBlocksFromBody(storeDoc?.body ?? storeDoc?.content ?? ""),
      );
      const draftHasText = docBlocksHaveText(draftBlocks);
      const storeHasText = docBlocksHaveText(storeBlocks);
      if (
        storeDoc?.reportPresentation?.kind === "analyst-strategic-v2"
        && storeHasText
        && !draftHasText
      ) {
        return;
      }

      useUIStateStore.getState().setDocEditorDraft(
        docId,
        buildDocEditorDraft({
          title: draftTitle,
          body: draftBody,
          blocks: draftBlocks,
          createdDate: draftCreatedDate,
          version: draftVersion,
          category: draftCategory,
          launchDate: draftLaunchDate,
          campaignActive: draftCampaignActive,
          nodeLinkColor: draftNodeLinkColor,
          parentId: draftParentId,
          docKind: draftDocKind,
          templateKind: draftTemplateKind,
          subcategoryDocIds: draftSubcategoryDocIds,
          knowledgeImport: draftKnowledgeImport,
        }),
      );
    };
    persistDraft();
    return persistDraft;
  }, [
    docId,
    isDraftReady,
    draftTitle,
    draftBody,
    draftBlocks,
    draftCreatedDate,
    draftVersion,
    draftCategory,
    draftLaunchDate,
    draftCampaignActive,
    draftNodeLinkColor,
    draftParentId,
    draftDocKind,
    draftTemplateKind,
    draftSubcategoryDocIds,
    draftKnowledgeImport,
  ]);

  useEffect(() => {
    if (!docId) return undefined;
    const launchAt = draftLaunchDate ? isoFromDateInput(draftLaunchDate) : null;
    useUIStateStore.getState().setActiveDocMetaDraft({
      docId,
      version: draftVersion,
      category: draftCategory,
      launchAt,
      campaignActive: draftCampaignActive,
      subcategoryDocIds: draftSubcategoryDocIds,
      parentObjectId: draftParentId || "",
    });
    return () => useUIStateStore.getState().clearActiveDocMetaDraft();
  }, [
    docId,
    draftVersion,
    draftCategory,
    draftLaunchDate,
    draftCampaignActive,
    draftSubcategoryDocIds,
    draftParentId,
  ]);

  const draftLaunchAt = draftLaunchDate ? isoFromDateInput(draftLaunchDate) : null;

  const hasUnsavedDocChanges = useCallback(() => {
    const snap = docSnapshotRef.current;
    if (!snap) return false;
    const nextSnapshot = buildDocPersistSnapshot({
      title: resolvePersistTitle({
        draftTitle,
        draftCategory,
        draftVersion,
        draftDocKind,
        draftSubcategoryDocIds,
      }),
      blocks: draftBlocks,
      body: draftBody,
      createdDate: draftCreatedDate,
      version: draftVersion,
      category: draftCategory,
      launchAt: draftLaunchAt,
      campaignActive: draftCampaignActive,
      parentObjectId: draftParentId,
      nodeLinkColor: draftNodeLinkColor,
      docKind: draftDocKind,
      templateKind: draftTemplateKind,
      subcategoryDocIds: draftSubcategoryDocIds,
      knowledgeImport: draftKnowledgeImport,
    });
    return snap !== JSON.stringify(nextSnapshot);
  }, [
    draftTitle,
    draftBlocks,
    draftBody,
    draftCreatedDate,
    draftVersion,
    draftCategory,
    draftLaunchAt,
    draftCampaignActive,
    draftParentId,
    draftNodeLinkColor,
    draftDocKind,
    draftTemplateKind,
    draftSubcategoryDocIds,
    draftKnowledgeImport,
  ]);

  const hasUnsavedChanges = hasUnsavedDocChanges();

  const shouldDiscardEmptyDoc = () => {
    if (!initialSnapshot) return false;
    if (hasUnsavedChanges) return false;
    const currentDoc = useDocsStore.getState().docs[docId];
    if (currentDoc?.nodeIds?.length) return false;
    const openedEmpty = isEmptyDocState(
      initialSnapshot.title,
      initialSnapshot.blocks,
      initialSnapshot.body,
    );
    const stillEmpty = isEmptyDocState(draftTitle, draftBlocks, draftBody);
    return openedEmpty && stillEmpty;
  };

  const discardEmptyDocOnClose = () => {
    if (!shouldDiscardEmptyDoc()) return false;
    onDocumentDeleted?.(docId);
    useUIStateStore.getState().clearDocEditorDraft(docId);
    deleteDoc(docId);
    onClose();
    return true;
  };

  const requestCloseDoc = useCallback((onProceed = null) => {
    setPendingNavigateDocId(null);
    pendingCloseActionRef.current = onProceed;
    if (hasUnsavedDocChanges()) {
      setShowUnsavedConfirm(true);
      return;
    }
    if (discardEmptyDocOnClose()) {
      pendingCloseActionRef.current = null;
      onProceed?.();
      return;
    }
    pendingCloseActionRef.current = null;
    onClose();
    onProceed?.();
  }, [hasUnsavedDocChanges, onClose, onDocumentDeleted, docId, deleteDoc]);

  useEffect(() => {
    if (!registerCloseInterceptor) return undefined;
    registerCloseInterceptor((onProceed) => requestCloseDoc(onProceed));
    return () => registerCloseInterceptor(null);
  }, [registerCloseInterceptor, requestCloseDoc]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (activeNodeContext || showUnsavedConfirm || showNodeUnsavedConfirm) return;
      e.preventDefault();
      requestCloseDoc();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeNodeContext, showUnsavedConfirm, showNodeUnsavedConfirm, requestCloseDoc]);

  if (!doc) return null;

  const objectList = Object.values(objects);
  const parentObject = draftParentId ? objects[draftParentId] : null;
  const headerLabel = parentObject?.name || "";
  const parentDocLabel = draftTitle.trim() || UNTITLED_DOC_LABEL;
  const draftSnapshot = buildDocPersistSnapshot({
    title: resolvePersistTitle({
      draftTitle,
      draftCategory,
      draftVersion,
      draftDocKind,
      draftSubcategoryDocIds,
    }),
    blocks: draftBlocks,
    body: draftBody,
    createdDate: draftCreatedDate,
    version: draftVersion,
    category: draftCategory,
    launchAt: draftLaunchAt,
    campaignActive: draftCampaignActive,
    parentObjectId: draftParentId,
    nodeLinkColor: draftNodeLinkColor,
    docKind: draftDocKind,
    templateKind: draftTemplateKind,
    subcategoryDocIds: draftSubcategoryDocIds,
    knowledgeImport: draftKnowledgeImport,
  });
  const isTemplate = isTemplateDoc({ docKind: draftDocKind });
  const resolvedKind = resolveDocKind({
    docKind: draftDocKind,
    category: draftCategory,
    subcategoryDocIds: draftSubcategoryDocIds,
  });
  const metaMode = resolvedKind === DOC_KIND_PRODUCT
    ? "product"
    : resolvedKind === DOC_KIND_KNOWLEDGE
      ? "knowledge"
      : resolvedKind === DOC_KIND_CONTENT
        ? "content"
        : "campaign";
  const isProductMode = metaMode === "product";
  const isKnowledgeMode = metaMode === "knowledge";
  const isContentMode = metaMode === "content";
  /** Products + Content: title and category mirror each other (file-box grouping). */
  const syncTitleWithCategory = isProductMode || isContentMode;

  const handleDeleteDoc = () => {
    const category = draftCategory.trim();
    const version = draftVersion.trim();
    const versionInstanceCount = category
      ? listProductVersionOptions(allDocs, draftParentId, category).length
      : 0;
    const confirmMsg = buildProductDeleteConfirmMessage({
      title: draftTitle.trim() || doc.title,
      category,
      version,
      versionInstanceCount,
    });

    if (!window.confirm(confirmMsg)) {
      return;
    }

    const nextDocId = version && category
      ? resolveDocAfterVersionDelete(allDocs, docId, draftParentId, category)
      : null;

    if (activeNodeContext) {
      setActiveNodeContext(null);
      setNodeDraftContent("");
    }
    onDocumentDeleted?.(docId);
    useUIStateStore.getState().clearDocEditorDraft(docId);
    deleteDoc(docId);

    if (nextDocId) {
      onNavigateToDoc?.(nextDocId);
      return;
    }
    onClose();
  };

  const handleInsertProductToCanvas = (payload) => {
    const specs = payload?.specs || {};
    const nodeTitle = (
      specs.partNumber
      || specs.category
      || payload?.title
      || "Product Card"
    ).trim();
    const nodeContent = JSON.stringify({
      category: specs.category || "",
      partNumber: specs.partNumber || "",
      dimensions: specs.dimensions || { x: "", y: "", z: "" },
      material: specs.material || "",
      mountingPointDistance: specs.mountingPointDistance || "",
      imageCount: Array.isArray(payload?.images) ? payload.images.length : 0,
      images: Array.isArray(payload?.images)
        ? payload.images.map((img) => ({ name: img.name, src: img.src }))
        : [],
    });

    const nodeId = addNode(nodeTitle, "text", nodeContent, docId, {
      sourceBlockId: payload?.sourceBlockId || null,
      sourceQuery: nodeTitle,
    });
    const createdNode = useNodesStore.getState().getNode(nodeId);
    if (createdNode && onInsertToCanvas) {
      onInsertToCanvas(createdNode, { center: true });
    }
  };

  const handleSave = () => {
    const title = resolvePersistTitle({
      draftTitle,
      draftCategory,
      draftVersion,
      draftDocKind,
      draftSubcategoryDocIds,
    }).trim() || "New document";

    let blocksToSave = draftBlocks;
    const storeDoc = useDocsStore.getState().getDoc(doc.id);
    const storeBlocks = normalizeDocBlocks(
      storeDoc?.blocks?.length
        ? storeDoc.blocks
        : docBlocksFromBody(storeDoc?.body ?? storeDoc?.content ?? ""),
    );
    if (!docBlocksHaveText(blocksToSave) && docBlocksHaveText(storeBlocks)) {
      blocksToSave = storeBlocks;
      setDraftBlocks(storeBlocks);
    }

    const categoryToSave = isContentMode
      ? (draftCategory.trim() || title)
      : draftCategory;

    const savedSnapshot = buildDocPersistSnapshot({
      title,
      blocks: blocksToSave,
      body: draftBody || docBlocksToBody(blocksToSave) || storeDoc?.body || storeDoc?.content || "",
      createdDate: draftCreatedDate,
      version: draftVersion,
      category: categoryToSave,
      launchAt: draftLaunchAt,
      campaignActive: draftCampaignActive,
      parentObjectId: isKnowledgeMode ? "" : draftParentId,
      nodeLinkColor: draftNodeLinkColor,
      docKind: draftDocKind,
      templateKind: draftTemplateKind,
      subcategoryDocIds: draftSubcategoryDocIds,
    });
    updateDoc(doc.id, {
      title,
      blocks: savedSnapshot.blocks,
      content: savedSnapshot.body,
      body: savedSnapshot.body,
      createdAt: savedSnapshot.createdAt,
      version: savedSnapshot.version,
      category: savedSnapshot.category,
      launchAt: savedSnapshot.launchAt,
      campaignActive: savedSnapshot.campaignActive,
      nodeLinkColor: savedSnapshot.nodeLinkColor,
      docKind: savedSnapshot.docKind,
      templateKind: savedSnapshot.templateKind,
      subcategoryDocIds: savedSnapshot.subcategoryDocIds,
      templateSubcategoryDocIds: savedSnapshot.templateSubcategoryDocIds,
      knowledgeImport: savedSnapshot.knowledgeImport,
    });
    if (isKnowledgeMode) {
      if (doc.parentObjectId) linkDocToObject(doc.id, null);
    } else if ((doc.parentObjectId ?? "") !== (draftParentId || "")) {
      linkDocToObject(doc.id, draftParentId || null);
    }
    setInitialSnapshot(savedSnapshot);
    docSnapshotRef.current = JSON.stringify(savedSnapshot);
    useUIStateStore.getState().clearDocEditorDraft(doc.id);
    onAfterDocSave?.(doc.id, savedSnapshot.blocks);
  };

  const persistBlocksAfterPlaybookRemoval = ({ blockId, nextBlocks }) => {
    const savedSnapshot = buildDocPersistSnapshot({
      title: resolvePersistTitle({
        draftTitle,
        draftCategory,
        draftVersion,
        draftDocKind,
        draftSubcategoryDocIds,
      }).trim() || doc?.title || "New document",
      blocks: nextBlocks,
      body: docBlocksToBody(nextBlocks) || draftBody,
      createdDate: draftCreatedDate,
      version: draftVersion,
      category: draftCategory,
      launchAt: draftLaunchAt,
      campaignActive: draftCampaignActive,
      parentObjectId: isKnowledgeMode ? "" : draftParentId,
      nodeLinkColor: draftNodeLinkColor,
      docKind: draftDocKind,
      templateKind: draftTemplateKind,
      subcategoryDocIds: draftSubcategoryDocIds,
      knowledgeImport: draftKnowledgeImport,
    });
    updateDoc(doc.id, {
      blocks: savedSnapshot.blocks,
      content: savedSnapshot.body,
      body: savedSnapshot.body,
    });
    setInitialSnapshot((prev) => (
      prev
        ? { ...prev, blocks: savedSnapshot.blocks, body: savedSnapshot.body }
        : prev
    ));
    onAfterDocSave?.(doc.id, savedSnapshot.blocks);
    onStepPlaybookRemoved?.({ docId: doc.id, blockId });
  };

  const resetNodeModalState = () => {
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }
    setActiveNodeContext(null);
    setNodeDraftContent("");
    setNodeDraftAnchorDate("");
    setNodeDraftAnchorTime("");
    setNodeDraftCompleted(false);
    setNodeDraftSourceId(null);
    setNodeInitialSnapshot(null);
    nodeInitialSnapshotRef.current = null;
  };

  const normalizeNodeContent = (value) => {
    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value ?? "");
  };

  const hasNodeUnsavedChanges = () => {
    if (!activeNodeContext || !nodeInitialSnapshot) return false;
    return (
      normalizeNodeContent(nodeDraftContent) !== nodeInitialSnapshot.content
      || nodeDraftAnchorDate !== nodeInitialSnapshot.anchorDate
      || nodeDraftAnchorTime !== nodeInitialSnapshot.anchorTime
      || Boolean(nodeDraftCompleted) !== Boolean(nodeInitialSnapshot.completed)
      || (nodeDraftSourceId || null) !== (nodeInitialSnapshot.sourceId || null)
    );
  };

  const handleRequestCloseNodeModal = () => {
    if (hasNodeUnsavedChanges()) {
      setShowNodeUnsavedConfirm(true);
      return;
    }
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }
    resetNodeModalState();
  };

  const flushAndCloseNodeModal = () => {
    if (!activeNodeContext) {
      resetNodeModalState();
      return;
    }
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }

    const context = { ...activeNodeContext };
    const { blockIndex, nodeId, dataType, blockType } = context;
    const block = draftBlocks[blockIndex];
    if (block && block.type === blockType) {
      const existingNode = (nodeId || block.nodeId) ? getNode(nodeId || block.nodeId) : null;
      let contentToSave = nodeDraftContent;
      if (
        existingNode
        && dataType === NODE_DATA_TYPES.TEXT
        && parseCalendarEventNodeContent(existingNode.content)
      ) {
        contentToSave = existingNode.content;
      }
      persistNodeContentDebounced(
        contentToSave,
        context,
        nodeDraftAnchorDate,
        nodeDraftAnchorTime,
        { commitSchedule: Boolean(String(nodeDraftAnchorDate || "").trim()) },
      );
      const savedBlocks = useDocsStore.getState().docs[doc.id]?.blocks;
      onAfterDocSave?.(doc.id, savedBlocks);
    }
    resetNodeModalState();
  };

  const handleSendQueryToIntelSearch = () => {
    flushAndCloseNodeModal();
    onClose();
  };

  const handleRequestCloseDoc = () => {
    requestCloseDoc();
  };

  const navigateToDoc = (targetDocId) => {
    if (!targetDocId || targetDocId === docId) return;
    setPendingNavigateDocId(null);
    setShowUnsavedConfirm(false);
    onNavigateToDoc?.(targetDocId);
  };

  const requestNavigateToDoc = (targetDocId) => {
    if (!targetDocId || targetDocId === docId) return;
    if (hasUnsavedDocChanges()) {
      setPendingNavigateDocId(targetDocId);
      setShowUnsavedConfirm(true);
      return;
    }
    navigateToDoc(targetDocId);
  };

  const handleVersionCommit = (trimmedVersion) => {
    const trimmed = trimmedVersion.trim();
    if (!trimmed) {
      setDraftVersion("");
      return;
    }

    const category = draftCategory.trim();
    if (!category) {
      setDraftVersion(trimmed);
      return;
    }

    const existing = findProductVersionDoc(allDocs, draftParentId, category, trimmed);
    if (existing) {
      if (existing.id !== doc.id) {
        requestNavigateToDoc(existing.id);
      }
      return;
    }

    if (hasUnsavedChanges) {
      handleSave();
    }

    const newDocId = addDoc(
      formatProductDocTitle(category, trimmed)
        || draftTitle.trim()
        || doc.title
        || "New document",
      draftParentId || null,
      doc.dataProperties || [],
      Array.isArray(doc.tags) ? doc.tags : [],
      "",
      isoFromDateInput(draftCreatedDate),
      [],
      {
        version: trimmed,
        category,
        launchAt: draftLaunchAt,
        campaignActive: draftCampaignActive,
        subcategoryDocIds: draftSubcategoryDocIds,
        nodeLinkColor: draftNodeLinkColor,
      },
    );

    if (newDocId) {
      navigateToDoc(newDocId);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (!text) return;
    setSelectionModal({ query: text });
  };

  const syncLinkedNodeFromDoc = (blockIndex, content, blocks, anchorPatch = null) => {
    const block = blocks[blockIndex];
    if (!block?.nodeId) return;
    const dataType = blockDataType(block, blocks, blockIndex);
    const queryText = getBlockQueryText(block) || "Untitled query";
    const updates = {
      content,
      title: queryText,
      sourceQuery: queryText,
      dataType,
    };
    if (anchorPatch) {
      updates.anchorAt = isoFromAnchorFields(anchorPatch.anchorDate, anchorPatch.anchorTime);
    }
    updateNode(block.nodeId, updates);
  };

  const handleBlockAnchorChange = (blockIndex, anchorDate, anchorTime) => {
    setDraftBlocks((prev) => {
      const next = updateBlockAt(prev, blockIndex, {
        anchorDate,
        anchorTime,
        anchorFromNode: Boolean(String(anchorDate || "").trim()),
      });
      const block = next[blockIndex];
      if (block?.nodeId) {
        updateNode(block.nodeId, {
          anchorAt: isoFromAnchorFields(anchorDate, anchorTime),
        });
      }
      if (
        activeNodeContext?.blockIndex === blockIndex
        && (activeNodeContext.dataType === NODE_DATA_TYPES.TEXT
          || activeNodeContext.dataType === NODE_DATA_TYPES.CHECKBOX)
      ) {
        setNodeDraftAnchorDate(anchorDate);
        setNodeDraftAnchorTime(anchorTime);
      }
      // Persist Schedule into docsStore immediately so remount/tab switch keeps it.
      if (doc?.id) {
        const body = docBlocksToBody(next);
        updateDoc(doc.id, {
          blocks: next,
          body,
          content: body,
        });
      }
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'post-fix',hypothesisId:'H1',location:'DocExpandedView.jsx:handleBlockAnchorChange',message:'block+node schedule persisted',data:{blockIndex,anchorDate,anchorTime,nodeId:block?.nodeId||null,anchorAt:isoFromAnchorFields(anchorDate,anchorTime)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return next;
    });
  };

  const handleAnswerBelowH1Change = (h1Index, text) => {
    const block = draftBlocks[h1Index];
    if (block && isDocBlockLinkedToNode(block)) return;
    syncLinkedNodeFromDoc(h1Index, text, draftBlocks);
    if (activeNodeContext?.blockIndex === h1Index && activeNodeContext.dataType === NODE_DATA_TYPES.TEXT) {
      setNodeDraftContent(text);
    }
  };

  const handleDetachFromNode = async (ownerIndex) => {
    const block = draftBlocks[ownerIndex];
    const nodeId = block?.nodeId;
    if (!nodeId) return;

    const node = getNode(nodeId);
    let next = draftBlocks;

    if (block?.type === DOC_BLOCK_TYPES.H1) {
      const owned = getOwnedTextBlockIndices(draftBlocks, ownerIndex);
      const primaryTextIndex = owned[0] ?? -1;
      const primaryText = primaryTextIndex >= 0 ? draftBlocks[primaryTextIndex] : null;

      if (primaryText && isEmbeddableWidgetBlock(primaryText)) {
        const snapshotSrc = await captureDocBlockWidgetSnapshot(primaryText.id);
        const textBlockEmbedded = buildDetachedWidgetEmbedded(primaryText, snapshotSrc);
        next = unlinkNodeFromDocBlocks(draftBlocks, ownerIndex, node, { textBlockEmbedded });
      } else {
        next = unlinkNodeFromDocBlocks(draftBlocks, ownerIndex, node);
      }
    } else {
      next = unlinkNodeFromDocBlocks(draftBlocks, ownerIndex, node);
    }

    setDraftBlocks(next);
    deleteNodeEntity(nodeId);

    if (activeNodeContext?.nodeId === nodeId) {
      setActiveNodeContext(null);
      setNodeDraftContent("");
      setNodeDraftAnchorDate("");
      setNodeDraftAnchorTime("");
      setNodeInitialSnapshot(null);
    }
  };

  const persistNodeContentDebounced = (content, context, anchorDate, anchorTime, options = {}) => {
    const { commitSchedule = false } = options;
    if (isNoNodeLinkMode(resolveBlockNodeLinkColor(draftBlocks[context.blockIndex]))) return;
    const { blockId, blockIndex, nodeId, query, dataType, blockType } = context;
    const block = draftBlocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = getBlockQueryText(block) || (query || "").trim() || "Untitled query";
    // Only Yes/flush may write schedule. Autosave must not pass null and wipe anchorAt.
    const anchorAt = commitSchedule && supportsScheduleAnchor(dataType)
      ? isoFromAnchorFields(anchorDate, anchorTime)
      : undefined;
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'pre-fix',hypothesisId:'H1-H2',location:'DocExpandedView.jsx:persistNodeContentDebounced',message:'persist node content',data:{commitSchedule,anchorDate:anchorDate||'',anchorTime:anchorTime||'',anchorAt:anchorAt??null,prevNodeAnchorAt:getNode(nodeId||block.nodeId)?.anchorAt??null,blockAnchorDate:block.anchorDate||'',blockAnchorFromNode:block.anchorFromNode??null,draftCreatedDate,nodeId:nodeId||block.nodeId||null,dataType},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const savedNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId: doc.id,
      blockId,
      query: queryText,
      content,
      dataType,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
      ...(anchorAt !== undefined ? { anchorAt } : {}),
      completed: nodeDraftCompleted,
      sourceId: nodeDraftSourceId,
    });

    if ((nodeId || block.nodeId) !== savedNodeId) {
      setActiveNodeContext((prev) => (prev ? { ...prev, nodeId: savedNodeId } : prev));
    }

    const patch = {
      nodeId: savedNodeId,
      sourceQuery: queryText,
    };
    if (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.DATE || block.type === DOC_BLOCK_TYPES.METRIC) {
      patch.title = block.title || queryText;
    }
    if (block.type === DOC_BLOCK_TYPES.TODO) {
      patch.listTitle = block.listTitle || queryText;
    }
    if (commitSchedule && supportsScheduleAnchor(dataType)) {
      patch.anchorDate = anchorDate;
      patch.anchorTime = anchorTime;
      patch.anchorFromNode = Boolean(anchorDate);
      patch.queryEnabled = true;
    }

    let nextBlocks = updateBlockAt(draftBlocks, blockIndex, patch);
    if (shouldMirrorNodeContentInDoc(block)) {
      nextBlocks = setContentForNodeBlock(nextBlocks, blockIndex, content, dataType);
      if (dataType === NODE_DATA_TYPES.TEXT) {
        nextBlocks = setAnswerBelowH1(
          nextBlocks,
          blockIndex,
          typeof content === "string" ? content : "",
        );
      }
    }

    setDraftBlocks(nextBlocks);

    // Persist into docsStore immediately so returning to the file-box keeps the node.
    const body = docBlocksToBody(nextBlocks);
    updateDoc(doc.id, {
      blocks: nextBlocks,
      body,
      content: body,
    });
    syncNodeToParentDoc(savedNodeId, doc.id);

    if (commitSchedule) {
      const snap = {
        content: normalizeNodeContent(content),
        anchorDate: anchorDate || "",
        anchorTime: anchorTime || "",
        completed: Boolean(nodeDraftCompleted),
        sourceId: nodeDraftSourceId || null,
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
    } else {
      setNodeInitialSnapshot((prev) => {
        const next = {
          content: normalizeNodeContent(content),
          anchorDate: prev?.anchorDate ?? "",
          anchorTime: prev?.anchorTime ?? "",
          completed: Boolean(nodeDraftCompleted),
          sourceId: nodeDraftSourceId || null,
        };
        nodeInitialSnapshotRef.current = next;
        return next;
      });
    }
  };

  const handleNodeContentChange = (content) => {
    setNodeDraftContent(content);
    if (!activeNodeContext) return;

    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
    }
    const context = { ...activeNodeContext };
    // Autosave content only — never commit schedule here (avoids wiping anchorAt).
    nodeAutosaveTimerRef.current = setTimeout(() => {
      persistNodeContentDebounced(content, context, "", "", { commitSchedule: false });
      nodeAutosaveTimerRef.current = null;
    }, 250);
  };

  const ensureBlockNode = (blockIndex, block, contentOverride) => {
    if (!doc?.id || isNoNodeLinkMode(resolveBlockNodeLinkColor(block))) return null;
    const nodeId = ensureNodeForDocBlock({
      block: { ...block, queryEnabled: true },
      blocks: draftBlocks,
      blockIndex,
      docId: doc.id,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
      contentOverride,
      createOrUpdateNodeFromDocBlock,
    });
    if (!nodeId) return null;

    if (draftBlocks[blockIndex]?.nodeId !== nodeId) {
      const queryText = getBlockQueryText(block) || "Untitled query";
      const dataType = blockDataType(block, draftBlocks, blockIndex);
      const patch = {
        nodeId,
        sourceQuery: queryText,
        queryEnabled: true,
      };
      if (
        block.type === DOC_BLOCK_TYPES.H1
        || block.type === DOC_BLOCK_TYPES.DATE
        || block.type === DOC_BLOCK_TYPES.METRIC
      ) {
        patch.title = block.title || queryText;
      }
      if (block.type === DOC_BLOCK_TYPES.TODO) {
        patch.listTitle = block.listTitle || queryText;
      }
      if (dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX) {
        patch.anchorFromNode = block.anchorFromNode ?? false;
      }
      const nextBlocks = updateBlockAt(draftBlocks, blockIndex, patch);
      setDraftBlocks(nextBlocks);
      const body = docBlocksToBody(nextBlocks);
      updateDoc(doc.id, {
        blocks: nextBlocks,
        body,
        content: body,
      });
      setActiveNodeContext((prev) =>
        (prev?.blockIndex === blockIndex ? { ...prev, nodeId } : prev),
      );
    }
    return nodeId;
  };

  const handleEnsureNodeForBlock = (blockIndex, block) => ensureBlockNode(blockIndex, block);

  const handleVideoEmbedSync = (videoIndex, videoPatch = {}, blocksSnapshot) => {
    syncVideoNodeFromVideoBlock(
      blocksSnapshot ?? draftBlocks,
      videoIndex,
      videoPatch,
      updateNode,
    );
  };

  const handleVideoEmbedH1TitleChange = (h1Index) => {
    setDraftBlocks((prev) => {
      syncVideoNodeFromH1Blocks(prev, h1Index, updateNode);
      return prev;
    });
  };

  const handleInsertNodeToCanvas = () => {
    if (!activeNodeContext || !onInsertToCanvas) return;
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }
    const { blockIndex } = activeNodeContext;
    const block = draftBlocks[blockIndex];
    if (!block) return;
    const nodeId = ensureBlockNode(blockIndex, block, nodeDraftContent);
    const entity = nodeId ? getNode(nodeId) : null;
    if (entity) onInsertToCanvas(entity, { center: true });
  };

  const handleOpenNodeForBlock = (blockIndex, block) => {
    if (isNoNodeLinkMode(resolveBlockNodeLinkColor(block))) return;
    const ensuredNodeId = ensureBlockNode(blockIndex, block);
    const dataType = blockDataType(block, draftBlocks, blockIndex);
    const existing = (ensuredNodeId || block.nodeId) ? getNode(ensuredNodeId || block.nodeId) : null;
    let blockContent = getContentForNodeBlock(block, draftBlocks, blockIndex);

    if (isDocBlockLinkedToNode(block) && existing) {
      blockContent = existing.content;
    } else if (block.type === DOC_BLOCK_TYPES.H1 && dataType === NODE_DATA_TYPES.TEXT) {
      const answer = getAnswerBelowH1(draftBlocks, blockIndex);
      if (answer.trim()) blockContent = answer;
    }

    setActiveNodeContext({
      blockId: block.id,
      blockIndex,
      blockType: block.type,
      nodeId: ensuredNodeId || block.nodeId || null,
      query: getBlockQueryText(block),
      dataType,
    });
    const resolvedNodeDraft = resolveNodeDraftFromDoc(blockContent, existing, dataType);
    setNodeDraftContent(resolvedNodeDraft);
    setNodeDraftCompleted(Boolean(existing?.completed));
    setNodeDraftSourceId(existing?.sourceId ?? null);
    // Prefer saved node.anchorAt once schedule was persisted; block/Created is fallback only.
    if (existing?.anchorAt) {
      const fromNode = anchorFieldsFromIso(existing.anchorAt);
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'pre-fix',hypothesisId:'H3',location:'DocExpandedView.jsx:handleOpenNodeForBlock',message:'open node schedule from node.anchorAt',data:{nodeId:existing.id,anchorAt:existing.anchorAt,fromNode,blockAnchorDate:block.anchorDate||'',blockAnchorTime:block.anchorTime||'',blockAnchorFromNode:block.anchorFromNode??null,draftCreatedDate},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setNodeDraftAnchorDate(fromNode.anchorDate);
      setNodeDraftAnchorTime(fromNode.anchorTime);
      const snap = {
        content: normalizeNodeContent(resolvedNodeDraft),
        anchorDate: fromNode.anchorDate,
        anchorTime: fromNode.anchorTime,
        completed: Boolean(existing?.completed),
        sourceId: existing?.sourceId ?? null,
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
    } else {
      const anchorFromBlock = resolveBlockAnchorFields(block, draftCreatedDate, {
        noNodeLink: isNoNodeLinkMode(resolveBlockNodeLinkColor(block)),
      });
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'pre-fix',hypothesisId:'H3',location:'DocExpandedView.jsx:handleOpenNodeForBlock',message:'open node schedule fallback Created/block',data:{nodeId:existing?.id||null,existingAnchorAt:existing?.anchorAt??null,anchorFromBlock,blockAnchorDate:block.anchorDate||'',blockAnchorTime:block.anchorTime||'',blockAnchorFromNode:block.anchorFromNode??null,blockQueryEnabled:block.queryEnabled??null,draftCreatedDate},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setNodeDraftAnchorDate(anchorFromBlock.anchorDate);
      setNodeDraftAnchorTime(anchorFromBlock.anchorTime);
      const snap = {
        content: normalizeNodeContent(resolvedNodeDraft),
        anchorDate: anchorFromBlock.anchorDate,
        anchorTime: anchorFromBlock.anchorTime,
        completed: Boolean(existing?.completed),
        sourceId: existing?.sourceId ?? null,
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
    }
  };

  const supportsScheduleAnchor = (dataType) =>
    dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;

  const handleNodeAnchorDateChange = (anchorDate) => {
    // Persist Schedule immediately — must survive tab switch; never wait for Yes.
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'post-fix',hypothesisId:'H1',location:'DocExpandedView.jsx:handleNodeAnchorDateChange',message:'schedule date persist immediate',data:{anchorDate,nodeDraftAnchorTime,nodeId:activeNodeContext?.nodeId||null,blockIndex:activeNodeContext?.blockIndex??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setNodeDraftAnchorDate(anchorDate);
    if (!activeNodeContext) return;
    handleBlockAnchorChange(activeNodeContext.blockIndex, anchorDate, nodeDraftAnchorTime);
  };

  const handleNodeAnchorTimeChange = (anchorTime) => {
    // Persist Schedule immediately — must survive tab switch; never wait for Yes.
    setNodeDraftAnchorTime(anchorTime);
    if (!activeNodeContext) return;
    handleBlockAnchorChange(activeNodeContext.blockIndex, nodeDraftAnchorDate, anchorTime);
  };

  const handleOpenNodeForH1 = (h1Index, h1Block) => handleOpenNodeForBlock(h1Index, h1Block);

  const handleNodeModalSave = () => {
    flushAndCloseNodeModal();
  };

  const handleKnowledgeFileImport = ({ title: importTitle, knowledgeImport: nextImport }) => {
    const incomingBytes = normalizeKnowledgeImport(nextImport)?.sizeBytes || 0;
    const maxBytes = getPlanLimits(planProfile.plan).maxImportBytes;
    if (incomingBytes > 0) {
      const totalBytes = Object.values(allDocs).reduce((sum, d) => {
        if (d.id === docId) return sum;
        return sum + (normalizeKnowledgeImport(d.knowledgeImport)?.sizeBytes || 0);
      }, 0);
      if (totalBytes + incomingBytes > maxBytes) {
        showUpgradeModal("import_size");
        return;
      }
    }
    if (importTitle && !draftTitle.trim()) {
      setDraftTitle(importTitle);
    }
    if (nextImport) setDraftKnowledgeImport(nextImport);
  };

  const handleReportAnimationComplete = () => {
    const current = useDocsStore.getState().docs[docId];
    if (!current?.reportPresentation?.animateOnOpen) return;
    updateDoc(docId, {
      reportPresentation: {
        ...current.reportPresentation,
        animateOnOpen: false,
        animatedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <>
      <div ref={docShellRef} onContextMenu={handleContextMenu} hidden={hideDocForNodeModal}>
        {isDraftReady ? (
        <DocDocumentBox
          headerLabel={headerLabel}
          title={draftTitle}
          onTitleChange={(v) => {
            setDraftTitle(v);
            if (syncTitleWithCategory) setDraftCategory(v);
          }}
          titlePlaceholder={
            isProductMode
              ? "Product's name"
              : isKnowledgeMode
                ? "Document title"
                : isContentMode
                  ? "Describe Category"
                  : "Write your description"
          }
          body={draftBody}
          onBodyChange={(v) => {
            setDraftBody(v);
          }}
          blocks={draftBlocks}
          onBlocksChange={(next) => {
            setDraftBlocks(next);
          }}
          createdDate={draftCreatedDate}
          onCreatedDateChange={(v) => {
            setDraftCreatedDate(v);
          }}
          version={isTemplate ? "" : draftVersion}
          onVersionChange={isTemplate ? undefined : (v) => {
            setDraftVersion(v);
          }}
          onVersionCommit={isTemplate ? undefined : handleVersionCommit}
          category={isTemplate ? "" : draftCategory}
          onCategoryChange={isTemplate ? undefined : (v) => {
            setDraftCategory(v);
            if (syncTitleWithCategory) setDraftTitle(v);
          }}
          launchDate={isTemplate ? "" : draftLaunchDate}
          onLaunchDateChange={isTemplate ? undefined : (v) => {
            setDraftLaunchDate(v);
            // Persist Launch immediately — Schedule wins and must survive tab switch.
            const launchAt = v ? isoFromDateInput(v) : null;
            updateDoc(doc.id, { launchAt });
            // #region agent log
            fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6405ca'},body:JSON.stringify({sessionId:'6405ca',runId:'post-fix',hypothesisId:'H4',location:'DocExpandedView.jsx:onLaunchDateChange',message:'launchAt persisted to docsStore',data:{docId:doc.id,launchDate:v,launchAt},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          }}
          campaignActive={draftCampaignActive}
          onCampaignActiveChange={isTemplate ? undefined : (v) => {
            setDraftCampaignActive(v);
          }}
          parentId={draftParentId}
          onParentIdChange={isKnowledgeMode ? undefined : (v) => {
            setDraftParentId(v);
          }}
          docKind={draftDocKind}
          metaMode={metaMode}
          templateKind={draftTemplateKind}
          subcategoryDocIds={draftSubcategoryDocIds}
          onSubcategoryDocIdsChange={(ids) => {
            setDraftSubcategoryDocIds(ids);
          }}
          allDocs={allDocs}
          docId={doc.id}
          nodeLinkColor={draftNodeLinkColor}
          onNodeLinkColorChange={(v) => {
            setDraftNodeLinkColor(v);
          }}
          objects={objectList}
          onDelete={handleDeleteDoc}
          onSave={handleSave}
          onCloseAfterSave={onClose}
          onCloseExpand={handleRequestCloseDoc}
          onOpenNodeForBlock={handleOpenNodeForBlock}
          onOpenNodeForH1={handleOpenNodeForH1}
          onEnsureNodeForBlock={handleEnsureNodeForBlock}
          onAnswerBelowH1Change={handleAnswerBelowH1Change}
          onBlockAnchorChange={handleBlockAnchorChange}
          onDetachFromNode={handleDetachFromNode}
          onInsertProductToCanvas={handleInsertProductToCanvas}
          onVideoEmbedSync={handleVideoEmbedSync}
          onVideoEmbedH1TitleChange={handleVideoEmbedH1TitleChange}
          onKnowledgeFileImport={isKnowledgeMode ? handleKnowledgeFileImport : undefined}
          knowledgeImport={isKnowledgeMode ? draftKnowledgeImport : null}
          initialFocusBlockId={initialFocusBlockId}
          reportPresentation={doc?.reportPresentation ?? null}
          onReportAnimationComplete={handleReportAnimationComplete}
          onSavedStepSequenceRemoved={persistBlocksAfterPlaybookRemoval}
        />
        ) : null}
      </div>
      {selectionModal && (
        <NodeFromSelectionModal
          query={selectionModal.query}
          onClose={() => setSelectionModal(null)}
          onSave={({ title, dataType, content }) => {
            addNodeFromDoc(title, dataType, content, docId, selectionModal.query, true);
            setSelectionModal(null);
          }}
        />
      )}
      {activeNodeContext && !showNodeUnsavedConfirm ? (
        <NodeQueryModal
          query={activeNodeContext.query}
          content={nodeDraftContent}
          dataType={activeNodeContext.dataType}
          onContentChange={handleNodeContentChange}
          createdDate={draftCreatedDate}
          completed={nodeDraftCompleted}
          onCompletedChange={(v) => {
            setNodeDraftCompleted(v);
            const id = activeNodeContext?.nodeId;
            if (id) updateNode(id, { completed: Boolean(v) });
            setNodeInitialSnapshot((prev) => (
              prev ? { ...prev, completed: Boolean(v) } : prev
            ));
            if (nodeInitialSnapshotRef.current) {
              nodeInitialSnapshotRef.current = {
                ...nodeInitialSnapshotRef.current,
                completed: Boolean(v),
              };
            }
          }}
          sourceId={nodeDraftSourceId}
          onSourceIdChange={(v) => {
            setNodeDraftSourceId(v);
            const id = activeNodeContext?.nodeId;
            if (id) updateNode(id, { sourceId: v ?? null });
            setNodeInitialSnapshot((prev) => (
              prev ? { ...prev, sourceId: v ?? null } : prev
            ));
            if (nodeInitialSnapshotRef.current) {
              nodeInitialSnapshotRef.current = {
                ...nodeInitialSnapshotRef.current,
                sourceId: v ?? null,
              };
            }
          }}
          parentDocLabel={parentDocLabel}
          onSave={handleNodeModalSave}
          onBackToDocument={handleRequestCloseNodeModal}
          anchorDate={nodeDraftAnchorDate}
          anchorTime={nodeDraftAnchorTime}
          onAnchorDateChange={handleNodeAnchorDateChange}
          onAnchorTimeChange={handleNodeAnchorTimeChange}
          onClose={handleRequestCloseNodeModal}
          onInsertToCanvas={onInsertToCanvas ? handleInsertNodeToCanvas : undefined}
          entityNodeId={activeNodeContext.nodeId || null}
          onSendToIntelSearch={handleSendQueryToIntelSearch}
          intelSearchMeta={
            activeNodeContext
              ? {
                  queryNodeEntityId: activeNodeContext.nodeId || null,
                  docId,
                  blockIndex: activeNodeContext.blockIndex,
                }
              : null
          }
        />
      ) : null}
      <UnsavedChangesConfirm
        open={showUnsavedConfirm}
        titleId="doc-unsaved-confirm-title"
        onYes={() => {
          setShowUnsavedConfirm(false);
          handleSave();
          const proceed = pendingCloseActionRef.current;
          pendingCloseActionRef.current = null;
          if (pendingNavigateDocId) {
            navigateToDoc(pendingNavigateDocId);
            proceed?.();
          } else {
            onClose();
            proceed?.();
          }
        }}
        onNo={() => {
          setShowUnsavedConfirm(false);
          useUIStateStore.getState().clearDocEditorDraft(docId);
          const proceed = pendingCloseActionRef.current;
          pendingCloseActionRef.current = null;
          if (pendingNavigateDocId) {
            navigateToDoc(pendingNavigateDocId);
            proceed?.();
          } else {
            onClose();
            proceed?.();
          }
        }}
      />
      <UnsavedChangesConfirm
        open={showNodeUnsavedConfirm}
        promptKey="nodePrompt"
        titleId="node-unsaved-confirm-title"
        onYes={() => {
          handleNodeModalSave();
          setShowNodeUnsavedConfirm(false);
        }}
        onNo={() => {
          setShowNodeUnsavedConfirm(false);
          resetNodeModalState();
        }}
      />
    </>
  );
}
