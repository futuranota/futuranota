import { useState, useEffect, useRef, useCallback } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useTimelineStore } from "../../stores/timelineStore.js";
import { usePlanStore } from "../../stores/planStore.js";
import { getPlanLimits } from "../../lib/planConfig.js";
import { useUpgradeModalStore } from "../../stores/upgradeModalStore.js";
import { normalizeKnowledgeImport } from "../../lib/knowledgeImport.js";
import { useI18n } from "../../i18n/useI18n.js";
import { Modal } from "../shared/Modal.jsx";
import { UnsavedChangesConfirm } from "../shared/UnsavedChangesConfirm.jsx";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { playTrashBoxSound } from "../../lib/trashBoxSound.js";
import { MarkLoadingOverlay } from "../shared/MarkLoading.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";
import { NodeQueryModal } from "../nodes/NodeQueryModal.jsx";
import { StandaloneNodeModal } from "../nodes/StandaloneNodeModal.jsx";
import {
  CAMPAIGN_DOC_STATUS_INACTIVE,
  normalizeCampaignDocStatus,
} from "../../lib/campaignDocSource.js";
import { buildCampaignChildScheduleFields } from "../../lib/campaignDates.js";
import {
  DOC_WORK_STATUS,
  defaultStatusAfterScheduleSave,
  resolveDocWorkStatus,
  sanitizeDocStatusForFolderSchedule,
} from "../../lib/docWorkStatus.js";

const NODE_SAVE_LOADING_MIN_MS = 700;
import {
  dateInputFromIso,
  formatMmDdYy,
  isoFromDateInput,
  launchDateInputFromIso,
  todayDateInputValue,
} from "../../lib/docDates.js";
import {
  folderScheduleDateInputBounds,
  folderSchedulePickerMinDateInput,
  folderScheduleRangeChanged,
  isDateInputWithinFolderSchedule,
  isFolderScheduleReserved,
  resetNonReservedChildrenForFolderScheduleChange,
  validateFolderSchedule,
} from "../../lib/folderScheduleReservation.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
import { useDepartmentsStore } from "../../stores/departmentsStore.js";
import {
  findDepartmentById,
  formatDepartmentOfLabel,
} from "../../lib/departments.js";
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
  ensureWritableDocTail,
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
  mergeMissingLinkedOwnerBundles,
  ensureAllLinkedOwnerContinuationSlots,
  removeLinkedOwnerBundleFromBlocks,
  reconcileLinkedBlockTitlesFromNodes,
  shouldMirrorNodeContentInDoc,
  linkedOwnerNodeIdsInOrder,
} from "../../lib/docNodeSync.js";
import { reorderLinkedOwnerBundlesInBlocks } from "../../lib/folderDocumentOrder.js";
import {
  buildDetachedWidgetEmbedded,
  captureDocBlockWidgetSnapshot,
  isEmbeddableWidgetBlock,
} from "../../lib/captureWidgetSnapshot.js";
import { parseCalendarEventNodeContent } from "../../lib/eventCalendarSearch.js";
import { isNoNodeLinkMode, resolveBlockNodeLinkColor } from "../../lib/docNodeLinkColors.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import { nodeDraftContentForStorage } from "../../lib/nodeInlineContent.js";
import { listOccupiedIntervalsByDate, hasTimeframeOverlap } from "../../lib/docScheduleOccupancy.js";

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
  if (Boolean(String(cached.scheduleStartDate ?? "").trim())) return true;
  return false;
}

function isEmptyDocState(title, blocks, body) {
  return (
    !(title || "").trim()
    && !docBlocksHaveText(blocks)
    && !(body || "").trim()
  );
}

function resolvePersistLaunchAt(campaignActive, scheduleStartDate, launchDate) {
  if (campaignActive) return null;
  if (scheduleStartDate) return isoFromDateInput(scheduleStartDate);
  if (launchDate) return isoFromDateInput(launchDate);
  return null;
}

