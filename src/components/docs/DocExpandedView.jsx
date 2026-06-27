import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { getPlanLimits } from "../../lib/planConfig.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { normalizeKnowledgeImport } from "../../lib/knowledgeImport.js";
import { Modal } from "../shared/Modal.jsx";
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
  docBlocksToBody,
  normalizeDocBlocks,
  updateBlockAt,
  DOC_BLOCK_TYPES,
} from "../../lib/docBlocks.js";
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
} from "../../lib/docNodeSync.js";
import { parseCalendarEventNodeContent } from "../../lib/eventCalendarSearch.js";
import { isNoNodeLinkMode, resolveBlockNodeLinkColor } from "../../lib/docNodeLinkColors.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";

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
  onNavigateToDoc,
  onDocumentDeleted,
  onAfterDocSave,
  initialFocusBlockId = null,
}) {
  const doc = useDocsStore((s) => s.docs[docId]);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const addDoc = useDocsStore((s) => s.addDoc);
  const linkDocToObject = useDocsStore((s) => s.linkDocToObject);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const addNodeFromDoc = useNodesStore((s) => s.addNodeFromDoc);
  const addNode = useNodesStore((s) => s.addNode);
  const getNode = useNodesStore((s) => s.getNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
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
  const [nodeInitialSnapshot, setNodeInitialSnapshot] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingNavigateDocId, setPendingNavigateDocId] = useState(null);
  const [showNodeUnsavedConfirm, setShowNodeUnsavedConfirm] = useState(false);
  const nodeAutosaveTimerRef = useRef(null);
  const objects = useObjectsStore((s) => s.objects);
  const allDocs = useDocsStore((s) => s.docs);
  const planProfile = usePlanStore((s) => s.profile);
  const showUpgradeModal = useUpgradeModalStore((s) => s.show);

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

    if (cached) {
      setDraftTitle(cached.title ?? savedTitle);
      setDraftBlocks(
        cached.blocks?.length
          ? normalizeDocBlocks(cached.blocks)
          : loadedBlocks,
      );
      setDraftBody(cached.body ?? (loadedBlocks.length ? "" : (d.body ?? d.content ?? "")));
      setDraftCreatedDate(cached.createdDate ?? dateInputFromIso(normalized.createdAt));
      setDraftVersion(cached.version ?? normalized.version ?? "");
      setDraftCategory(cached.category ?? normalized.category ?? "");
      setDraftLaunchDate(cached.launchDate ?? launchDateInputFromIso(normalized.launchAt));
      setDraftCampaignActive(
        cached.campaignActive ?? Boolean(normalized.campaignActive),
      );
      setDraftNodeLinkColor(cached.nodeLinkColor ?? normalized.nodeLinkColor ?? "dark");
      setDraftParentId(cached.parentId ?? d.parentObjectId ?? "");
      setDraftDocKind(cached.docKind ?? normalized.docKind ?? "standard");
      setDraftTemplateKind(cached.templateKind ?? normalized.templateKind ?? null);
      setDraftSubcategoryDocIds(
        cached.subcategoryDocIds ?? normalized.subcategoryDocIds ?? [],
      );
      setDraftKnowledgeImport(cached.knowledgeImport ?? normalized.knowledgeImport ?? null);
    } else {
      setDraftTitle(savedTitle);
      setDraftBlocks(loadedBlocks);
      setDraftBody(loadedBlocks.length ? "" : (d.body ?? d.content ?? ""));
      setDraftCreatedDate(dateInputFromIso(normalized.createdAt));
      setDraftVersion(normalized.version ?? "");
      setDraftCategory(normalized.category ?? "");
      setDraftLaunchDate(launchDateInputFromIso(normalized.launchAt));
      setDraftCampaignActive(Boolean(normalized.campaignActive));
      setDraftNodeLinkColor(normalized.nodeLinkColor ?? "dark");
      setDraftParentId(d.parentObjectId ?? "");
      setDraftDocKind(normalized.docKind ?? "standard");
      setDraftTemplateKind(normalized.templateKind ?? null);
      setDraftSubcategoryDocIds(normalized.subcategoryDocIds ?? []);
      setDraftKnowledgeImport(normalized.knowledgeImport ?? null);
    }

    setInitialSnapshot(
      buildDocPersistSnapshot({
        title: savedTitle,
        blocks: loadedBlocks,
        body: d.body ?? d.content ?? "",
        createdDate: dateInputFromIso(normalized.createdAt),
        version: normalized.version ?? "",
        category: normalized.category ?? "",
        launchAt: normalized.launchAt ?? null,
        campaignActive: Boolean(normalized.campaignActive),
        parentObjectId: d.parentObjectId ?? "",
        nodeLinkColor: normalized.nodeLinkColor ?? "dark",
        docKind: normalized.docKind ?? "standard",
        templateKind: normalized.templateKind ?? null,
        subcategoryDocIds: normalized.subcategoryDocIds ?? [],
        knowledgeImport: normalized.knowledgeImport ?? null,
      }),
    );
    setIsDraftReady(true);
  }, [docId]);

  useEffect(() => {
    if (!docId || !isDraftReady) return undefined;
    const persistDraft = () => {
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

  if (!doc) return null;

  const objectList = Object.values(objects);
  const parentObject = draftParentId ? objects[draftParentId] : null;
  const headerLabel = parentObject?.name || "";
  const parentDocLabel = draftTitle.trim() || UNTITLED_DOC_LABEL;
  const draftLaunchAt = draftLaunchDate ? isoFromDateInput(draftLaunchDate) : null;
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
  const hasUnsavedChanges = initialSnapshot
    ? JSON.stringify(initialSnapshot) !== JSON.stringify(draftSnapshot)
    : false;

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
    const savedSnapshot = buildDocPersistSnapshot({
      title,
      blocks: draftBlocks,
      body: draftBody,
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
    useUIStateStore.getState().clearDocEditorDraft(doc.id);
    onAfterDocSave?.(doc.id, savedSnapshot.blocks);
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
    setNodeInitialSnapshot(null);
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
    );
  };

  const handleRequestCloseNodeModal = () => {
    if (hasNodeUnsavedChanges()) {
      setShowNodeUnsavedConfirm(true);
      return;
    }
    resetNodeModalState();
  };

  const handleSendQueryToIntelSearch = () => {
    resetNodeModalState();
    onClose();
  };

  const handleRequestCloseDoc = () => {
    setPendingNavigateDocId(null);
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
      return;
    }
    onClose();
  };

  const navigateToDoc = (targetDocId) => {
    if (!targetDocId || targetDocId === docId) return;
    setPendingNavigateDocId(null);
    setShowUnsavedConfirm(false);
    onNavigateToDoc?.(targetDocId);
  };

  const requestNavigateToDoc = (targetDocId) => {
    if (!targetDocId || targetDocId === docId) return;
    if (hasUnsavedChanges) {
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
        anchorFromNode: true,
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
      return next;
    });
  };

  const handleAnswerBelowH1Change = (h1Index, text) => {
    syncLinkedNodeFromDoc(h1Index, text, draftBlocks);
    if (activeNodeContext?.blockIndex === h1Index && activeNodeContext.dataType === NODE_DATA_TYPES.TEXT) {
      setNodeDraftContent(text);
    }
  };

  const handleDetachFromNode = (ownerIndex) => {
    const block = draftBlocks[ownerIndex];
    const nodeId = block?.nodeId;
    if (!nodeId) return;

    const node = getNode(nodeId);
    const next = unlinkNodeFromDocBlocks(draftBlocks, ownerIndex, node);
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

  const persistNodeContentDebounced = (content, context, anchorDate, anchorTime) => {
    if (isNoNodeLinkMode(resolveBlockNodeLinkColor(draftBlocks[context.blockIndex]))) return;
    const { blockId, blockIndex, nodeId, query, dataType, blockType } = context;
    const block = draftBlocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = getBlockQueryText(block) || (query || "").trim() || "Untitled query";
    const anchorAt = supportsScheduleAnchor(dataType)
      ? isoFromAnchorFields(anchorDate, anchorTime)
      : null;

    const savedNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId: doc.id,
      blockId,
      query: queryText,
      content,
      dataType,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
      anchorAt,
    });

    if ((nodeId || block.nodeId) !== savedNodeId) {
      setActiveNodeContext((prev) => (prev ? { ...prev, nodeId: savedNodeId } : prev));
    }

    setDraftBlocks((prev) => {
      const current = prev[blockIndex];
      if (!current) return prev;
      const patch = {
        nodeId: savedNodeId,
        sourceQuery: queryText,
      };
      if (current.type === DOC_BLOCK_TYPES.H1 || current.type === DOC_BLOCK_TYPES.DATE || current.type === DOC_BLOCK_TYPES.METRIC) {
        patch.title = current.title || queryText;
      }
      if (current.type === DOC_BLOCK_TYPES.TODO) {
        patch.listTitle = current.listTitle || queryText;
      }
      if (supportsScheduleAnchor(dataType)) {
        patch.anchorDate = anchorDate;
        patch.anchorTime = anchorTime;
        patch.anchorFromNode = true;
        patch.queryEnabled = true;
      }

      let next = updateBlockAt(prev, blockIndex, patch);
      next = setContentForNodeBlock(next, blockIndex, content, dataType);
      if (dataType === NODE_DATA_TYPES.TEXT) {
        next = setAnswerBelowH1(next, blockIndex, typeof content === "string" ? content : "");
      }
      return next;
    });

    setNodeInitialSnapshot({
      content: normalizeNodeContent(content),
      anchorDate,
      anchorTime,
    });
  };

  const handleNodeContentChange = (content) => {
    setNodeDraftContent(content);
    if (!activeNodeContext) return;

    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
    }
    const context = { ...activeNodeContext };
    const anchorDate = nodeDraftAnchorDate;
    const anchorTime = nodeDraftAnchorTime;
    nodeAutosaveTimerRef.current = setTimeout(() => {
      persistNodeContentDebounced(content, context, anchorDate, anchorTime);
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
      setDraftBlocks((prev) => {
        const current = prev[blockIndex];
        if (!current) return prev;
        const patch = {
          nodeId,
          sourceQuery: queryText,
          queryEnabled: true,
        };
        if (
          current.type === DOC_BLOCK_TYPES.H1
          || current.type === DOC_BLOCK_TYPES.DATE
          || current.type === DOC_BLOCK_TYPES.METRIC
        ) {
          patch.title = current.title || queryText;
        }
        if (current.type === DOC_BLOCK_TYPES.TODO) {
          patch.listTitle = current.listTitle || queryText;
        }
        if (dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX) {
          patch.anchorFromNode = current.anchorFromNode ?? false;
        }
        return updateBlockAt(prev, blockIndex, patch);
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

    if (block.type === DOC_BLOCK_TYPES.H1 && dataType === NODE_DATA_TYPES.TEXT) {
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
    const anchorFromBlock = resolveBlockAnchorFields(block, draftCreatedDate, {
      noNodeLink: isNoNodeLinkMode(resolveBlockNodeLinkColor(block)),
    });
    const anchorFromNode = anchorFieldsFromIso(existing?.anchorAt);
    const resolvedAnchorDate = anchorFromBlock.anchorDate || anchorFromNode.anchorDate;
    const resolvedAnchorTime = anchorFromBlock.anchorTime || anchorFromNode.anchorTime;
    setNodeDraftAnchorDate(resolvedAnchorDate);
    setNodeDraftAnchorTime(resolvedAnchorTime);
    setNodeInitialSnapshot({
      content: normalizeNodeContent(resolvedNodeDraft),
      anchorDate: resolvedAnchorDate,
      anchorTime: resolvedAnchorTime,
    });
  };

  const supportsScheduleAnchor = (dataType) =>
    dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;

  const handleNodeAnchorDateChange = (anchorDate) => {
    setNodeDraftAnchorDate(anchorDate);
    if (!activeNodeContext) return;
    const { blockIndex } = activeNodeContext;
    handleBlockAnchorChange(blockIndex, anchorDate, nodeDraftAnchorTime);
  };

  const handleNodeAnchorTimeChange = (anchorTime) => {
    setNodeDraftAnchorTime(anchorTime);
    if (!activeNodeContext) return;
    const { blockIndex } = activeNodeContext;
    handleBlockAnchorChange(blockIndex, nodeDraftAnchorDate, anchorTime);
  };

  const handleOpenNodeForH1 = (h1Index, h1Block) => handleOpenNodeForBlock(h1Index, h1Block);

  const handleNodeModalSave = () => {
    if (!activeNodeContext) return;
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }

    const { blockId, blockIndex, nodeId, query, dataType, blockType } = activeNodeContext;
    const block = draftBlocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = getBlockQueryText(block) || (query || "").trim() || "Untitled query";
    const patch = { nodeId: null, sourceQuery: queryText };

    if (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.DATE || block.type === DOC_BLOCK_TYPES.METRIC) {
      patch.title = block.title || queryText;
    }
    if (block.type === DOC_BLOCK_TYPES.TODO) {
      patch.listTitle = block.listTitle || queryText;
    }

    const anchorAt = supportsScheduleAnchor(dataType)
      ? isoFromAnchorFields(nodeDraftAnchorDate, nodeDraftAnchorTime)
      : null;

    const existingNode = nodeId ? getNode(nodeId) : null;
    let contentToSave = nodeDraftContent;
    if (
      existingNode
      && dataType === NODE_DATA_TYPES.TEXT
      && parseCalendarEventNodeContent(existingNode.content)
    ) {
      contentToSave = existingNode.content;
    }

    const newNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId: doc.id,
      blockId,
      query: queryText,
      content: contentToSave,
      dataType,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
      anchorAt,
    });

    patch.nodeId = newNodeId;
    if (supportsScheduleAnchor(dataType)) {
      patch.anchorDate = nodeDraftAnchorDate;
      patch.anchorTime = nodeDraftAnchorTime;
      patch.anchorFromNode = Boolean(
        nodeDraftAnchorDate !== nodeInitialSnapshot?.anchorDate
        || nodeDraftAnchorTime !== nodeInitialSnapshot?.anchorTime,
      ) || Boolean(block.anchorFromNode);
      patch.queryEnabled = true;
    }

    let nextBlocks = updateBlockAt(draftBlocks, blockIndex, patch);
    nextBlocks = setContentForNodeBlock(nextBlocks, blockIndex, contentToSave, dataType);
    if (dataType === NODE_DATA_TYPES.TEXT) {
      nextBlocks = setAnswerBelowH1(
        nextBlocks,
        blockIndex,
        typeof contentToSave === "string" ? contentToSave : "",
      );
    }
    setDraftBlocks(nextBlocks);
    setActiveNodeContext(null);
    setNodeDraftContent("");
    setNodeDraftAnchorDate("");
    setNodeDraftAnchorTime("");
    setNodeInitialSnapshot(null);
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

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        <DocDocumentBox
          headerLabel={headerLabel}
          title={draftTitle}
          onTitleChange={(v) => {
            setDraftTitle(v);
            if (isProductMode) setDraftCategory(v);
          }}
          titlePlaceholder={
            isProductMode
              ? "Product's name"
              : isKnowledgeMode
                ? "Document title"
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
            if (isProductMode) setDraftTitle(v);
          }}
          launchDate={isTemplate ? "" : draftLaunchDate}
          onLaunchDateChange={isTemplate ? undefined : (v) => {
            setDraftLaunchDate(v);
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
        />
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
          parentDocLabel={parentDocLabel}
          onSave={handleNodeModalSave}
          onBackToDocument={handleRequestCloseNodeModal}
          anchorDate={nodeDraftAnchorDate}
          anchorTime={nodeDraftAnchorTime}
          onAnchorDateChange={handleNodeAnchorDateChange}
          onAnchorTimeChange={handleNodeAnchorTimeChange}
          onClose={handleRequestCloseNodeModal}
          onInsertToCanvas={onInsertToCanvas ? handleInsertNodeToCanvas : undefined}
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
      {showUnsavedConfirm && typeof document !== "undefined"
        ? createPortal(
            <div className="doc-unsaved-confirm-overlay" role="presentation">
              <div
                className="doc-unsaved-confirm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="doc-unsaved-confirm-title"
              >
                <p id="doc-unsaved-confirm-title" className="doc-unsaved-confirm__text">
                  ¿Quieres guardar los cambios?
                </p>
                <div className="doc-unsaved-confirm__actions">
                  <button
                    type="button"
                    className="doc-unsaved-confirm__btn doc-unsaved-confirm__btn--yes"
                    onClick={() => {
                      handleSave();
                      setShowUnsavedConfirm(false);
                      if (pendingNavigateDocId) {
                        navigateToDoc(pendingNavigateDocId);
                      } else {
                        onClose();
                      }
                    }}
                  >
                    sí
                  </button>
                  <button
                    type="button"
                    className="doc-unsaved-confirm__btn"
                    onClick={() => {
                      useUIStateStore.getState().clearDocEditorDraft(docId);
                      setShowUnsavedConfirm(false);
                      if (pendingNavigateDocId) {
                        navigateToDoc(pendingNavigateDocId);
                      } else {
                        onClose();
                      }
                    }}
                  >
                    no
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {showNodeUnsavedConfirm && typeof document !== "undefined"
        ? createPortal(
            <div className="doc-unsaved-confirm-overlay" role="presentation">
              <div
                className="doc-unsaved-confirm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="node-unsaved-confirm-title"
              >
                <p id="node-unsaved-confirm-title" className="doc-unsaved-confirm__text">
                  ¿Quieres guardar los cambios del nodo?
                </p>
                <div className="doc-unsaved-confirm__actions">
                  <button
                    type="button"
                    className="doc-unsaved-confirm__btn doc-unsaved-confirm__btn--yes"
                    onClick={() => {
                      handleNodeModalSave();
                      setShowNodeUnsavedConfirm(false);
                    }}
                  >
                    sí
                  </button>
                  <button
                    type="button"
                    className="doc-unsaved-confirm__btn"
                    onClick={() => {
                      setShowNodeUnsavedConfirm(false);
                      resetNodeModalState();
                    }}
                  >
                    no
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
