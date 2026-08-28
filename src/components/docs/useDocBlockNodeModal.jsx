import { useRef, useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { isoFromDateInput, launchDateInputFromIso } from "../../lib/docDates.js";
import {
  DOC_BLOCK_TYPES,
  docBlocksToBody,
  normalizeDocBlocks,
  updateBlockAt,
  h1HasVideoEmbedSibling,
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
  isDocBlockLinkedToNode,
  shouldMirrorNodeContentInDoc,
  removeLinkedOwnerBundleFromBlocks,
} from "../../lib/docNodeSync.js";
import { parseCalendarEventNodeContent } from "../../lib/eventCalendarSearch.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import { buildCampaignChildScheduleFields } from "../../lib/campaignDates.js";
import { listOccupiedIntervalsByDate, hasTimeframeOverlap } from "../../lib/docScheduleOccupancy.js";
import { isNoNodeLinkMode, resolveBlockNodeLinkColor } from "../../lib/docNodeLinkColors.js";
import { nodeDraftContentForStorage } from "../../lib/nodeInlineContent.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  CAMPAIGN_DOC_STATUS_INACTIVE,
  normalizeCampaignDocStatus,
} from "../../lib/campaignDocSource.js";
import {
  DOC_WORK_STATUS,
  defaultStatusAfterScheduleSave,
  resolveDocWorkStatus,
  sanitizeDocStatusForFolderSchedule,
} from "../../lib/docWorkStatus.js";
import {
  canReassignDocumentParent,
  isUnassignedDepartmentFolder,
  listMoveTargetFolders,
  resolveAdoptableDocLabel,
  setEntityNodeParentDocument,
} from "../../lib/nodeParentAdoption.js";
import { NodeQueryModal } from "../nodes/NodeQueryModal.jsx";

function supportsScheduleAnchor(dataType) {
  return dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;
}

/**
 * Node modal + block sync for draft documents (create modal or expanded editor).
 */