/** Same heals the editor applies on mount — must be in the dirty baseline. */
function prepareOpenDocBlocks(blocks) {
  return ensureWritableDocTail(ensureAllLinkedOwnerContinuationSlots(blocks));
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
  // Content folders: title and category are independent; never display the tag as title.
  if (kind === DOC_KIND_CONTENT) {
    return draftTitle.trim();
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
  icon,
  departmentId,
  launchDate,
  scheduleStartDate,
  scheduleFinishDate,
  campaignActive,
  nodeLinkColor,
  parentId,
  docKind,
  templateKind,
  subcategoryDocIds,
  knowledgeImport,
}) {
  return {
    schemaVersion: 2,
    title: title ?? "",
    body: body ?? "",
    blocks: normalizeDocBlocks(blocks),
    createdDate: createdDate ?? "",
    version: version ?? "",
    category: category ?? "",
    icon: icon ?? "",
    departmentId: departmentId ?? null,
    launchDate: launchDate ?? "",
    scheduleStartDate: scheduleStartDate ?? "",
    scheduleFinishDate: scheduleFinishDate ?? "",
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
  icon = "",
  departmentId = null,
  launchAt = null,
  scheduleStartAt = null,
  scheduleFinishAt = null,
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
  // Keep Launch and Schedule independent — callers decide what to pass.
  const resolvedLaunchAt = launchAt ?? null;
  const resolvedScheduleStart = scheduleStartAt ?? null;
  const resolvedScheduleFinish = scheduleFinishAt ?? resolvedScheduleStart ?? null;
  return {
    title: title ?? "",
    blocks: normalizedBlocks,
    body: serializedBody,
    createdAt: isoFromDateInput(createdDate),
    version: String(version ?? "").trim(),
    category: String(category ?? "").trim(),
    icon: String(icon ?? "").trim(),
    departmentId: typeof departmentId === "string" && departmentId.trim()
      ? departmentId.trim()
      : null,
    launchAt: resolvedLaunchAt,
    scheduleStartAt: resolvedScheduleStart,
    scheduleFinishAt: resolvedScheduleFinish,
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
  const askConfirm = useConfirmStore((s) => s.ask);
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
  const deleteNodeAndDocBlocks = useNodesStore((s) => s.deleteNodeAndDocBlocks);

  const [selectionModal, setSelectionModal] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const draftBlocksRef = useRef(draftBlocks);
  draftBlocksRef.current = draftBlocks;
  /** Linked nodeIds last seen in docsStore for this open folder (prevents remarge loops). */
  const storeLinkedNodeIdsKeyRef = useRef("");
  const [draftCreatedDate, setDraftCreatedDate] = useState("");
  const [draftVersion, setDraftVersion] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftDepartmentId, setDraftDepartmentId] = useState(null);
  const [draftIcon, setDraftIcon] = useState("");
  const [draftLaunchDate, setDraftLaunchDate] = useState("");
  const [draftScheduleStartDate, setDraftScheduleStartDate] = useState("");
  const [draftScheduleFinishDate, setDraftScheduleFinishDate] = useState("");
  const [draftCampaignActive, setDraftCampaignActive] = useState(false);
  const [draftNodeLinkColor, setDraftNodeLinkColor] = useState("dark");
  const [draftParentId, setDraftParentId] = useState("");
  const [draftDocKind, setDraftDocKind] = useState("standard");
  const [draftTemplateKind, setDraftTemplateKind] = useState(null);
  const [draftSubcategoryDocIds, setDraftSubcategoryDocIds] = useState([]);
  const [draftKnowledgeImport, setDraftKnowledgeImport] = useState(null);
  const [activeNodeContext, setActiveNodeContext] = useState(null);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [nodeDraftContent, setNodeDraftContent] = useState("");
  const [nodeDraftAnchorDate, setNodeDraftAnchorDate] = useState("");
  const [nodeDraftAnchorTime, setNodeDraftAnchorTime] = useState("");
  const [nodeDraftAnchorFinishTime, setNodeDraftAnchorFinishTime] = useState("");
  const [nodeDraftCompleted, setNodeDraftCompleted] = useState(false);
  const [nodeDraftStatus, setNodeDraftStatus] = useState(null);
  const [nodeDraftCampaignStatus, setNodeDraftCampaignStatus] = useState(
    CAMPAIGN_DOC_STATUS_INACTIVE,
  );
  const [nodeDraftAnnounceDate, setNodeDraftAnnounceDate] = useState("");
  const [nodeDraftSubcategory, setNodeDraftSubcategory] = useState("");
  const [nodeDraftSourceId, setNodeDraftSourceId] = useState(null);
  const [nodeInitialSnapshot, setNodeInitialSnapshot] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingNavigateDocId, setPendingNavigateDocId] = useState(null);
  const [showNodeUnsavedConfirm, setShowNodeUnsavedConfirm] = useState(false);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const nodeAutosaveTimerRef = useRef(null);
  const nodeInitialSnapshotRef = useRef(null);
  const docShellRef = useRef(null);
  const docSnapshotRef = useRef(null);
  const docIsDirtyRef = useRef(false);
  const skipDraftPersistRef = useRef(false);
  const pendingCloseActionRef = useRef(null);
  const hideDocForNodeModal = Boolean(
    (activeNodeContext && !showNodeUnsavedConfirm) || showCreateDocument,
  );

  const handleCreateDocumentInFolder = useCallback(() => {
    setShowCreateDocument(true);
  }, []);

  const handleShredFolderNode = useCallback(async (nodeId) => {
    if (!nodeId) return;
    const node = useNodesStore.getState().nodes[nodeId];
    if (!node) return;
    const label = String(node.title || node.sourceQuery || t("sidebar.newDocument")).trim()
      || t("sidebar.newDocument");
    const confirmed = await askConfirm({
      title: t("sidebar.deleteNodeTitle"),
      message: t("sidebar.deleteNodeConfirm", { name: label }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    try { playTrashBoxSound(); } catch { /* ignore */ }
    deleteNodeAndDocBlocks(nodeId);
    setDraftBlocks((prev) => removeLinkedOwnerBundleFromBlocks(prev, nodeId).blocks);
  }, [askConfirm, deleteNodeAndDocBlocks, t]);
  const objects = useObjectsStore((s) => s.objects);
  const allDocs = useDocsStore((s) => s.docs);
  const departments = useDepartmentsStore((s) => s.departments);
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
    skipDraftPersistRef.current = false;
    docIsDirtyRef.current = false;
    setShowCreateDocument(false);
    const d = useDocsStore.getState().docs[docId];
    if (!d) return;
    const cached = useUIStateStore.getState().docEditorDrafts[docId];
    const loadedBlocksRaw = normalizeDocBlocks(
      d.blocks?.length ? d.blocks : docBlocksFromBody(d.body ?? d.content ?? ""),
    );
    const nodesById = useNodesStore.getState().nodes;
    const loadedBlocks = reconcileLinkedBlockTitlesFromNodes(loadedBlocksRaw, nodesById);
    // Heal stale H1/TODO titles in the store when the linked node was renamed elsewhere.
    if (loadedBlocks !== loadedBlocksRaw) {
      useDocsStore.getState().updateDoc(docId, { blocks: loadedBlocks });
    }
    const normalized = normalizeDoc(d);
    const savedTitle = isProductDoc(normalized)
      ? (normalized.category?.trim() || normalized.title?.trim() || "")
      : (d.title ?? "");
    const loadedHasText = docBlocksHaveText(loadedBlocks);
    const cachedBlocksRaw = cached?.blocks?.length ? normalizeDocBlocks(cached.blocks) : [];
    const cachedBlocks = reconcileLinkedBlockTitlesFromNodes(cachedBlocksRaw, nodesById);
    const cachedHasText = docDraftHasContent(cached);
    const preferStoreContent = Boolean(
      normalized.reportPresentation?.animateOnOpen
      || (normalized.reportPresentation?.kind === "analyst-strategic-v2" && loadedHasText),
    );
    const useCachedDraft = cached?.schemaVersion === 2 && !preferStoreContent && cachedHasText;

    const blocksForSnapshotRaw = useCachedDraft ? cachedBlocks : loadedBlocks;
    const storeOwnerOrder = linkedOwnerNodeIdsInOrder(loadedBlocks);
    const blocksForSnapshotMerged = mergeMissingLinkedOwnerBundles(
      blocksForSnapshotRaw,
      loadedBlocks,
    );
    // Cached drafts can outlive a left-panel reorder — realign owner bundles to store.
    const blocksReordered = storeOwnerOrder.length
      ? reorderLinkedOwnerBundlesInBlocks(blocksForSnapshotMerged, storeOwnerOrder)
      : blocksForSnapshotMerged;
    const blocksForSnapshot = prepareOpenDocBlocks(blocksReordered);
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
    const loadedDepartmentId = useCachedDraft
      ? (cached.departmentId ?? normalized.departmentId ?? null)
      : (normalized.departmentId ?? null);
    const loadedIcon = useCachedDraft
      ? (cached.icon ?? normalized.icon ?? "")
      : (normalized.icon ?? "");
    const loadedLaunchDate = useCachedDraft
      ? (cached.launchDate ?? launchDateInputFromIso(normalized.launchAt))
      : launchDateInputFromIso(normalized.launchAt);
    const loadedScheduleStartDate = useCachedDraft
      ? (cached.scheduleStartDate
        ?? launchDateInputFromIso(normalized.scheduleStartAt)
        ?? "")
      : (launchDateInputFromIso(normalized.scheduleStartAt) || "");
    const loadedScheduleFinishDate = useCachedDraft
      ? (cached.scheduleFinishDate
        ?? launchDateInputFromIso(normalized.scheduleFinishAt)
        ?? loadedScheduleStartDate)
      : (launchDateInputFromIso(normalized.scheduleFinishAt) || loadedScheduleStartDate);
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

    setDraftTitle(loadedTitle);
    setDraftBlocks(blocksForSnapshot);
    setDraftBody(loadedBody);
    setDraftCreatedDate(loadedCreatedDate);
    setDraftVersion(loadedVersion);
    setDraftCategory(loadedCategory);
    setDraftDepartmentId(loadedDepartmentId);
    setDraftIcon(loadedIcon);
    setDraftLaunchDate(loadedLaunchDate);
    setDraftScheduleStartDate(loadedScheduleStartDate);
    setDraftScheduleFinishDate(loadedScheduleFinishDate);
    setDraftCampaignActive(loadedCampaignActive);
    setDraftNodeLinkColor(loadedNodeLinkColor);
    setDraftParentId(loadedParentId);
    setDraftDocKind(loadedDocKind);
    setDraftTemplateKind(loadedTemplateKind);
    setDraftSubcategoryDocIds(loadedSubcategoryDocIds);
    setDraftKnowledgeImport(loadedKnowledgeImport);

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
      icon: loadedIcon,
      departmentId: loadedDepartmentId,
      launchAt: resolvePersistLaunchAt(
        loadedCampaignActive,
        loadedScheduleStartDate,
        loadedLaunchDate,
      ),
      scheduleStartAt: loadedScheduleStartDate
        ? isoFromDateInput(loadedScheduleStartDate)
        : null,
      scheduleFinishAt: loadedScheduleFinishDate
        ? isoFromDateInput(loadedScheduleFinishDate)
        : null,
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
    storeLinkedNodeIdsKeyRef.current = linkedOwnerNodeIdsInOrder(blocksForSnapshot).join("|");
    setIsDraftReady(true);
  }, [docId]);

  // Migrate legacy data-URL block images + folder icon to Storage.
  useEffect(() => {
    if (!docId || !isDraftReady) return undefined;
    let cancelled = false;
    (async () => {
      const {
        docBlocksHaveImageDataUrls,
        isDocImageDataUrl,
        migrateAndPersistDocImages,
      } = await import("../../lib/migrateDocImageDataUrls.js");
      if (cancelled) return;
      const iconNeeds = isDocImageDataUrl(draftIcon);
      const blocksNeed = docBlocksHaveImageDataUrls(draftBlocksRef.current);
      if (!iconNeeds && !blocksNeed) return;
      console.log("[doc-images] open-doc backfill", { docId, iconNeeds, blocksNeed });
      const result = await migrateAndPersistDocImages(docId);
      if (cancelled || !result?.changed) return;
      if (result.blocks?.length) {
        setDraftBlocks(result.blocks);
        setInitialSnapshot((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            blocks: result.blocks,
            ...(result.icon ? { icon: result.icon } : {}),
          };
          docSnapshotRef.current = JSON.stringify(next);
          return next;
        });
      }
      if (result.icon && result.icon !== draftIcon) {
        setDraftIcon(result.icon);
        setInitialSnapshot((prev) => {
          if (!prev) return prev;
          const next = { ...prev, icon: result.icon };
          docSnapshotRef.current = JSON.stringify(next);
          return next;
        });
      }
    })().catch((err) => {
      console.warn("[doc-images] open-doc backfill failed:", err?.message || err);
    });
    return () => {
      cancelled = true;
    };
  }, [docId, isDraftReady, draftIcon]);

  /**
   * When Create a new Document syncs into docsStore while this folder is open,
   * pull only *new* linked titles into the draft — never remarge removals.
   * Also realign owner-bundle order after left-panel document reorder.
   */
  useEffect(() => {
    if (!doc || !isDraftReady) return;

    const storeBlocks = normalizeDocBlocks(
      doc.blocks?.length ? doc.blocks : docBlocksFromBody(doc.body ?? doc.content ?? ""),
    );
    const storeOwnerOrder = linkedOwnerNodeIdsInOrder(storeBlocks);
    const storeLinkedKey = storeOwnerOrder.join("|");
    if (storeLinkedKey === storeLinkedNodeIdsKeyRef.current) return;

    const prevIds = new Set(
      storeLinkedNodeIdsKeyRef.current
        ? storeLinkedNodeIdsKeyRef.current.split("|").filter(Boolean)
        : [],
    );
    const hasNewLinkedIds = storeOwnerOrder.some((id) => !prevIds.has(id));
    storeLinkedNodeIdsKeyRef.current = storeLinkedKey;

    let nextBlocks = draftBlocksRef.current;

    if (!hasNewLinkedIds) {
      // Panel delete purged the node — strip leftover title layers from the open draft.
      const nodesById = useNodesStore.getState().nodes;
      let pruned = nextBlocks;
      for (const block of nextBlocks) {
        if (!block?.nodeId || nodesById[block.nodeId]) continue;
        pruned = removeLinkedOwnerBundleFromBlocks(pruned, block.nodeId).blocks;
      }
      nextBlocks = pruned;
    } else {
      nextBlocks = mergeMissingLinkedOwnerBundles(nextBlocks, storeBlocks);
    }

    if (storeOwnerOrder.length) {
      nextBlocks = reorderLinkedOwnerBundlesInBlocks(nextBlocks, storeOwnerOrder);
    }

    if (JSON.stringify(nextBlocks) === JSON.stringify(draftBlocksRef.current)) return;

    setDraftBlocks(nextBlocks);
    setInitialSnapshot((prev) => {
      if (!prev) return prev;
      const next = { ...prev, blocks: nextBlocks };
      docSnapshotRef.current = JSON.stringify(next);
      return next;
    });
  }, [doc, doc?.blocks, isDraftReady]);

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

  const handleDraftBlocksChange = useCallback((next) => {
    const prev = draftBlocksRef.current;
    const prevIds = new Set(prev.filter((b) => b?.nodeId).map((b) => b.nodeId));
    const nextIds = new Set(next.filter((b) => b?.nodeId).map((b) => b.nodeId));
    const removedIds = [...prevIds].filter((id) => !nextIds.has(id));

    setDraftBlocks(next);

    if (!doc?.id || removedIds.length === 0) return;

    // Persist folder removals so store does not remarge deleted titles.
    // Keep parentDocId — unlink from body must not drop left-panel membership.
    for (const nodeId of removedIds) {
      updateNode(nodeId, {
        sourceBlockId: undefined,
        sourceTextBlockId: undefined,
        parentDocId: doc.id,
        linkedToDoc: true,
      });
      useDocsStore.getState().addNodeToDoc(doc.id, nodeId);
    }
    updateDoc(doc.id, { blocks: next });
    storeLinkedNodeIdsKeyRef.current = linkedOwnerNodeIdsInOrder(next).join("|");
    setInitialSnapshot((prev) => {
      if (!prev) return prev;
      const aligned = { ...prev, blocks: next };
      docSnapshotRef.current = JSON.stringify(aligned);
      return aligned;
    });
  }, [doc?.id, updateDoc, updateNode]);

  useEffect(() => {
    if (!docId || !isDraftReady) return undefined;
    const persistDraft = () => {
      if (skipDraftPersistRef.current) return;
      if (!docIsDirtyRef.current) {
        useUIStateStore.getState().clearDocEditorDraft(docId);
        return;
      }
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
          icon: draftIcon,
          departmentId: draftDepartmentId,
          launchDate: draftLaunchDate,
          scheduleStartDate: draftScheduleStartDate,
          scheduleFinishDate: draftScheduleFinishDate,
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
    draftDepartmentId,
    draftIcon,
    draftLaunchDate,
    draftScheduleStartDate,
    draftScheduleFinishDate,
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
    const scheduleStartAt = draftScheduleStartDate
      ? isoFromDateInput(draftScheduleStartDate)
      : null;
    const launchFromField = draftLaunchDate
      ? isoFromDateInput(draftLaunchDate)
      : null;
    // Campaign folders: Launch on child docs only. Content: Schedule may mirror launchAt.
    const launchAt = draftCampaignActive
      ? null
      : (scheduleStartAt || launchFromField);
    useUIStateStore.getState().setActiveDocMetaDraft({
      docId,
      version: draftVersion,
      category: draftCategory,
      launchAt,
      scheduleStartAt,
      scheduleFinishAt: draftScheduleFinishDate
        ? isoFromDateInput(draftScheduleFinishDate)
        : null,
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
    draftScheduleStartDate,
    draftScheduleFinishDate,
    draftCampaignActive,
    draftSubcategoryDocIds,
    draftParentId,
  ]);

  // Campaign folders do not own Launch (child docs do). Content may mirror Schedule.
  const draftLaunchAt = resolvePersistLaunchAt(
    draftCampaignActive,
    draftScheduleStartDate,
    draftLaunchDate,
  );
  const draftScheduleStartAt = draftScheduleStartDate
    ? isoFromDateInput(draftScheduleStartDate)
    : null;
  const draftScheduleFinishAt = draftScheduleFinishDate
    ? isoFromDateInput(draftScheduleFinishDate)
    : null;

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
      icon: draftIcon,
      departmentId: draftDepartmentId,
      launchAt: draftLaunchAt,
      scheduleStartAt: draftScheduleStartAt,
      scheduleFinishAt: draftScheduleFinishAt,
      campaignActive: draftCampaignActive,
      parentObjectId: draftParentId,
      nodeLinkColor: draftNodeLinkColor,
      docKind: draftDocKind,
      templateKind: draftTemplateKind,
      subcategoryDocIds: draftSubcategoryDocIds,
      knowledgeImport: draftKnowledgeImport,
    });
    const nextSerialized = JSON.stringify(nextSnapshot);
    return snap !== nextSerialized;
  }, [
    draftTitle,
    draftBlocks,
    draftBody,
    draftCreatedDate,
    draftVersion,
    draftCategory,
    draftIcon,
    draftDepartmentId,
    draftLaunchAt,
    draftScheduleStartAt,
    draftScheduleFinishAt,
    draftCampaignActive,
    draftParentId,
    draftNodeLinkColor,
    draftDocKind,
    draftTemplateKind,
    draftSubcategoryDocIds,
    draftKnowledgeImport,
  ]);

  const hasUnsavedChanges = hasUnsavedDocChanges();
  docIsDirtyRef.current = hasUnsavedChanges;

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
    icon: draftIcon,
    departmentId: draftDepartmentId,
    launchAt: draftLaunchAt,
    scheduleStartAt: draftScheduleStartAt,
    scheduleFinishAt: draftScheduleFinishAt,
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
  const useFolderSchedule = isContentMode && !draftCampaignActive;
  const scheduleStartMin = useFolderSchedule
    ? folderSchedulePickerMinDateInput()
    : todayDateInputValue();
  /** Products: title and category mirror each other. Content folders: title is free; category is department subcategory. */
  const syncTitleWithCategory = isProductMode;

  const alertFolderScheduleError = async (check) => {
    if (!check || check.ok) return;
    let message = t("meta.scheduleInvalid");
    let hint = "";
    if (check.code === "required" || check.code === "partial") {
      message = t("meta.schedulePartial");
      hint = t("meta.schedulePartialHint");
    } else if (check.code === "finishBeforeStart") {
      message = t("meta.scheduleFinishBeforeStart");
    } else if (check.code === "overlap") {
      const until = check.conflict?.finish
        ? formatMmDdYy(check.conflict.finish.toISOString())
        : "";
      message = t("meta.scheduleOverlap", {
        title: check.conflict?.title || "Folder",
        until,
        minStart: formatMmDdYy(check.minStart || scheduleStartMin)
          || check.minStart
          || scheduleStartMin,
      });
    }
    await askConfirm({
      title: t("meta.scheduleTitle"),
      message,
      hint,
      confirmLabel: t("common.ok"),
      tone: "default",
      hideCancel: true,
    });
  };

  const runChildScheduleResetIfRangeChanged = (prevStart, prevFinish, nextStart, nextFinish, opts = {}) => {
    if (!doc?.id) return;
    const nextEmpty = !String(nextStart || "").trim() && !String(nextFinish || "").trim();
    const prevEmpty = !String(prevStart || "").trim() && !String(prevFinish || "").trim();
    // Clear (empty frame) or any Start/Finish change → reset child dates/hours.
    const shouldReset = Boolean(opts.force)
      || (nextEmpty && !prevEmpty)
      || folderScheduleRangeChanged(
        { start: prevStart, finish: prevFinish },
        { start: nextStart, finish: nextFinish },
      );
    if (!shouldReset) return;

    const nodesStore = useNodesStore.getState();
    const docsStore = useDocsStore.getState();
    const cleared = resetNonReservedChildrenForFolderScheduleChange(doc.id, {
      getDoc: (id) => docsStore.getDoc?.(id) ?? docsStore.docs?.[id] ?? null,
      updateDoc: (id, patch) => docsStore.updateDoc(id, patch),
      getNodesByDoc: (id) => nodesStore.getNodesByDoc?.(id)
        ?? Object.values(nodesStore.nodes || {}).filter((n) => n.parentDocId === id),
      updateNode: (id, patch) => nodesStore.updateNode(id, patch),
    });
    if (cleared <= 0) return;
    const fresh = useDocsStore.getState().getDoc?.(doc.id)
      ?? useDocsStore.getState().docs?.[doc.id];
    if (Array.isArray(fresh?.blocks)) {
      setDraftBlocks(normalizeDocBlocks(fresh.blocks));
    }
    // If the open child modal was reset, drop its draft schedule/status.
    const openId = activeNodeContext?.nodeId;
    if (openId) {
      const live = useNodesStore.getState().nodes?.[openId];
      if (live && live.status == null && !live.anchorAt) {
        setNodeDraftAnchorDate("");
        setNodeDraftAnchorTime("");
        setNodeDraftAnchorFinishTime("");
        setNodeDraftStatus(null);
        setNodeDraftCompleted(false);
      }
    }
  };

  const persistFolderScheduleToStore = (startInput, finishInput) => {
    const liveDoc = useDocsStore.getState().getDoc?.(doc.id)
      ?? useDocsStore.getState().docs?.[doc.id]
      ?? doc;
    const prevStart = launchDateInputFromIso(liveDoc?.scheduleStartAt);
    const prevFinish = launchDateInputFromIso(liveDoc?.scheduleFinishAt);
    const startAt = startInput ? isoFromDateInput(startInput) : null;
    const finishAt = finishInput ? isoFromDateInput(finishInput) : null;
    // #region agent log
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'A',location:'DocExpandedView.jsx:persistFolderScheduleToStore',message:'Folder schedule persist (clear or set)',data:{docId:doc.id,title:liveDoc?.title||doc.title,startInput,finishInput,prevStartAt:liveDoc?.scheduleStartAt||null,prevFinishAt:liveDoc?.scheduleFinishAt||null,prevLaunchAt:liveDoc?.launchAt||null,nextStartAt:startAt,nextFinishAt:finishAt,isClear:!startAt&&!finishAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    updateDoc(doc.id, {
      scheduleStartAt: startAt,
      scheduleFinishAt: finishAt,
      // Clear Launch together with Schedule so normalize cannot resurrect the frame.
      launchAt: startAt,
    });
    // #region agent log
    {
      const after = useDocsStore.getState().docs?.[doc.id];
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'A',location:'DocExpandedView.jsx:persistFolderScheduleToStore:afterUpdate',message:'Store after schedule updateDoc+normalize',data:{docId:doc.id,afterStartAt:after?.scheduleStartAt||null,afterFinishAt:after?.scheduleFinishAt||null,afterLaunchAt:after?.launchAt||null,resurrected:Boolean(!startAt&&!finishAt&&(after?.scheduleStartAt||after?.scheduleFinishAt||after?.launchAt))},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    runChildScheduleResetIfRangeChanged(
      prevStart,
      prevFinish,
      startInput || "",
      finishInput || "",
      { force: !startAt && !finishAt },
    );
  };

  /** Content folders: persist title into docsStore so the left panel updates live (category stays independent). */
  const persistFolderTitleToStore = (nextTitle) => {
    if (!isContentMode || !doc?.id) return;
    const title = String(nextTitle ?? "").trim();
    if (!title) return;
    updateDoc(doc.id, { title });
    setInitialSnapshot((prev) => {
      if (!prev) return prev;
      const next = { ...prev, title };
      docSnapshotRef.current = JSON.stringify(next);
      return next;
    });
  };

  const persistFolderCategoryToStore = (nextCategory, nextDepartmentId) => {
    if (!isContentMode || !doc?.id) return;
    const category = String(nextCategory ?? "").trim();
    const departmentId = typeof nextDepartmentId === "string" && nextDepartmentId.trim()
      ? nextDepartmentId.trim()
      : null;
    updateDoc(doc.id, { category, departmentId });
    setInitialSnapshot((prev) => {
      if (!prev) return prev;
      const next = { ...prev, category, departmentId };
      docSnapshotRef.current = JSON.stringify(next);
      return next;
    });
  };

  const handleScheduleStartDateChange = async (value) => {
    if (!value) {
      setDraftScheduleStartDate("");
      setDraftScheduleFinishDate("");
      setDraftLaunchDate("");
      persistFolderScheduleToStore("", "");
      return;
    }
    const minStart = scheduleStartMin || todayDateInputValue();
    const clamped = value < minStart ? minStart : value;
    const finish = draftScheduleFinishDate && draftScheduleFinishDate >= clamped
      ? draftScheduleFinishDate
      : clamped;
    const check = validateFolderSchedule(
      clamped,
      finish,
      allDocs,
      draftParentId,
      { excludeDocId: docId },
    );
    if (!check.ok) {
      await alertFolderScheduleError(check);
      return;
    }
    setDraftScheduleStartDate(clamped);
    setDraftScheduleFinishDate(finish);
    setDraftLaunchDate(clamped);
    persistFolderScheduleToStore(clamped, finish);
  };

  const handleScheduleFinishDateChange = async (value) => {
    if (!value) {
      setDraftScheduleFinishDate("");
      persistFolderScheduleToStore(draftScheduleStartDate, "");
      return;
    }
    const start = draftScheduleStartDate || value;
    const finish = value < start ? start : value;
    const check = validateFolderSchedule(
      start,
      finish,
      allDocs,
      draftParentId,
      { excludeDocId: docId },
    );
    if (!check.ok) {
      await alertFolderScheduleError(check);
      return;
    }
    if (!draftScheduleStartDate) {
      setDraftScheduleStartDate(start);
      setDraftLaunchDate(start);
    }
    setDraftScheduleFinishDate(finish);
    persistFolderScheduleToStore(start, finish);
  };

  const handleScheduleDatesClear = () => {
    setDraftScheduleStartDate("");
    setDraftScheduleFinishDate("");
    setDraftLaunchDate("");
    persistFolderScheduleToStore("", "");
  };

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

  const handleSave = async () => {
    const title = resolvePersistTitle({
      draftTitle,
      draftCategory,
      draftVersion,
      draftDocKind,
      draftSubcategoryDocIds,
    }).trim() || "New document";

    let blocksToSave = draftBlocks;
    const storeDoc = useDocsStore.getState().getDoc(doc.id);
    const prevFolderScheduleStart = launchDateInputFromIso(storeDoc?.scheduleStartAt);
    const prevFolderScheduleFinish = launchDateInputFromIso(storeDoc?.scheduleFinishAt);
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
      ? draftCategory.trim()
      : draftCategory;

    if (useFolderSchedule) {
      const check = validateFolderSchedule(
        draftScheduleStartDate,
        draftScheduleFinishDate,
        allDocs,
        draftParentId,
        { excludeDocId: docId },
      );
      if (!check.ok) {
        await alertFolderScheduleError(check);
        return;
      }
    }

    const savedSnapshot = buildDocPersistSnapshot({
      title,
      blocks: blocksToSave,
      body: draftBody || docBlocksToBody(blocksToSave) || storeDoc?.body || storeDoc?.content || "",
      createdDate: draftCreatedDate,
      version: draftVersion,
      category: categoryToSave,
      icon: isContentMode ? (draftIcon || "") : "",
      departmentId: isContentMode ? draftDepartmentId : null,
      launchAt: draftLaunchAt,
      // Campaign Launch is research metadata, not a Schedule reservation.
      scheduleStartAt: useFolderSchedule ? draftScheduleStartAt : null,
      scheduleFinishAt: useFolderSchedule ? draftScheduleFinishAt : null,
      campaignActive: draftCampaignActive,
      parentObjectId: isKnowledgeMode ? "" : draftParentId,
      nodeLinkColor: draftNodeLinkColor,
      docKind: draftDocKind,
      templateKind: draftTemplateKind,
      subcategoryDocIds: draftSubcategoryDocIds,
      knowledgeImport: draftKnowledgeImport,
    });
    updateDoc(doc.id, {
      title,
      blocks: savedSnapshot.blocks,
      content: savedSnapshot.body,
      body: savedSnapshot.body,
      // Created is immutable after the folder exists — never rewrite from the draft.
      createdAt: doc.createdAt || savedSnapshot.createdAt,
      version: savedSnapshot.version,
      category: savedSnapshot.category,
      icon: savedSnapshot.icon,
      departmentId: savedSnapshot.departmentId,
      launchAt: savedSnapshot.launchAt,
      scheduleStartAt: savedSnapshot.scheduleStartAt,
      scheduleFinishAt: savedSnapshot.scheduleFinishAt,
      campaignActive: savedSnapshot.campaignActive,
      nodeLinkColor: savedSnapshot.nodeLinkColor,
      docKind: savedSnapshot.docKind,
      templateKind: savedSnapshot.templateKind,
      subcategoryDocIds: savedSnapshot.subcategoryDocIds,
      templateSubcategoryDocIds: savedSnapshot.templateSubcategoryDocIds,
      knowledgeImport: savedSnapshot.knowledgeImport,
    });
    let finalSnapshot = savedSnapshot;
    if (useFolderSchedule) {
      runChildScheduleResetIfRangeChanged(
        prevFolderScheduleStart,
        prevFolderScheduleFinish,
        draftScheduleStartDate,
        draftScheduleFinishDate,
      );
      // Prefer store blocks after child schedule reset (cleared anchors).
      const afterReset = useDocsStore.getState().getDoc(doc.id);
      if (Array.isArray(afterReset?.blocks)) {
        const clearedBlocks = normalizeDocBlocks(afterReset.blocks);
        setDraftBlocks(clearedBlocks);
        finalSnapshot = {
          ...savedSnapshot,
          blocks: clearedBlocks,
          body: draftBody || docBlocksToBody(clearedBlocks) || savedSnapshot.body,
        };
      }
    }
    if (isKnowledgeMode) {
      if (doc.parentObjectId) linkDocToObject(doc.id, null);
    } else if ((doc.parentObjectId ?? "") !== (draftParentId || "")) {
      linkDocToObject(doc.id, draftParentId || null);
    }
    setInitialSnapshot(finalSnapshot);
    docSnapshotRef.current = JSON.stringify(finalSnapshot);
    docIsDirtyRef.current = false;
    useUIStateStore.getState().clearDocEditorDraft(doc.id);
    onAfterDocSave?.(doc.id, finalSnapshot.blocks);
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
      icon: isContentMode ? (draftIcon || "") : "",
      launchAt: draftLaunchAt,
      scheduleStartAt: draftScheduleStartAt,
      scheduleFinishAt: draftScheduleFinishAt,
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
    setNodeDraftAnchorFinishTime("");
    setNodeDraftCompleted(false);
    setNodeDraftStatus(null);
    setNodeDraftCampaignStatus(CAMPAIGN_DOC_STATUS_INACTIVE);
    setNodeDraftAnnounceDate("");
    setNodeDraftSubcategory("");
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
      || String(activeNodeContext.query || "").trim() !== String(nodeInitialSnapshot.query || "").trim()
      || nodeDraftAnchorDate !== nodeInitialSnapshot.anchorDate
      || nodeDraftAnchorTime !== nodeInitialSnapshot.anchorTime
      || (nodeDraftAnchorFinishTime || "") !== (nodeInitialSnapshot.anchorFinishTime || "")
      || normalizeCampaignDocStatus(nodeDraftCampaignStatus)
        !== normalizeCampaignDocStatus(nodeInitialSnapshot.campaignStatus)
      || (nodeDraftAnnounceDate || "") !== (nodeInitialSnapshot.announceDate || "")
      || (nodeDraftSubcategory || "") !== (nodeInitialSnapshot.subcategory || "")
      || (nodeDraftSourceId || null) !== (nodeInitialSnapshot.sourceId || null)
    );
  };

  const childNodeScheduleIncomplete = () => false;

  /** Schedule on child docs is optional — even under a folder reservation. */
  const ensureChildScheduleOrRemind = async () => true;

  const restoreNodeContentFromSnapshot = (normalized, dataType) => {
    if (normalized == null) return "";
    if (typeof normalized !== "string") return normalized;
    const trimmed = normalized.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(normalized);
      } catch {
        /* keep string */
      }
    }
    if (dataType === NODE_DATA_TYPES.CHECKBOX && (normalized === "true" || normalized === "false")) {
      return normalized === "true";
    }
    return normalized;
  };

  /** Drop draft + undo autosave/live writes so close & not save leaves no edits. */
  const discardNodeModalWithoutSave = () => {
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }

    const context = activeNodeContext;
    const snap = nodeInitialSnapshotRef.current;
    if (context && snap) {
      const { blockIndex, nodeId, dataType, blockType } = context;
      const restoredContent = restoreNodeContentFromSnapshot(snap.content, dataType);
      const restoredCompleted = Boolean(snap.completed);
      const restoredStatus = snap.status ?? (restoredCompleted ? "completed" : null);
      const restoredSourceId = snap.sourceId || null;
      const restoredAnchorDate = snap.anchorDate || "";
      const restoredAnchorTime = snap.anchorTime || "";
      const restoredAnchorFinishTime = snap.anchorFinishTime || "";
      const canSchedule = dataType === NODE_DATA_TYPES.TEXT
        || dataType === NODE_DATA_TYPES.CHECKBOX;
      const restoredAnchorAt = canSchedule
        ? isoFromAnchorFields(restoredAnchorDate, restoredAnchorTime)
        : undefined;
      const restoredAnchorFinishAt = canSchedule
        ? isoFromAnchorFields(restoredAnchorDate, restoredAnchorFinishTime)
        : undefined;

      const restoredQuery = String(snap.query || "").trim();

      if (nodeId) {
        updateNode(nodeId, {
          content: restoredContent,
          status: restoredStatus,
          completed: restoredCompleted,
          sourceId: restoredSourceId,
          ...(restoredQuery ? { title: restoredQuery, sourceQuery: restoredQuery } : {}),
          ...(restoredAnchorAt !== undefined ? { anchorAt: restoredAnchorAt } : {}),
          ...(restoredAnchorFinishAt !== undefined ? { anchorFinishAt: restoredAnchorFinishAt } : {}),
        });
        syncNodeToParentDoc(nodeId, doc.id);
      }

      const block = draftBlocks[blockIndex];
      if (block && block.type === blockType) {
        let nextBlocks = draftBlocks;
        if (restoredQuery) {
          const titlePatch = { sourceQuery: restoredQuery };
          if (
            block.type === DOC_BLOCK_TYPES.H1
            || block.type === DOC_BLOCK_TYPES.DATE
            || block.type === DOC_BLOCK_TYPES.METRIC
          ) {
            titlePatch.title = restoredQuery;
          }
          if (block.type === DOC_BLOCK_TYPES.TODO) {
            titlePatch.listTitle = restoredQuery;
          }
          nextBlocks = updateBlockAt(nextBlocks, blockIndex, titlePatch);
        }
        if (shouldMirrorNodeContentInDoc(block)) {
          nextBlocks = setContentForNodeBlock(
            nextBlocks,
            blockIndex,
            restoredContent,
            dataType,
          );
          if (dataType === NODE_DATA_TYPES.TEXT) {
            nextBlocks = setAnswerBelowH1(
              nextBlocks,
              blockIndex,
              typeof restoredContent === "string" ? restoredContent : "",
            );
          }
        }
        if (canSchedule) {
          nextBlocks = updateBlockAt(nextBlocks, blockIndex, {
            anchorDate: restoredAnchorDate,
            anchorTime: restoredAnchorTime,
            anchorFinishTime: restoredAnchorFinishTime,
            anchorFromNode: Boolean(String(restoredAnchorDate || "").trim()),
          });
        }
        if (nextBlocks !== draftBlocks) {
          setDraftBlocks(nextBlocks);
          const body = docBlocksToBody(nextBlocks);
          updateDoc(doc.id, {
            blocks: nextBlocks,
            body,
            content: body,
          });
        }
      }
    }

    resetNodeModalState();
  };

  const handleRequestCloseNodeModal = async () => {
    const gate = await ensureChildScheduleOrRemind();
    if (gate === "stay") return;
    if (gate === "discard") {
      discardNodeModalWithoutSave();
      return;
    }
    if (hasNodeUnsavedChanges()) {
      setShowNodeUnsavedConfirm(true);
      return;
    }
    discardNodeModalWithoutSave();
  };

  const flushAndCloseNodeModal = async ({ withMarkLoader = false } = {}) => {
    const gate = await ensureChildScheduleOrRemind();
    if (gate === "stay") return;
    if (gate === "discard") {
      discardNodeModalWithoutSave();
      return;
    }
    if (!activeNodeContext) {
      resetNodeModalState();
      return;
    }
    if (draftCampaignActive) {
      const child = buildCampaignChildScheduleFields({
        announceDate: nodeDraftAnnounceDate,
        launchDate: nodeDraftAnchorDate,
        launchTime: nodeDraftAnchorTime,
        subcategory: nodeDraftSubcategory,
      });
      if (!child.ok) {
        await askConfirm({
          title: t("sidebar.campaignDocDateStart"),
          message: t("sidebar.campaignDateStartAfterLaunch"),
          confirmLabel: t("common.ok"),
          tone: "default",
          hideCancel: true,
        });
        return;
      }
    }

    const runFlush = () => {
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
        nodeDraftAnchorFinishTime,
          {
            commitSchedule: draftCampaignActive
              || Boolean(String(nodeDraftAnchorDate || "").trim()),
          },
        );
        const savedBlocks = useDocsStore.getState().docs[doc.id]?.blocks;
        onAfterDocSave?.(doc.id, savedBlocks);
      }
      resetNodeModalState();
    };

    if (!withMarkLoader) {
      runFlush();
      return;
    }

    setIsSavingNode(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, NODE_SAVE_LOADING_MIN_MS);
      });
      runFlush();
    } finally {
      setIsSavingNode(false);
    }
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

  const handleBlockAnchorChange = (blockIndex, anchorDate, anchorTime, anchorFinishTime = "") => {
    setDraftBlocks((prev) => {
      const next = updateBlockAt(prev, blockIndex, {
        anchorDate,
        anchorTime,
        anchorFinishTime,
        anchorFromNode: Boolean(String(anchorDate || "").trim()),
      });
      const block = next[blockIndex];
      if (block?.nodeId) {
        updateNode(block.nodeId, {
          anchorAt: isoFromAnchorFields(anchorDate, anchorTime),
          anchorFinishAt: isoFromAnchorFields(anchorDate, anchorFinishTime),
        });
      }
      if (
        activeNodeContext?.blockIndex === blockIndex
        && (activeNodeContext.dataType === NODE_DATA_TYPES.TEXT
          || activeNodeContext.dataType === NODE_DATA_TYPES.CHECKBOX)
      ) {
        setNodeDraftAnchorDate(anchorDate);
        setNodeDraftAnchorTime(anchorTime);
        setNodeDraftAnchorFinishTime(anchorFinishTime);
      }
      // Persist Schedule into docsStore immediately so remount/tab switch keeps it.
      if (doc?.id) {
        const body = docBlocksToBody(next);
        updateDoc(doc.id, {
          blocks: next,
          body,
          content: body,
        });
        const canvasSnap = useUIStateStore.getState().canvasSearchSnapshot;
        useTimelineStore.getState().refreshTimelineDocSnapshot(doc.id, {
          canvasNodes: canvasSnap?.nodes || [],
          connections: canvasSnap?.connections || [],
          docsById: useDocsStore.getState().docs,
          nodeEntitiesById: useNodesStore.getState().nodes,
        });
      }
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

    // Remove title + Description layers from the folder body, but keep the
    // document entity so it still appears under the folder in the left panel.
    const { blocks: next } = removeLinkedOwnerBundleFromBlocks(draftBlocks, nodeId);
    setDraftBlocks(next);
    updateDoc(doc.id, { blocks: next });
    updateNode(nodeId, {
      sourceBlockId: undefined,
      sourceTextBlockId: undefined,
      parentDocId: doc.id,
      linkedToDoc: true,
    });
    useDocsStore.getState().addNodeToDoc(doc.id, nodeId);
    storeLinkedNodeIdsKeyRef.current = linkedOwnerNodeIdsInOrder(next).join("|");

    // Align dirty baseline so close/Yes does not treat unlink as a stale save wipe.
    setInitialSnapshot((prev) => {
      if (!prev) return prev;
      const aligned = { ...prev, blocks: next };
      docSnapshotRef.current = JSON.stringify(aligned);
      return aligned;
    });

    if (activeNodeContext?.nodeId === nodeId) {
      setActiveNodeContext(null);
      setNodeDraftContent("");
      setNodeDraftAnchorDate("");
      setNodeDraftAnchorTime("");
      setNodeDraftAnchorFinishTime("");
      setNodeInitialSnapshot(null);
    }
  };

  const persistNodeContentDebounced = (
    content,
    context,
    anchorDate,
    anchorTime,
    anchorFinishTime,
    options = {},
  ) => {
    const { commitSchedule = false } = options;
    // Body always persists — isNoNodeLinkMode only affects the color-link handle UI,
    // not whether node.content may be written (inside-folder Create a document).
    const { blockId, blockIndex, nodeId, query, dataType, blockType } = context;
    const block = draftBlocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = (query || "").trim() || getBlockQueryText(block) || "Untitled query";
    // Only Yes/flush may write schedule. Autosave must not pass null and wipe anchorAt.
    // Persist when folder is reserved or doc status is reserved; otherwise clear.
    const scheduleDate = String(anchorDate || "").trim();
    const folderProbe = {
      campaignActive: draftCampaignActive,
      scheduleStartAt: draftScheduleStartAt,
      scheduleFinishAt: draftScheduleFinishAt,
    };
    const folderReserved = isContentMode
      && !draftCampaignActive
      && isFolderScheduleReserved(folderProbe);
    const canWriteSchedule = supportsScheduleAnchor(dataType)
      && (folderReserved || nodeDraftStatus === DOC_WORK_STATUS.RESERVED);
    const anchorAt = commitSchedule && supportsScheduleAnchor(dataType)
      ? (canWriteSchedule && scheduleDate
        ? isoFromAnchorFields(scheduleDate, anchorTime)
        : null)
      : undefined;
    const anchorFinishAt = commitSchedule && supportsScheduleAnchor(dataType)
      ? (canWriteSchedule && scheduleDate
        ? isoFromAnchorFields(scheduleDate, anchorFinishTime)
        : null)
      : undefined;

    const contentForStorage = dataType === NODE_DATA_TYPES.TEXT
      ? nodeDraftContentForStorage(content, dataType)
      : content;

    let scheduleStatus = nodeDraftStatus;
    if (!draftCampaignActive && commitSchedule) {
      const hasCompleteSchedule = Boolean(
        canWriteSchedule
        && scheduleDate
        && String(anchorTime || "").trim()
        && String(anchorFinishTime || "").trim()
        && anchorAt
        && anchorFinishAt,
      );
      const docDateInFolderFrame = folderReserved
        && isDateInputWithinFolderSchedule(scheduleDate, folderProbe);
      const autoNotStarted = defaultStatusAfterScheduleSave({
        status: scheduleStatus,
        hasCompleteSchedule,
        docDateInFolderFrame,
      });
      if (autoNotStarted) scheduleStatus = autoNotStarted;
    }

    const savedNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId: doc.id,
      blockId,
      query: queryText,
      content: contentForStorage,
      dataType,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
      ...(anchorAt !== undefined && !draftCampaignActive ? { anchorAt } : {}),
      ...(anchorFinishAt !== undefined && !draftCampaignActive ? { anchorFinishAt } : {}),
      ...(draftCampaignActive
        ? { status: null, completed: false }
        : commitSchedule && (scheduleStatus != null || nodeDraftCompleted)
          ? {
            status: scheduleStatus,
            completed: scheduleStatus === DOC_WORK_STATUS.COMPLETED,
          }
          : {}),
      sourceId: nodeDraftSourceId,
    });

    if (!draftCampaignActive && savedNodeId) {
      const live = useNodesStore.getState().nodes[savedNodeId];
      const liveStatus = resolveDocWorkStatus(live);
      if (liveStatus !== nodeDraftStatus) {
        setNodeDraftStatus(liveStatus);
        setNodeDraftCompleted(liveStatus === "completed");
      }
    }

    if (draftCampaignActive && savedNodeId) {
      const child = buildCampaignChildScheduleFields({
        announceDate: nodeDraftAnnounceDate,
        launchDate: String(anchorDate || "").trim(),
        launchTime: anchorTime,
        subcategory: nodeDraftSubcategory,
      });
      updateNode(savedNodeId, {
        campaignStatus: normalizeCampaignDocStatus(nodeDraftCampaignStatus),
        completed: false,
        status: null,
        ...(commitSchedule && child.ok
          ? {
            windowStartAt: child.windowStartAt,
            launchAt: child.launchAt,
            windowEndAt: child.windowEndAt,
            subcategory: child.subcategory,
          }
          : {}),
      });
    }

    if ((nodeId || block.nodeId) !== savedNodeId) {
      setActiveNodeContext((prev) => (prev ? { ...prev, nodeId: savedNodeId } : prev));
    }

    const patch = {
      nodeId: savedNodeId,
      sourceQuery: queryText,
    };
    if (block.type === DOC_BLOCK_TYPES.H1 || block.type === DOC_BLOCK_TYPES.DATE || block.type === DOC_BLOCK_TYPES.METRIC) {
      patch.title = queryText;
    }
    if (block.type === DOC_BLOCK_TYPES.TODO) {
      patch.listTitle = queryText;
    }
    if (commitSchedule && supportsScheduleAnchor(dataType)) {
      patch.anchorDate = anchorDate;
      patch.anchorTime = anchorTime;
      patch.anchorFinishTime = anchorFinishTime;
      patch.anchorFromNode = Boolean(anchorDate);
      patch.queryEnabled = true;
    }

    let nextBlocks = updateBlockAt(draftBlocks, blockIndex, patch);
    if (shouldMirrorNodeContentInDoc(block)) {
      nextBlocks = setContentForNodeBlock(nextBlocks, blockIndex, contentForStorage, dataType);
      if (dataType === NODE_DATA_TYPES.TEXT) {
        nextBlocks = setAnswerBelowH1(
          nextBlocks,
          blockIndex,
          typeof contentForStorage === "string" ? contentForStorage : "",
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
    // Refresh Description / excerpt under the H1 in the open folder.
    if (savedNodeId) syncNodeToParentDoc(savedNodeId, doc.id);

    // Only intentional Save/flush advances the discard baseline.
    // Autosave must leave the open snapshot alone so "close & not save" can revert.
    if (commitSchedule) {
      const snap = {
        content: normalizeNodeContent(contentForStorage),
        query: queryText,
        anchorDate: anchorDate || "",
        anchorTime: anchorTime || "",
        anchorFinishTime: anchorFinishTime || "",
        completed: Boolean(nodeDraftCompleted),
        status: nodeDraftStatus || null,
        campaignStatus: nodeDraftCampaignStatus,
        sourceId: nodeDraftSourceId || null,
        announceDate: nodeDraftAnnounceDate || "",
        subcategory: nodeDraftSubcategory || "",
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
      const canvasSnap = useUIStateStore.getState().canvasSearchSnapshot;
      useTimelineStore.getState().refreshTimelineDocSnapshot(doc.id, {
        canvasNodes: canvasSnap?.nodes || [],
        connections: canvasSnap?.connections || [],
        docsById: useDocsStore.getState().docs,
        nodeEntitiesById: useNodesStore.getState().nodes,
      });
    }
  };

  const handleQueryChange = (nextQuery) => {
    setActiveNodeContext((prev) => (prev ? { ...prev, query: nextQuery } : prev));
    const context = activeNodeContext;
    if (!context) return;
    const title = String(nextQuery ?? "").trim();
    if (!title) return;
    const { blockIndex, nodeId, blockType } = context;
    if (nodeId) {
      updateNode(nodeId, { title, sourceQuery: title });
      syncNodeToParentDoc(nodeId, doc.id);
    }
    const block = draftBlocks[blockIndex];
    if (!block || block.type !== blockType) return;
    const patch = { sourceQuery: title };
    if (
      block.type === DOC_BLOCK_TYPES.H1
      || block.type === DOC_BLOCK_TYPES.DATE
      || block.type === DOC_BLOCK_TYPES.METRIC
    ) {
      patch.title = title;
    }
    if (block.type === DOC_BLOCK_TYPES.TODO) {
      patch.listTitle = title;
    }
    const nextBlocks = updateBlockAt(draftBlocks, blockIndex, patch);
    setDraftBlocks(nextBlocks);
    const body = docBlocksToBody(nextBlocks);
    updateDoc(doc.id, {
      blocks: nextBlocks,
      body,
      content: body,
    });
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
      persistNodeContentDebounced(content, context, "", "", "", { commitSchedule: false });
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

    // Linked / Create-a-document bodies live on node.content (not mirrored in the folder).
    if (existing && (isDocBlockLinkedToNode(block) || block.macronodeHeading)) {
      blockContent = existing.content;
    } else if (block.type === DOC_BLOCK_TYPES.H1 && dataType === NODE_DATA_TYPES.TEXT) {
      const answer = getAnswerBelowH1(draftBlocks, blockIndex);
      if (answer.trim()) blockContent = answer;
    }

    const openedQuery = (
      (existing
        ? (existing.sourceQuery || existing.title || "")
        : ""
      ).trim()
      || getBlockQueryText(block)
    );

    setActiveNodeContext({
      blockId: block.id,
      blockIndex,
      blockType: block.type,
      nodeId: ensuredNodeId || block.nodeId || null,
      // Linked macronode title lives on the node entity — prefer it over a stale H1.
      query: openedQuery,
      dataType,
    });
    const resolvedNodeDraft = resolveNodeDraftFromDoc(blockContent, existing, dataType);
    setNodeDraftContent(resolvedNodeDraft);
    const folderProbe = {
      campaignActive: draftCampaignActive,
      scheduleStartAt: draftScheduleStartAt,
      scheduleFinishAt: draftScheduleFinishAt,
    };
    const folderReservedForStatus = isContentMode
      && !draftCampaignActive
      && isFolderScheduleReserved(folderProbe);
    const statusSanitize = !draftCampaignActive
      ? sanitizeDocStatusForFolderSchedule(existing, folderReservedForStatus)
      : null;
    if (statusSanitize && (ensuredNodeId || block.nodeId)) {
      updateNode(ensuredNodeId || block.nodeId, statusSanitize);
    }
    const openedStatus = statusSanitize ? null : resolveDocWorkStatus(existing);
    const openedCompleted = statusSanitize ? false : Boolean(existing?.completed);
    setNodeDraftCompleted(openedCompleted);
    setNodeDraftStatus(openedStatus);
    setNodeDraftCampaignStatus(
      normalizeCampaignDocStatus(existing?.campaignStatus ?? CAMPAIGN_DOC_STATUS_INACTIVE),
    );
    setNodeDraftSourceId(existing?.sourceId ?? null);
    const campaignChild = Boolean(draftCampaignActive);
    setNodeDraftSubcategory(
      typeof existing?.subcategory === "string"
        ? existing.subcategory
        : (typeof existing?.category === "string" ? existing.category : ""),
    );
    setNodeDraftAnnounceDate(campaignChild ? launchDateInputFromIso(existing?.windowStartAt) : "");
    // Campaign docs: Launch lives on node.launchAt. Content docs: Schedule on anchorAt.
    const launchOrAnchorIso = campaignChild
      ? (existing?.launchAt || null)
      : (existing?.anchorAt || null);
    if (launchOrAnchorIso) {
      const fromNode = anchorFieldsFromIso(launchOrAnchorIso);
      setNodeDraftAnchorDate(fromNode.anchorDate);
      setNodeDraftAnchorTime(fromNode.anchorTime);
      const fromFinish = anchorFieldsFromIso(existing?.anchorFinishAt || null);
      setNodeDraftAnchorFinishTime(fromFinish.anchorTime || "");
      const snap = {
        content: normalizeNodeContent(resolvedNodeDraft),
        query: openedQuery,
        anchorDate: fromNode.anchorDate,
        anchorTime: fromNode.anchorTime,
        anchorFinishTime: fromFinish.anchorTime || "",
        completed: openedCompleted,
        status: openedStatus,
        campaignStatus: normalizeCampaignDocStatus(
          existing?.campaignStatus ?? CAMPAIGN_DOC_STATUS_INACTIVE,
        ),
        sourceId: existing?.sourceId ?? null,
        announceDate: campaignChild ? launchDateInputFromIso(existing?.windowStartAt) : "",
        subcategory: typeof existing?.subcategory === "string"
          ? existing.subcategory
          : (typeof existing?.category === "string" ? existing.category : ""),
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
    } else if (!campaignChild) {
      const anchorFromBlock = resolveBlockAnchorFields(block, draftCreatedDate, {
        noNodeLink: isNoNodeLinkMode(resolveBlockNodeLinkColor(block)),
      });
      setNodeDraftAnchorDate(anchorFromBlock.anchorDate);
      setNodeDraftAnchorTime(anchorFromBlock.anchorTime);
      setNodeDraftAnchorFinishTime(anchorFromBlock.anchorFinishTime || "");
      const snap = {
        content: normalizeNodeContent(resolvedNodeDraft),
        query: openedQuery,
        anchorDate: anchorFromBlock.anchorDate,
        anchorTime: anchorFromBlock.anchorTime,
        anchorFinishTime: anchorFromBlock.anchorFinishTime || "",
        completed: openedCompleted,
        status: openedStatus,
        campaignStatus: CAMPAIGN_DOC_STATUS_INACTIVE,
        sourceId: existing?.sourceId ?? null,
        announceDate: campaignChild ? launchDateInputFromIso(existing?.windowStartAt) : "",
        subcategory: typeof existing?.subcategory === "string"
          ? existing.subcategory
          : (typeof existing?.category === "string" ? existing.category : ""),
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
    } else {
      setNodeDraftAnchorDate("");
      setNodeDraftAnchorTime("");
      setNodeDraftAnchorFinishTime("");
      const snap = {
        content: normalizeNodeContent(resolvedNodeDraft),
        query: openedQuery,
        anchorDate: "",
        anchorTime: "",
        anchorFinishTime: "",
        completed: false,
        status: openedStatus,
        campaignStatus: normalizeCampaignDocStatus(
          existing?.campaignStatus ?? CAMPAIGN_DOC_STATUS_INACTIVE,
        ),
        sourceId: existing?.sourceId ?? null,
        announceDate: campaignChild ? launchDateInputFromIso(existing?.windowStartAt) : "",
        subcategory: typeof existing?.subcategory === "string"
          ? existing.subcategory
          : (typeof existing?.category === "string" ? existing.category : ""),
      };
      setNodeInitialSnapshot(snap);
      nodeInitialSnapshotRef.current = snap;
    }
  };

  const supportsScheduleAnchor = (dataType) =>
    dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;

  const handleNodeAnchorDateChange = (anchorDate) => {
    const nextDate = String(anchorDate || "").trim();
    // Persist Schedule immediately — must survive tab switch; never wait for Yes.
    setNodeDraftAnchorDate(nextDate);
    const nextTime = nextDate ? nodeDraftAnchorTime : "";
    const nextFinish = nextDate ? nodeDraftAnchorFinishTime : "";
    if (!nextDate) {
      setNodeDraftAnchorTime("");
      setNodeDraftAnchorFinishTime("");
    }
    if (nextDate && nodeDraftStatus === DOC_WORK_STATUS.FLEXIBLE) {
      setNodeDraftStatus(null);
      setNodeDraftCompleted(false);
      const id = activeNodeContext?.nodeId;
      if (id) updateNode(id, { status: null, completed: false });
      setNodeInitialSnapshot((prev) => {
        if (!prev) return prev;
        const next = { ...prev, status: null, completed: false };
        nodeInitialSnapshotRef.current = next;
        return next;
      });
    }
    if (!activeNodeContext) return;
    handleBlockAnchorChange(
      activeNodeContext.blockIndex,
      nextDate,
      nextTime,
      nextFinish,
    );
  };

  const handleNodeAnchorTimeChange = (anchorTime) => {
    // Persist Schedule immediately — must survive tab switch; never wait for Yes.
    setNodeDraftAnchorTime(anchorTime);
    if (!activeNodeContext) return;
    handleBlockAnchorChange(
      activeNodeContext.blockIndex,
      nodeDraftAnchorDate,
      anchorTime,
      nodeDraftAnchorFinishTime,
    );
  };

  const handleNodeAnchorFinishTimeChange = (anchorFinishTime) => {
    setNodeDraftAnchorFinishTime(anchorFinishTime);
    if (!activeNodeContext) return;
    handleBlockAnchorChange(
      activeNodeContext.blockIndex,
      nodeDraftAnchorDate,
      nodeDraftAnchorTime,
      anchorFinishTime,
    );
  };

  const handleOpenNodeForH1 = (h1Index, h1Block) => handleOpenNodeForBlock(h1Index, h1Block);

  const handleNodeModalSave = () => {
    flushAndCloseNodeModal({ withMarkLoader: true });
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

  const folderScheduleProbe = {
    campaignActive: draftCampaignActive,
    scheduleStartAt: draftScheduleStartAt,
    scheduleFinishAt: draftScheduleFinishAt,
  };
  const folderScheduleReserved = useFolderSchedule && isFolderScheduleReserved(folderScheduleProbe);
  const folderFrameBounds = folderScheduleReserved
    ? folderScheduleDateInputBounds(folderScheduleProbe)
    : null;
  const docStatusReserved = nodeDraftStatus === DOC_WORK_STATUS.RESERVED;
  const childScheduleBounds = (folderScheduleReserved && !docStatusReserved)
    ? folderFrameBounds
    : null;

  const occupiedIntervals = listOccupiedIntervalsByDate(
    useNodesStore.getState().nodes,
    useDocsStore.getState().docs,
    nodeDraftAnchorDate,
    {
      excludeNodeId: activeNodeContext?.nodeId || null,
      objectId: draftParentId || null,
    },
  );
  const nodeScheduleOverlapHint = hasTimeframeOverlap(
    isoFromAnchorFields(nodeDraftAnchorDate, nodeDraftAnchorTime),
    isoFromAnchorFields(nodeDraftAnchorDate, nodeDraftAnchorFinishTime),
    occupiedIntervals,
  ) ? t("meta.scheduleOverlapHint") : "";

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
            if (isContentMode) persistFolderTitleToStore(v);
          }}
          titlePlaceholder={
            isProductMode
              ? "Product's name"
              : isKnowledgeMode
                ? "Document title"
                : draftCampaignActive
                  ? t("sidebar.campaignFolderTitlePlaceholder")
                : isContentMode
                  ? "Describe Folder"
                  : "Write your description"
          }
          body={draftBody}
          onBodyChange={(v) => {
            setDraftBody(v);
          }}
          blocks={draftBlocks}
          onBlocksChange={handleDraftBlocksChange}
          createdDate={draftCreatedDate}
          version={isTemplate ? "" : draftVersion}
          onVersionChange={isTemplate ? undefined : (v) => {
            setDraftVersion(v);
          }}
          onVersionCommit={isTemplate ? undefined : handleVersionCommit}
          category={isTemplate ? "" : draftCategory}
          onCategoryChange={isTemplate ? undefined : (v) => {
            setDraftCategory(v);
            if (syncTitleWithCategory) setDraftTitle(v);
            if (isContentMode) persistFolderCategoryToStore(v, draftDepartmentId);
          }}
          departmentId={isContentMode ? draftDepartmentId : null}
          onDepartmentIdChange={isContentMode ? (id) => {
            setDraftDepartmentId(id);
            setDraftCategory("");
            persistFolderCategoryToStore("", id);
          } : undefined}
          departments={isContentMode ? departments : []}
          departmentOfLabel={
            isContentMode
              ? formatDepartmentOfLabel(findDepartmentById(departments, draftDepartmentId))
              : ""
          }
          departmentName={
            isContentMode
              ? (findDepartmentById(departments, draftDepartmentId)?.category || "")
              : ""
          }
          launchDate={isTemplate || draftCampaignActive ? "" : draftLaunchDate}
          onLaunchDateChange={
            isTemplate || useFolderSchedule || draftCampaignActive
              ? undefined
              : (v) => {
                setDraftLaunchDate(v);
                const launchAt = v ? isoFromDateInput(v) : null;
                updateDoc(doc.id, { launchAt });
              }
          }
          scheduleStartDate={useFolderSchedule ? draftScheduleStartDate : ""}
          onScheduleStartDateChange={useFolderSchedule ? handleScheduleStartDateChange : undefined}
          scheduleFinishDate={useFolderSchedule ? draftScheduleFinishDate : ""}
          onScheduleFinishDateChange={useFolderSchedule ? handleScheduleFinishDateChange : undefined}
          scheduleStartMin={useFolderSchedule ? scheduleStartMin : ""}
          onScheduleDatesClear={useFolderSchedule ? handleScheduleDatesClear : undefined}
          useFolderSchedule={useFolderSchedule}
          campaignActive={draftCampaignActive}
          onCampaignActiveChange={
            isTemplate || useFolderSchedule || draftCampaignActive
              ? undefined
              : (v) => {
                setDraftCampaignActive(v);
              }
          }
          deferCampaignStatusToChildren={Boolean(draftCampaignActive)}
          parentId={draftParentId}
          onParentIdChange={isKnowledgeMode || isContentMode ? undefined : (v) => {
            setDraftParentId(v);
          }}
          icon={isContentMode ? draftIcon : ""}
          onIconChange={isContentMode ? (v) => {
            setDraftIcon(v);
            updateDoc(doc.id, { icon: v || "" });
          } : undefined}
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
          folderViewMode={doc?.viewMode}
          onFolderViewModeChange={isContentMode ? (nextMode) => {
            updateDoc(doc.id, { viewMode: nextMode });
          } : undefined}
          onCreateDocumentInFolder={
            isContentMode ? handleCreateDocumentInFolder : undefined
          }
          onShredFolderNode={
            isContentMode ? handleShredFolderNode : undefined
          }
        />
        ) : null}
      </div>
      {showCreateDocument ? (
        <StandaloneNodeModal
          docs={Object.values(allDocs)}
          parentObjectId={draftParentId || null}
          initialParentDocId={doc.id}
          onClose={() => setShowCreateDocument(false)}
          onSaved={() => setShowCreateDocument(false)}
        />
      ) : null}
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
          onQueryChange={handleQueryChange}
          content={nodeDraftContent}
          dataType={activeNodeContext.dataType}
          onContentChange={handleNodeContentChange}
          createdDate={draftCreatedDate}
          completed={nodeDraftCompleted}
          status={nodeDraftStatus}
          onStatusChange={draftCampaignActive
            ? undefined
            : (v) => {
              setNodeDraftStatus(v);
              setNodeDraftCompleted(v === "completed");
              const id = activeNodeContext?.nodeId;
              const clearingSchedule = v === DOC_WORK_STATUS.FLEXIBLE;
              if (clearingSchedule) {
                setNodeDraftAnchorDate("");
                setNodeDraftAnchorTime("");
                setNodeDraftAnchorFinishTime("");
                if (activeNodeContext) {
                  handleBlockAnchorChange(
                    activeNodeContext.blockIndex,
                    "",
                    "",
                    "",
                  );
                }
              }
              if (id) {
                updateNode(id, clearingSchedule
                  ? { status: v, anchorAt: null, anchorFinishAt: null }
                  : { status: v });
              }
              // Status is live-committed — advance snapshot so close/discard won't prompt or revert.
              setNodeInitialSnapshot((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  status: v ?? null,
                  completed: v === "completed",
                  ...(clearingSchedule
                    ? { anchorDate: "", anchorTime: "", anchorFinishTime: "" }
                    : {}),
                };
                nodeInitialSnapshotRef.current = next;
                return next;
              });
            }}
          onCompletedChange={undefined}
          campaignMode={Boolean(draftCampaignActive)}
          campaignStatus={nodeDraftCampaignStatus}
          onCampaignStatusChange={draftCampaignActive
            ? (v) => {
              const next = normalizeCampaignDocStatus(v);
              setNodeDraftCampaignStatus(next);
              const id = activeNodeContext?.nodeId;
              if (id) updateNode(id, { campaignStatus: next, completed: false, status: null });
            }
            : undefined}
          announceDate={nodeDraftAnnounceDate}
          onAnnounceDateChange={draftCampaignActive ? setNodeDraftAnnounceDate : undefined}
          subcategory={nodeDraftSubcategory}
          onSubcategoryChange={draftCampaignActive ? setNodeDraftSubcategory : undefined}
          sourceId={nodeDraftSourceId}
          onSourceIdChange={(v) => {
            setNodeDraftSourceId(v);
            const id = activeNodeContext?.nodeId;
            if (id) updateNode(id, { sourceId: v ?? null });
          }}
          parentDocLabel={parentDocLabel}
          parentDocId={doc.id}
          parentObjectId={draftParentId || null}
          onSave={handleNodeModalSave}
          onBackToDocument={handleRequestCloseNodeModal}
          onCloseWithoutSave={discardNodeModalWithoutSave}
          anchorDate={nodeDraftAnchorDate}
          anchorTime={nodeDraftAnchorTime}
          anchorFinishTime={nodeDraftAnchorFinishTime}
          onAnchorDateChange={handleNodeAnchorDateChange}
          onAnchorTimeChange={handleNodeAnchorTimeChange}
          onAnchorFinishTimeChange={handleNodeAnchorFinishTimeChange}
          scheduleOccupied={occupiedIntervals}
          scheduleOverlapHint={nodeScheduleOverlapHint}
          folderScheduleReserved={folderScheduleReserved}
          folderFrameMinDate={folderFrameBounds?.minDate || ""}
          folderFrameMaxDate={folderFrameBounds?.maxDate || ""}
          scheduleMinDate={childScheduleBounds?.minDate || ""}
          scheduleMaxDate={childScheduleBounds?.maxDate || ""}
          onClose={handleRequestCloseNodeModal}
          onInsertToCanvas={onInsertToCanvas ? handleInsertNodeToCanvas : undefined}
          entityNodeId={activeNodeContext.nodeId || null}
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
          skipDraftPersistRef.current = true;
          docIsDirtyRef.current = false;
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
        onYes={async () => {
          setShowNodeUnsavedConfirm(false);
          const gate = await ensureChildScheduleOrRemind();
          if (gate === "stay") return;
          if (gate === "discard") {
            discardNodeModalWithoutSave();
            return;
          }
          handleNodeModalSave();
        }}
        onNo={() => {
          setShowNodeUnsavedConfirm(false);
          discardNodeModalWithoutSave();
        }}
      />
      <MarkLoadingOverlay open={isSavingNode} label="Saving…" />
    </>
  );
}
