import { useState, useEffect } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { Modal } from "../shared/Modal.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";
import { NodeQueryModal } from "../nodes/NodeQueryModal.jsx";
import { dateInputFromIso, isoFromDateInput } from "../../lib/docDates.js";
import { DocDocumentBox } from "./DocDocumentBox.jsx";
import {
  docBlocksFromBody,
  docBlocksToBody,
  normalizeDocBlocks,
  updateBlockAt,
  DOC_BLOCK_TYPES,
} from "../../lib/docBlocks.js";
import { nodeDataTypeForBlock } from "../../lib/docBlockSlash.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import {
  anchorFieldsFromIso,
  anchorAtFromBlock,
  blockDataType,
  getAnswerBelowH1,
  getBlockQueryText,
  getContentForNodeBlock,
  resolveNodeDraftFromDoc,
  setAnswerBelowH1,
  setContentForNodeBlock,
} from "../../lib/docNodeSync.js";
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

export function DocExpandedView({ docId, onClose }) {
  const doc = useDocsStore((s) => s.docs[docId]);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const addNodeFromDoc = useNodesStore((s) => s.addNodeFromDoc);
  const getNode = useNodesStore((s) => s.getNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const updateNode = useNodesStore((s) => s.updateNode);
  const deleteNode = useNodesStore((s) => s.deleteNode);

  const [selectionModal, setSelectionModal] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const [draftCreatedDate, setDraftCreatedDate] = useState("");
  const [activeNodeContext, setActiveNodeContext] = useState(null);
  const [nodeDraftContent, setNodeDraftContent] = useState("");
  const [nodeDraftAnchorDate, setNodeDraftAnchorDate] = useState("");
  const [nodeDraftAnchorTime, setNodeDraftAnchorTime] = useState("");
  const [nodeSavedHint, setNodeSavedHint] = useState(false);
  const [docSavedHint, setDocSavedHint] = useState(false);
  const objects = useObjectsStore((s) => s.objects);

  useEffect(() => {
    const d = useDocsStore.getState().docs[docId];
    if (!d) return;
    const loadedBlocks = normalizeDocBlocks(
      d.blocks?.length ? d.blocks : docBlocksFromBody(d.body ?? d.content ?? ""),
    );
    setDraftTitle(d.title ?? "");
    setDraftBlocks(loadedBlocks);
    setDraftBody(loadedBlocks.length ? "" : (d.body ?? d.content ?? ""));
    setDraftCreatedDate(dateInputFromIso(d.createdAt));
    setNodeSavedHint(false);
    setDocSavedHint(false);
  }, [docId]);

  if (!doc) return null;

  const parentObject = doc.parentObjectId ? objects[doc.parentObjectId] : null;
  const headerLabel = parentObject?.name || "— sin padre —";
  const parentDocLabel = draftTitle.trim() || UNTITLED_DOC_LABEL;

  const handleDeleteDoc = () => {
    const label = draftTitle.trim() || doc.title || "this document";
    if (!window.confirm(`Delete "${label}" and its nodes? This cannot be undone.`)) {
      return;
    }
    if (activeNodeContext) {
      setActiveNodeContext(null);
      setNodeDraftContent("");
    }
    deleteDoc(docId);
    onClose();
  };

  const handleSave = () => {
    const title = draftTitle.trim() || "New document";
    const normalizedBlocks = normalizeDocBlocks(draftBlocks);
    const serializedBody = docBlocksToBody(normalizedBlocks) || draftBody;
    updateDoc(doc.id, {
      title,
      blocks: normalizedBlocks,
      content: serializedBody,
      body: serializedBody,
      createdAt: isoFromDateInput(draftCreatedDate),
    });
    setDocSavedHint(true);
    setNodeSavedHint(false);
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
    const dataType = blockDataType(block);
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
    syncLinkedNodeFromDoc(h1Index, text, draftBlocks);
    if (activeNodeContext?.blockIndex === h1Index && activeNodeContext.dataType === NODE_DATA_TYPES.TEXT) {
      setNodeDraftContent(text);
    }
  };

  const handleNodeContentChange = (content) => {
    setNodeDraftContent(content);
    if (!activeNodeContext) return;

    const { blockIndex, dataType } = activeNodeContext;
    syncLinkedNodeFromDoc(blockIndex, content, draftBlocks);
    setDraftBlocks((prev) => {
      let next = setContentForNodeBlock(prev, blockIndex, content, dataType);
      if (dataType === NODE_DATA_TYPES.TEXT) {
        next = setAnswerBelowH1(next, blockIndex, typeof content === "string" ? content : "");
      }
      return next;
    });
  };

  const handleOpenNodeForBlock = (blockIndex, block) => {
    const dataType = nodeDataTypeForBlock(block);
    const existing = block.nodeId ? getNode(block.nodeId) : null;
    let blockContent = getContentForNodeBlock(block);

    if (block.type === DOC_BLOCK_TYPES.H1) {
      const answer = getAnswerBelowH1(draftBlocks, blockIndex);
      if (answer.trim()) blockContent = answer;
    }

    setNodeSavedHint(false);
    setActiveNodeContext({
      blockId: block.id,
      blockIndex,
      blockType: block.type,
      nodeId: block.nodeId || null,
      query: getBlockQueryText(block),
      dataType,
    });
    setNodeDraftContent(resolveNodeDraftFromDoc(blockContent, existing, dataType));
    const anchorFromBlock = anchorFieldsFromIso(anchorAtFromBlock(block));
    const anchorFromNode = anchorFieldsFromIso(existing?.anchorAt);
    setNodeDraftAnchorDate(anchorFromBlock.anchorDate || anchorFromNode.anchorDate);
    setNodeDraftAnchorTime(anchorFromBlock.anchorTime || anchorFromNode.anchorTime);
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

    const newNodeId = createOrUpdateNodeFromDocBlock({
      nodeId: nodeId || block.nodeId || null,
      docId: doc.id,
      blockId,
      query: queryText,
      content: nodeDraftContent,
      dataType,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
      anchorAt,
    });

    patch.nodeId = newNodeId;
    if (supportsScheduleAnchor(dataType)) {
      patch.anchorDate = nodeDraftAnchorDate;
      patch.anchorTime = nodeDraftAnchorTime;
    }

    let nextBlocks = updateBlockAt(draftBlocks, blockIndex, patch);
    nextBlocks = setContentForNodeBlock(nextBlocks, blockIndex, nodeDraftContent, dataType);
    if (dataType === NODE_DATA_TYPES.TEXT) {
      nextBlocks = setAnswerBelowH1(
        nextBlocks,
        blockIndex,
        typeof nodeDraftContent === "string" ? nodeDraftContent : "",
      );
    }
    setDraftBlocks(nextBlocks);
    setActiveNodeContext(null);
    setNodeDraftContent("");
    setNodeDraftAnchorDate("");
    setNodeDraftAnchorTime("");
    setNodeSavedHint(true);
  };

  const handleNodeModalDelete = () => {
    if (!activeNodeContext) return;

    const { blockIndex, nodeId } = activeNodeContext;
    const block = draftBlocks[blockIndex];
    const linkedId = nodeId || block?.nodeId;

    if (linkedId) {
      deleteNode(linkedId);
    }

    if (block) {
      const nextBlocks = updateBlockAt(draftBlocks, blockIndex, {
        nodeId: undefined,
        sourceQuery: undefined,
      });
      setDraftBlocks(nextBlocks);
    }

    setActiveNodeContext(null);
    setNodeDraftContent("");
    setNodeSavedHint(false);
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        <DocDocumentBox
          headerLabel={headerLabel}
          title={draftTitle}
          onTitleChange={(v) => {
            setDraftTitle(v);
            setDocSavedHint(false);
          }}
          body={draftBody}
          onBodyChange={(v) => {
            setDraftBody(v);
            setDocSavedHint(false);
          }}
          blocks={draftBlocks}
          onBlocksChange={(next) => {
            setDraftBlocks(next);
            setDocSavedHint(false);
          }}
          createdDate={draftCreatedDate}
          onCreatedDateChange={setDraftCreatedDate}
          onDelete={handleDeleteDoc}
          onSave={handleSave}
          onCloseExpand={onClose}
          onOpenNodeForBlock={handleOpenNodeForBlock}
          onOpenNodeForH1={handleOpenNodeForH1}
          onAnswerBelowH1Change={handleAnswerBelowH1Change}
          onBlockAnchorChange={handleBlockAnchorChange}
        />
      </div>
      {docSavedHint ? (
        <span className="notes-doc-editor-hint notes-doc-editor-hint--node-saved">
          Documento guardado. El editor sigue abierto.
        </span>
      ) : nodeSavedHint ? (
        <span className="notes-doc-editor-hint notes-doc-editor-hint--node-saved">
          Nodo guardado en el documento. Pulsa save del documento para persistir todo.
        </span>
      ) : (
        <span className="notes-doc-editor-hint">
          Clic derecho con texto seleccionado → crear nodo
        </span>
      )}
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
      {activeNodeContext && (
        <NodeQueryModal
          query={activeNodeContext.query}
          content={nodeDraftContent}
          dataType={activeNodeContext.dataType}
          onContentChange={handleNodeContentChange}
          createdDate={draftCreatedDate}
          parentDocLabel={parentDocLabel}
          onSave={handleNodeModalSave}
          onDelete={handleNodeModalDelete}
          anchorDate={nodeDraftAnchorDate}
          anchorTime={nodeDraftAnchorTime}
          onAnchorDateChange={handleNodeAnchorDateChange}
          onAnchorTimeChange={handleNodeAnchorTimeChange}
          onClose={() => {
            setActiveNodeContext(null);
            setNodeDraftContent("");
            setNodeDraftAnchorDate("");
            setNodeDraftAnchorTime("");
          }}
        />
      )}
    </>
  );
}
