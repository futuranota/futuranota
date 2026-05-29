import { useRef, useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { isoFromDateInput } from "../../lib/docDates.js";
import {
  DOC_BLOCK_TYPES,
  normalizeDocBlocks,
  updateBlockAt,
} from "../../lib/docBlocks.js";
import { nodeDataTypeForBlock } from "../../lib/docBlockSlash.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  anchorFieldsFromIso,
  blockDataType,
  getAnswerBelowH1,
  getBlockQueryText,
  getContentForNodeBlock,
  resolveBlockAnchorFields,
  resolveNodeDraftFromDoc,
  setAnswerBelowH1,
  setContentForNodeBlock,
} from "../../lib/docNodeSync.js";
import { isoFromAnchorFields } from "../../lib/nodeAnchor.js";
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
}) {
  const getNode = useNodesStore((s) => s.getNode);
  const updateNode = useNodesStore((s) => s.updateNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);

  const [activeNodeContext, setActiveNodeContext] = useState(null);
  const [nodeDraftContent, setNodeDraftContent] = useState("");
  const [nodeDraftAnchorDate, setNodeDraftAnchorDate] = useState("");
  const [nodeDraftAnchorTime, setNodeDraftAnchorTime] = useState("");
  const nodeAutosaveTimerRef = useRef(null);

  const handleBlockAnchorChange = (blockIndex, anchorDate, anchorTime) => {
    setBlocks((prev) => {
      const next = updateBlockAt(prev, blockIndex, { anchorDate, anchorTime });
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
    setBlocks((prev) => {
      const block = prev[h1Index];
      if (block?.nodeId) {
        const dataType = blockDataType(block);
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

  const persistNodeContentDebounced = (content, context, anchorDate, anchorTime) => {
    const { blockId, blockIndex, nodeId, query, dataType, blockType } = context;
    const block = blocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = getBlockQueryText(block) || (query || "").trim() || "Untitled query";
    const anchorAt = supportsScheduleAnchor(dataType)
      ? isoFromAnchorFields(anchorDate, anchorTime)
      : null;

    const savedNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId,
      blockId,
      query: queryText,
      content,
      dataType,
      docCreatedAt: isoFromDateInput(createdDate),
      anchorAt,
    });

    if ((nodeId || block.nodeId) !== savedNodeId) {
      setActiveNodeContext((prev) => (prev ? { ...prev, nodeId: savedNodeId } : prev));
    }

    setBlocks((prev) => {
      const current = prev[blockIndex];
      if (!current) return prev;
      const patch = {
        nodeId: savedNodeId,
        sourceQuery: queryText,
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
      if (supportsScheduleAnchor(dataType)) {
        patch.anchorDate = anchorDate;
        patch.anchorTime = anchorTime;
        patch.queryEnabled = true;
      }

      let next = updateBlockAt(prev, blockIndex, patch);
      next = setContentForNodeBlock(next, blockIndex, content, dataType);
      if (dataType === NODE_DATA_TYPES.TEXT) {
        next = setAnswerBelowH1(next, blockIndex, typeof content === "string" ? content : "");
      }
      return next;
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

  const handleOpenNodeForBlock = (blockIndex, block) => {
    const dataType = nodeDataTypeForBlock(block);
    const existing = block.nodeId ? getNode(block.nodeId) : null;
    let blockContent = getContentForNodeBlock(block);

    if (block.type === DOC_BLOCK_TYPES.H1) {
      const answer = getAnswerBelowH1(blocks, blockIndex);
      if (answer.trim()) blockContent = answer;
    }

    setActiveNodeContext({
      blockId: block.id,
      blockIndex,
      blockType: block.type,
      nodeId: block.nodeId || null,
      query: getBlockQueryText(block),
      dataType,
    });
    const resolvedNodeDraft = resolveNodeDraftFromDoc(blockContent, existing, dataType);
    setNodeDraftContent(resolvedNodeDraft);
    const anchorFromBlock = resolveBlockAnchorFields(block, createdDate);
    const anchorFromNode = anchorFieldsFromIso(existing?.anchorAt);
    setNodeDraftAnchorDate(anchorFromBlock.anchorDate || anchorFromNode.anchorDate);
    setNodeDraftAnchorTime(anchorFromBlock.anchorTime || anchorFromNode.anchorTime);
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
  };

  const handleNodeModalSave = () => {
    if (!activeNodeContext) return;
    if (nodeAutosaveTimerRef.current) {
      clearTimeout(nodeAutosaveTimerRef.current);
      nodeAutosaveTimerRef.current = null;
    }

    const { blockId, blockIndex, nodeId, query, dataType, blockType } = activeNodeContext;
    const block = blocks[blockIndex];
    if (!block || block.type !== blockType) return;

    const queryText = getBlockQueryText(block) || (query || "").trim() || "Untitled query";
    const anchorAt = supportsScheduleAnchor(dataType)
      ? isoFromAnchorFields(nodeDraftAnchorDate, nodeDraftAnchorTime)
      : null;

    const newNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId,
      blockId,
      query: queryText,
      content: nodeDraftContent,
      dataType,
      docCreatedAt: isoFromDateInput(createdDate),
      anchorAt,
    });

    const patch = {
      nodeId: newNodeId,
      sourceQuery: queryText,
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
      patch.anchorDate = nodeDraftAnchorDate;
      patch.anchorTime = nodeDraftAnchorTime;
      patch.queryEnabled = true;
    }

    let nextBlocks = updateBlockAt(blocks, blockIndex, patch);
    nextBlocks = setContentForNodeBlock(nextBlocks, blockIndex, nodeDraftContent, dataType);
    if (dataType === NODE_DATA_TYPES.TEXT) {
      nextBlocks = setAnswerBelowH1(
        nextBlocks,
        blockIndex,
        typeof nodeDraftContent === "string" ? nodeDraftContent : "",
      );
    }
    setBlocks(nextBlocks);
    resetNodeModal();
  };

  const handleNodeAnchorDateChange = (anchorDate) => {
    setNodeDraftAnchorDate(anchorDate);
    if (!activeNodeContext) return;
    handleBlockAnchorChange(activeNodeContext.blockIndex, anchorDate, nodeDraftAnchorTime);
  };

  const handleNodeAnchorTimeChange = (anchorTime) => {
    setNodeDraftAnchorTime(anchorTime);
    if (!activeNodeContext) return;
    handleBlockAnchorChange(activeNodeContext.blockIndex, nodeDraftAnchorDate, anchorTime);
  };

  const nodeModal = activeNodeContext ? (
    <NodeQueryModal
      query={activeNodeContext.query}
      content={nodeDraftContent}
      dataType={activeNodeContext.dataType}
      onContentChange={handleNodeContentChange}
      createdDate={createdDate}
      parentDocLabel={docTitle.trim() || "New document"}
      onSave={handleNodeModalSave}
      onBackToDocument={resetNodeModal}
      anchorDate={nodeDraftAnchorDate}
      anchorTime={nodeDraftAnchorTime}
      onAnchorDateChange={handleNodeAnchorDateChange}
      onAnchorTimeChange={handleNodeAnchorTimeChange}
      onClose={resetNodeModal}
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
    onBlockAnchorChange: handleBlockAnchorChange,
    onAnswerBelowH1Change: handleAnswerBelowH1Change,
    nodeModal,
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