export function useDocBlockNodeModal({
  blocks,
  setBlocks,
  createdDate,
  docId = null,
  docTitle = "New document",
  nodeLinkColor = "white",
  onInsertToCanvas,
  /** Parent folder metadata; reservation gates/clamps the document schedule picker. */
  parentFolderDoc = null,
  /** Company object id — required for @ URL-table mentions inside the node modal. */
  parentObjectId = null,
}) {
  const { t } = useI18n();
  const getNode = useNodesStore((s) => s.getNode);
  const updateNode = useNodesStore((s) => s.updateNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const docsById = useDocsStore((s) => s.docs);
  const campaignDocMode = Boolean(parentFolderDoc?.campaignActive);
  const hostFolderDoc = parentFolderDoc
    || (docId ? docsById?.[docId] : null)
    || null;
  const canAssignParent = canReassignDocumentParent(
    hostFolderDoc,
    { parentDocId: hostFolderDoc?.id || docId || null },
  );
  const adoptableDocList = listMoveTargetFolders(docsById, {
    parentObjectId,
    fromFolderDoc: hostFolderDoc,
    excludeFolderId: hostFolderDoc?.id || docId || null,
  });
  const hostFolderLabel = hostFolderDoc
    ? resolveAdoptableDocLabel(hostFolderDoc)
    : (docTitle.trim() || "New document");

  const [activeNodeContext, setActiveNodeContext] = useState(null);
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
  const nodeAutosaveTimerRef = useRef(null);

  /** Day-first: docs may schedule freely; folder frame no longer gates or clamps. */
  const folderScheduleReserved = false;
  const folderFrameBounds = null;
  const docStatusReserved = nodeDraftStatus === DOC_WORK_STATUS.RESERVED;
  const childScheduleBounds = null;
  const canPersistDocSchedule = !campaignDocMode;

  const blockLinkColor = (blockIndex) =>
    resolveBlockNodeLinkColor(blocks[blockIndex]);

  const handleBlockAnchorChange = (blockIndex, anchorDate, anchorTime, anchorFinishTime = "") => {
    setBlocks((prev) => {
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
      if (docId) {
        const body = docBlocksToBody(next);
        updateDoc(docId, {
          blocks: next,
          body,
          content: body,
        });
      }
      return next;
    });
  };

  const handleAnswerBelowH1Change = (h1Index, text) => {
    const owner = blocks[h1Index];
    if (owner && isDocBlockLinkedToNode(owner)) return;
    setBlocks((prev) => {
      const block = prev[h1Index];
      if (
        block?.nodeId
        && !h1HasVideoEmbedSibling(prev, h1Index)
        && !isDocBlockLinkedToNode(block)
      ) {
        const dataType = blockDataType(block, prev, h1Index);
        const queryText = getBlockQueryText(block) || "Untitled query";
        updateNode(block.nodeId, {
          content: text,
          title: queryText,
          sourceQuery: queryText,
          dataType,
        });
      }
      return prev;
    });
    if (activeNodeContext?.blockIndex === h1Index && activeNodeContext.dataType === NODE_DATA_TYPES.TEXT) {
      setNodeDraftContent(text);
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
    // Body always persists — isNoNodeLinkMode only affects the color-link handle UI.
    const { blockId, blockIndex, nodeId, query, dataType, blockType } = context;
    const block = blocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = (query || "").trim() || getBlockQueryText(block) || "Untitled query";
    // Only Yes/flush may write schedule. Autosave must not pass null and wipe anchorAt.
    // Persist when folder is reserved or doc status is reserved; otherwise clear.
    const scheduleDate = String(anchorDate || "").trim();
    const canWriteSchedule = supportsScheduleAnchor(dataType) && canPersistDocSchedule;
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
    if (!campaignDocMode && commitSchedule) {
      const hasCompleteSchedule = Boolean(
        canWriteSchedule
        && scheduleDate
        && String(anchorTime || "").trim()
        && String(anchorFinishTime || "").trim()
        && anchorAt
        && anchorFinishAt,
      );
      const docDateInFolderFrame = Boolean(String(scheduleDate || "").trim());
      const autoNotStarted = defaultStatusAfterScheduleSave({
        status: scheduleStatus,
        hasCompleteSchedule,
        docDateInFolderFrame,
      });
      if (autoNotStarted) scheduleStatus = autoNotStarted;
    }

    const savedNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId,
      blockId,
      query: queryText,
      content: contentForStorage,
      dataType,
      docCreatedAt: isoFromDateInput(createdDate),
      ...(anchorAt !== undefined && !campaignDocMode ? { anchorAt } : {}),
      ...(anchorFinishAt !== undefined && !campaignDocMode ? { anchorFinishAt } : {}),
      ...(campaignDocMode
        ? { status: null, completed: false }
        : commitSchedule && (scheduleStatus != null || nodeDraftCompleted)
          ? {
            status: scheduleStatus,
            completed: scheduleStatus === DOC_WORK_STATUS.COMPLETED,
          }
          : {}),
      sourceId: nodeDraftSourceId,
    });

    if (!campaignDocMode && savedNodeId) {
      const live = useNodesStore.getState().nodes[savedNodeId];
      const liveStatus = resolveDocWorkStatus(live);
      if (liveStatus !== nodeDraftStatus) {
        setNodeDraftStatus(liveStatus);
        setNodeDraftCompleted(liveStatus === "completed");
      }
    }

    if (campaignDocMode && savedNodeId) {
      const child = buildCampaignChildScheduleFields({
        announceDate: nodeDraftAnnounceDate,
        launchDate: scheduleDate,
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
          : {
            subcategory: String(nodeDraftSubcategory || "").trim() || null,
          }),
      });
    } else if (savedNodeId) {
      updateNode(savedNodeId, {
        subcategory: String(nodeDraftSubcategory || "").trim() || null,
      });
    }

    if ((nodeId || block.nodeId) !== savedNodeId) {
      setActiveNodeContext((prev) => (prev ? { ...prev, nodeId: savedNodeId } : prev));
    }

    const patch = {
      nodeId: savedNodeId,
      sourceQuery: queryText,
    };
    if (
      block.type === DOC_BLOCK_TYPES.H1
      || block.type === DOC_BLOCK_TYPES.DATE
      || block.type === DOC_BLOCK_TYPES.METRIC
    ) {
      patch.title = queryText;
    }
    if (block.type === DOC_BLOCK_TYPES.TODO) {
      patch.listTitle = queryText;
    }
    if (commitSchedule && supportsScheduleAnchor(dataType)) {
      patch.anchorDate = scheduleDate;
      patch.anchorTime = anchorTime;
      patch.anchorFinishTime = anchorFinishTime;
      patch.anchorFromNode = Boolean(scheduleDate);
      patch.queryEnabled = true;
    }

    let nextBlocks = updateBlockAt(blocks, blockIndex, patch);
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

    setBlocks(nextBlocks);

    if (docId) {
      const body = docBlocksToBody(nextBlocks);
      updateDoc(docId, {
        blocks: nextBlocks,
        body,
        content: body,
      });
      if (savedNodeId) syncNodeToParentDoc(savedNodeId, docId);
    }
  };

  const handleQueryChange = (nextQuery) => {
    setActiveNodeContext((prev) => (prev ? { ...prev, query: nextQuery } : prev));
    const context = activeNodeContext;
    if (!context) return;
    const title = String(nextQuery ?? "").trim();
    if (!title) return;
    const { blockIndex, nodeId, blockType } = context;
    if (nodeId && docId) {
      updateNode(nodeId, { title, sourceQuery: title });
      syncNodeToParentDoc(nodeId, docId);
    } else if (nodeId) {
      updateNode(nodeId, { title, sourceQuery: title });
    }
    const block = blocks[blockIndex];
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
    const nextBlocks = updateBlockAt(blocks, blockIndex, patch);
    setBlocks(nextBlocks);
    if (docId) {
      const body = docBlocksToBody(nextBlocks);
      updateDoc(docId, {
        blocks: nextBlocks,
        body,
        content: body,
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
    nodeAutosaveTimerRef.current = setTimeout(() => {
      persistNodeContentDebounced(content, context, "", "", "", { commitSchedule: false });
      nodeAutosaveTimerRef.current = null;
    }, 250);
  };

  const ensureBlockNode = (blockIndex, block, contentOverride) => {
    if (isNoNodeLinkMode(blockLinkColor(blockIndex))) return null;
    const nodeId = ensureNodeForDocBlock({
      block: { ...block, queryEnabled: true },
      blocks,
      blockIndex,
      docId,
      docCreatedAt: isoFromDateInput(createdDate),
      contentOverride,
      createOrUpdateNodeFromDocBlock,
    });
    if (!nodeId) return null;

    if (blocks[blockIndex]?.nodeId !== nodeId) {
      const queryText = getBlockQueryText(block) || "Untitled query";
      const dataType = blockDataType(block, blocks, blockIndex);
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
      if (supportsScheduleAnchor(dataType)) {
        patch.anchorFromNode = block.anchorFromNode ?? false;
      }
      const nextBlocks = updateBlockAt(blocks, blockIndex, patch);
      setBlocks(nextBlocks);
      if (docId) {
        const body = docBlocksToBody(nextBlocks);
        updateDoc(docId, {
          blocks: nextBlocks,
          body,
          content: body,
        });
      }
      setActiveNodeContext((prev) =>
        (prev?.blockIndex === blockIndex ? { ...prev, nodeId } : prev),
      );
    }
    return nodeId;
  };

  const handleEnsureNodeForBlock = (blockIndex, block) => ensureBlockNode(blockIndex, block);

  const handleInsertNodeToCanvas = () => {
    if (!activeNodeContext || !onInsertToCanvas) return;
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }
    const { blockIndex } = activeNodeContext;
    const block = blocks[blockIndex];
    if (!block) return;
    const nodeId = ensureBlockNode(blockIndex, block, nodeDraftContent);
    const entity = nodeId ? getNode(nodeId) : null;
    if (entity) onInsertToCanvas(entity, { center: true });
  };

  const handleOpenNodeForBlock = (blockIndex, block) => {
    if (isNoNodeLinkMode(blockLinkColor(blockIndex))) return;
    const ensuredNodeId = ensureBlockNode(blockIndex, block);
    const dataType = blockDataType(block, blocks, blockIndex);
    const existing = (ensuredNodeId || block.nodeId) ? getNode(ensuredNodeId || block.nodeId) : null;
    let blockContent = getContentForNodeBlock(block, blocks, blockIndex);

    // Linked / Create-a-document bodies live on node.content (not mirrored in the folder).
    if (existing && (isDocBlockLinkedToNode(block) || block.macronodeHeading)) {
      blockContent = existing.content;
    } else if (block.type === DOC_BLOCK_TYPES.H1 && dataType === NODE_DATA_TYPES.TEXT) {
      const answer = getAnswerBelowH1(blocks, blockIndex);
      if (answer.trim()) blockContent = answer;
    }

    setActiveNodeContext({
      blockId: block.id,
      blockIndex,
      blockType: block.type,
      nodeId: ensuredNodeId || block.nodeId || null,
      query: (
        (existing
          ? (existing.sourceQuery || existing.title || "")
          : ""
        ).trim()
        || getBlockQueryText(block)
      ),
      dataType,
    });
    const resolvedNodeDraft = resolveNodeDraftFromDoc(blockContent, existing, dataType);
    setNodeDraftContent(resolvedNodeDraft);
    const statusSanitize = !campaignDocMode
      ? sanitizeDocStatusForFolderSchedule(existing, folderScheduleReserved)
      : null;
    if (statusSanitize && (ensuredNodeId || block.nodeId)) {
      updateNode(ensuredNodeId || block.nodeId, statusSanitize);
    }
    const openedStatus = statusSanitize
      ? null
      : resolveDocWorkStatus(existing);
    setNodeDraftCompleted(statusSanitize ? false : Boolean(existing?.completed));
    setNodeDraftStatus(openedStatus);
    setNodeDraftCampaignStatus(
      normalizeCampaignDocStatus(existing?.campaignStatus ?? CAMPAIGN_DOC_STATUS_INACTIVE),
    );
    setNodeDraftSourceId(existing?.sourceId ?? null);
    setNodeDraftSubcategory(
      typeof existing?.subcategory === "string"
        ? existing.subcategory
        : (typeof existing?.category === "string" ? existing.category : ""),
    );
    setNodeDraftAnnounceDate(campaignDocMode ? launchDateInputFromIso(existing?.windowStartAt) : "");
    // Campaign: Launch on launchAt. Content: Schedule on anchorAt only when
    // the parent folder has a reservation — never invent from Created.
    const launchOrAnchorIso = campaignDocMode
      ? (existing?.launchAt || null)
      : (existing?.anchorAt || null);
    if (launchOrAnchorIso) {
      const fromNode = anchorFieldsFromIso(launchOrAnchorIso);
      setNodeDraftAnchorDate(fromNode.anchorDate);
      setNodeDraftAnchorTime(fromNode.anchorTime);
      const fromFinish = anchorFieldsFromIso(existing?.anchorFinishAt || null);
      setNodeDraftAnchorFinishTime(fromFinish.anchorTime || "");
    } else if (!campaignDocMode) {
      const anchorFromBlock = resolveBlockAnchorFields(block, createdDate, {
        noNodeLink: isNoNodeLinkMode(blockLinkColor(blockIndex)),
      });
      setNodeDraftAnchorDate(anchorFromBlock.anchorDate);
      setNodeDraftAnchorTime(anchorFromBlock.anchorTime);
      setNodeDraftAnchorFinishTime(anchorFromBlock.anchorFinishTime || "");
    } else {
      setNodeDraftAnchorDate("");
      setNodeDraftAnchorTime("");
      setNodeDraftAnchorFinishTime("");
    }
  };

  const resetNodeModal = () => {
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
  };

  const flushAndCloseNodeModal = async () => {
    if (!activeNodeContext) {
      resetNodeModal();
      return;
    }
    if (campaignDocMode) {
      const child = buildCampaignChildScheduleFields({
        announceDate: nodeDraftAnnounceDate,
        launchDate: nodeDraftAnchorDate,
        launchTime: nodeDraftAnchorTime,
        subcategory: nodeDraftSubcategory,
      });
      if (!child.ok) {
        window.alert(t("sidebar.campaignDateStartAfterLaunch"));
        return;
      }
    }
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }

    const context = { ...activeNodeContext };
    const { blockIndex, nodeId, dataType, blockType } = context;
    const block = blocks[blockIndex];
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
        { commitSchedule: true },
      );
    }
    resetNodeModal();
  };

  const handleParentDocIdChange = (nextId) => {
    const next = String(nextId || "").trim();
    const nodeId = activeNodeContext?.nodeId;
    if (!canAssignParent || !nodeId || !next) return;
    const sourceFolderId = docId || hostFolderDoc?.id || null;
    if (next === sourceFolderId) return;
    setEntityNodeParentDocument({
      nodeEntityId: nodeId,
      docId: next,
    });
    const { blocks: nextBlocks } = removeLinkedOwnerBundleFromBlocks(blocks, nodeId);
    setBlocks(nextBlocks);
    if (docId) {
      const body = docBlocksToBody(nextBlocks);
      updateDoc(docId, { blocks: nextBlocks, body, content: body });
    }
    resetNodeModal();
  };

  const handleNodeModalSave = () => {
    flushAndCloseNodeModal();
  };

  const handleNodeAnchorDateChange = (anchorDate) => {
    const nextDate = String(anchorDate || "").trim();
    // Persist Schedule immediately — must survive tab switch.
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
    // Persist Schedule immediately — must survive tab switch.
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

  const handleVideoEmbedSync = (videoIndex, videoPatch = {}, blocksSnapshot) => {
    syncVideoNodeFromVideoBlock(
      blocksSnapshot ?? blocks,
      videoIndex,
      videoPatch,
      updateNode,
    );
  };

  const handleVideoEmbedH1TitleChange = (h1Index) => {
    setBlocks((prev) => {
      syncVideoNodeFromH1Blocks(prev, h1Index, updateNode);
      return prev;
    });
  };

  const occupied = listOccupiedIntervalsByDate(
    useNodesStore.getState().nodes,
    useDocsStore.getState().docs,
    nodeDraftAnchorDate,
    {
      excludeNodeId: activeNodeContext?.nodeId || null,
      objectId: parentObjectId || null,
    },
  );
  const overlapHint = hasTimeframeOverlap(
    isoFromAnchorFields(nodeDraftAnchorDate, nodeDraftAnchorTime),
    isoFromAnchorFields(nodeDraftAnchorDate, nodeDraftAnchorFinishTime),
    occupied,
  ) ? t("meta.scheduleOverlapHint") : "";

  const nodeModal = activeNodeContext ? (
    <NodeQueryModal
      query={activeNodeContext.query}
      onQueryChange={handleQueryChange}
      content={nodeDraftContent}
      dataType={activeNodeContext.dataType}
      onContentChange={handleNodeContentChange}
      createdDate={createdDate}
      completed={nodeDraftCompleted}
      status={nodeDraftStatus}
      onStatusChange={campaignDocMode
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
        }}
      onCompletedChange={undefined}
      campaignMode={campaignDocMode}
      campaignStatus={nodeDraftCampaignStatus}
      onCampaignStatusChange={campaignDocMode
        ? (v) => {
          const next = normalizeCampaignDocStatus(v);
          setNodeDraftCampaignStatus(next);
          const id = activeNodeContext?.nodeId;
          if (id) updateNode(id, { campaignStatus: next, completed: false, status: null });
        }
        : undefined}
      announceDate={nodeDraftAnnounceDate}
      onAnnounceDateChange={campaignDocMode ? setNodeDraftAnnounceDate : undefined}
      subcategory={nodeDraftSubcategory}
      onSubcategoryChange={setNodeDraftSubcategory}
      sourceId={nodeDraftSourceId}
      onSourceIdChange={(v) => {
        setNodeDraftSourceId(v);
        const id = activeNodeContext?.nodeId;
        if (id) updateNode(id, { sourceId: v ?? null });
      }}
      parentDocLabel={hostFolderLabel}
      parentDocId={docId || hostFolderDoc?.id || ""}
      onParentDocIdChange={canAssignParent ? handleParentDocIdChange : undefined}
      requireParentFolder={Boolean(
        canAssignParent && hostFolderDoc && isUnassignedDepartmentFolder(hostFolderDoc),
      )}
      docs={adoptableDocList}
      parentObjectId={parentObjectId}
      onSave={handleNodeModalSave}
      onBackToDocument={flushAndCloseNodeModal}
      anchorDate={nodeDraftAnchorDate}
      anchorTime={nodeDraftAnchorTime}
      anchorFinishTime={nodeDraftAnchorFinishTime}
      onAnchorDateChange={handleNodeAnchorDateChange}
      onAnchorTimeChange={handleNodeAnchorTimeChange}
      onAnchorFinishTimeChange={handleNodeAnchorFinishTimeChange}
      scheduleOccupied={occupied}
      scheduleOverlapHint={overlapHint}
      folderScheduleReserved={folderScheduleReserved}
      folderFrameMinDate={folderFrameBounds?.minDate || ""}
      folderFrameMaxDate={folderFrameBounds?.maxDate || ""}
      scheduleMinDate={childScheduleBounds?.minDate || ""}
      scheduleMaxDate={childScheduleBounds?.maxDate || ""}
      onClose={flushAndCloseNodeModal}
      onInsertToCanvas={onInsertToCanvas ? handleInsertNodeToCanvas : undefined}
      entityNodeId={activeNodeContext.nodeId || null}
      intelSearchMeta={
        docId
          ? {
              queryNodeEntityId: activeNodeContext.nodeId || null,
              docId,
              blockIndex: activeNodeContext.blockIndex,
            }
          : null
      }
    />
  ) : null;

  return {
    onOpenNodeForBlock: handleOpenNodeForBlock,
    onEnsureNodeForBlock: handleEnsureNodeForBlock,
    onBlockAnchorChange: handleBlockAnchorChange,
    onAnswerBelowH1Change: handleAnswerBelowH1Change,
    onVideoEmbedSync: handleVideoEmbedSync,
    onVideoEmbedH1TitleChange: handleVideoEmbedH1TitleChange,
    nodeModal,
    isNodeModalOpen: Boolean(activeNodeContext),
  };
}

/** Link draft block nodes to a doc after first save. */
export function linkBlockNodesToDoc(blocks, docId) {
  const addNodeToDoc = useDocsStore.getState().addNodeToDoc;
  const updateNode = useNodesStore.getState().updateNode;
  for (const block of normalizeDocBlocks(blocks)) {
    if (!block.nodeId) continue;
    addNodeToDoc(docId, block.nodeId);
    updateNode(block.nodeId, { parentDocId: docId, linkedToDoc: true });
  }
}
