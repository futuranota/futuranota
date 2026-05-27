import { useState, useEffect } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
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
import {
  getAnswerBelowH1,
  resolveNodeDraftFromDoc,
  setAnswerBelowH1,
} from "../../lib/docNodeSync.js";

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
  const createOrUpdateNodeFromH1 = useNodesStore((s) => s.createOrUpdateNodeFromH1);
  const updateNode = useNodesStore((s) => s.updateNode);
  const deleteNode = useNodesStore((s) => s.deleteNode);

  const [selectionModal, setSelectionModal] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const [draftCreatedDate, setDraftCreatedDate] = useState("");
  const [activeNodeContext, setActiveNodeContext] = useState(null);
  const [nodeDraftContent, setNodeDraftContent] = useState("");
  const [nodeSavedHint, setNodeSavedHint] = useState(false);

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
  }, [docId]);

  if (!doc) return null;

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
    onClose();
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (!text) return;
    setSelectionModal({ query: text });
  };

  const syncLinkedNodeFromDoc = (h1Index, text, blocks) => {
    const h1Block = blocks[h1Index];
    if (!h1Block || h1Block.type !== DOC_BLOCK_TYPES.H1 || !h1Block.nodeId) return;
    const queryText = (h1Block.title || h1Block.sourceQuery || "").trim() || "Untitled query";
    updateNode(h1Block.nodeId, {
      content: text,
      title: queryText,
      sourceQuery: queryText,
    });
  };

  const handleAnswerBelowH1Change = (h1Index, text) => {
    syncLinkedNodeFromDoc(h1Index, text, draftBlocks);
    if (activeNodeContext?.h1Index === h1Index) {
      setNodeDraftContent(text);
    }
  };

  const handleNodeContentChange = (content) => {
    setNodeDraftContent(content);
    if (!activeNodeContext) return;

    const { h1Index } = activeNodeContext;
    syncLinkedNodeFromDoc(h1Index, content, draftBlocks);
    setDraftBlocks((prev) => setAnswerBelowH1(prev, h1Index, content));
  };

  const handleOpenNodeForH1 = (h1Index, h1Block) => {
    const answer = getAnswerBelowH1(draftBlocks, h1Index);
    const existing = h1Block.nodeId ? getNode(h1Block.nodeId) : null;

    setNodeSavedHint(false);
    setActiveNodeContext({
      blockId: h1Block.id,
      h1Index,
      nodeId: h1Block.nodeId || null,
      query: h1Block.title || h1Block.sourceQuery || "",
    });
    setNodeDraftContent(resolveNodeDraftFromDoc(answer, existing));
  };

  const handleNodeModalSave = () => {
    if (!activeNodeContext) return;

    const { blockId, h1Index, nodeId, query } = activeNodeContext;
    const h1Block = draftBlocks[h1Index];
    if (!h1Block || h1Block.type !== DOC_BLOCK_TYPES.H1) return;

    const queryText = (h1Block.title || query || "").trim() || "Untitled query";
    const newNodeId = createOrUpdateNodeFromH1({
      nodeId: nodeId || h1Block.nodeId || null,
      docId: doc.id,
      blockId,
      query: queryText,
      content: nodeDraftContent,
      docCreatedAt: isoFromDateInput(draftCreatedDate),
    });

    let nextBlocks = updateBlockAt(draftBlocks, h1Index, {
      nodeId: newNodeId,
      sourceQuery: queryText,
      title: h1Block.title || queryText,
    });
    nextBlocks = setAnswerBelowH1(nextBlocks, h1Index, nodeDraftContent);
    setDraftBlocks(nextBlocks);
    setActiveNodeContext(null);
    setNodeDraftContent("");
    setNodeSavedHint(true);
  };

  const handleNodeModalDelete = () => {
    if (!activeNodeContext) return;

    const { h1Index, nodeId } = activeNodeContext;
    const h1Block = draftBlocks[h1Index];
    const linkedId = nodeId || h1Block?.nodeId;

    if (linkedId) {
      deleteNode(linkedId);
    }

    if (h1Block) {
      const nextBlocks = updateBlockAt(draftBlocks, h1Index, {
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
          title={draftTitle}
          onTitleChange={setDraftTitle}
          body={draftBody}
          onBodyChange={setDraftBody}
          blocks={draftBlocks}
          onBlocksChange={setDraftBlocks}
          createdDate={draftCreatedDate}
          onCreatedDateChange={setDraftCreatedDate}
          onDelete={handleDeleteDoc}
          onSave={handleSave}
          onCloseExpand={onClose}
          onOpenNodeForH1={handleOpenNodeForH1}
          onAnswerBelowH1Change={handleAnswerBelowH1Change}
        />
      </div>
      {nodeSavedHint ? (
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
          onContentChange={handleNodeContentChange}
          createdDate={draftCreatedDate}
          parentDocLabel={parentDocLabel}
          onSave={handleNodeModalSave}
          onDelete={handleNodeModalDelete}
          onClose={() => {
            setActiveNodeContext(null);
            setNodeDraftContent("");
          }}
        />
      )}
    </>
  );
}
