import { useState, useEffect, useRef } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { Modal } from "../shared/Modal.jsx";
import { NodeForm } from "../nodes/NodeForm.jsx";
import { NodeQueryModal } from "../nodes/NodeQueryModal.jsx";
import {
  dateInputFromIso,
  isoFromDateInput,
  launchDateInputFromIso,
} from "../../lib/docDates.js";
import { normalizeDoc } from "../../lib/normalizeDoc.js";
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
  blockDataType,
  getAnswerBelowH1,
  getBlockQueryText,
  getContentForNodeBlock,
  resolveBlockAnchorFields,
  resolveNodeDraftFromDoc,
  setAnswerBelowH1,
  setContentForNodeBlock,
} from "../../lib/docNodeSync.js";
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
}) {
  const normalizedBlocks = normalizeDocBlocks(blocks);
  const serializedBody = docBlocksToBody(normalizedBlocks) || body || "";
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
  };
}

export function DocExpandedView({ docId, onClose, onInsertToCanvas }) {
  const doc = useDocsStore((s) => s.docs[docId]);
  const updateDoc = useDocsStore((s) => s.updateDoc);
  const linkDocToObject = useDocsStore((s) => s.linkDocToObject);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const addNodeFromDoc = useNodesStore((s) => s.addNodeFromDoc);
  const addNode = useNodesStore((s) => s.addNode);
  const getNode = useNodesStore((s) => s.getNode);
  const createOrUpdateNodeFromDocBlock = useNodesStore((s) => s.createOrUpdateNodeFromDocBlock);
  const updateNode = useNodesStore((s) => s.updateNode);
  const deleteNode = useNodesStore((s) => s.deleteNode);

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
  const [activeNodeContext, setActiveNodeContext] = useState(null);
  const [nodeDraftContent, setNodeDraftContent] = useState("");
  const [nodeDraftAnchorDate, setNodeDraftAnchorDate] = useState("");
  const [nodeDraftAnchorTime, setNodeDraftAnchorTime] = useState("");
  const [nodeInitialSnapshot, setNodeInitialSnapshot] = useState(null);
  const [nodeSavedHint, setNodeSavedHint] = useState(false);
  const [docSavedHint, setDocSavedHint] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [showNodeUnsavedConfirm, setShowNodeUnsavedConfirm] = useState(false);
  const nodeAutosaveTimerRef = useRef(null);
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
    const normalized = normalizeDoc(d);
    setDraftCreatedDate(dateInputFromIso(normalized.createdAt));
    setDraftVersion(normalized.version ?? "");
    setDraftCategory(normalized.category ?? "");
    setDraftLaunchDate(launchDateInputFromIso(normalized.launchAt));
    setDraftCampaignActive(Boolean(normalized.campaignActive));
    setDraftNodeLinkColor(normalized.nodeLinkColor ?? "dark");
    setDraftParentId(doc.parentObjectId ?? "");
    setNodeSavedHint(false);
    setDocSavedHint(false);
    setInitialSnapshot(
      buildDocPersistSnapshot({
        title: normalized.title ?? "",
        blocks: loadedBlocks,
        body: d.body ?? d.content ?? "",
        createdDate: dateInputFromIso(normalized.createdAt),
        version: normalized.version ?? "",
        category: normalized.category ?? "",
        launchAt: normalized.launchAt ?? null,
        campaignActive: Boolean(normalized.campaignActive),
        parentObjectId: doc.parentObjectId ?? "",
        nodeLinkColor: normalized.nodeLinkColor ?? "dark",
      }),
    );
  }, [docId]);

  if (!doc) return null;

  const objectList = Object.values(objects);
  const parentObject = draftParentId ? objects[draftParentId] : null;
  const headerLabel = parentObject?.name || "";
  const parentDocLabel = draftTitle.trim() || UNTITLED_DOC_LABEL;
  const draftLaunchAt = draftLaunchDate ? isoFromDateInput(draftLaunchDate) : null;
  const draftSnapshot = buildDocPersistSnapshot({
    title: draftTitle,
    blocks: draftBlocks,
    body: draftBody,
    createdDate: draftCreatedDate,
    version: draftVersion,
    category: draftCategory,
    launchAt: draftLaunchAt,
    campaignActive: draftCampaignActive,
    parentObjectId: draftParentId,
    nodeLinkColor: draftNodeLinkColor,
  });
  const hasUnsavedChanges = initialSnapshot
    ? JSON.stringify(initialSnapshot) !== JSON.stringify(draftSnapshot)
    : false;

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
    setDocSavedHint(false);
  };

  const handleSave = () => {
    const title = draftTitle.trim() || "New document";
    const savedSnapshot = buildDocPersistSnapshot({
      title: draftTitle,
      blocks: draftBlocks,
      body: draftBody,
      createdDate: draftCreatedDate,
      version: draftVersion,
      category: draftCategory,
      launchAt: draftLaunchAt,
      campaignActive: draftCampaignActive,
      parentObjectId: draftParentId,
      nodeLinkColor: draftNodeLinkColor,
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
    });
    if ((doc.parentObjectId ?? "") !== (draftParentId || "")) {
      linkDocToObject(doc.id, draftParentId || null);
    }
    setInitialSnapshot(savedSnapshot);
    setDocSavedHint(true);
    setNodeSavedHint(false);
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
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
      return;
    }
    onClose();
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

  const handleOpenNodeForBlock = (blockIndex, block) => {
    if (isNoNodeLinkMode(resolveBlockNodeLinkColor(block))) return;
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
      patch.anchorFromNode = Boolean(
        nodeDraftAnchorDate !== nodeInitialSnapshot?.anchorDate
        || nodeDraftAnchorTime !== nodeInitialSnapshot?.anchorTime,
      ) || Boolean(block.anchorFromNode);
      patch.queryEnabled = true;
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
    setNodeInitialSnapshot(null);
    setNodeSavedHint(true);
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
          onCreatedDateChange={(v) => {
            setDraftCreatedDate(v);
            setDocSavedHint(false);
          }}
          version={draftVersion}
          onVersionChange={(v) => {
            setDraftVersion(v);
            setDocSavedHint(false);
          }}
          category={draftCategory}
          onCategoryChange={(v) => {
            setDraftCategory(v);
            setDocSavedHint(false);
          }}
          launchDate={draftLaunchDate}
          onLaunchDateChange={(v) => {
            setDraftLaunchDate(v);
            setDocSavedHint(false);
          }}
          campaignActive={draftCampaignActive}
          onCampaignActiveChange={(v) => {
            setDraftCampaignActive(v);
            setDocSavedHint(false);
          }}
          parentId={draftParentId}
          onParentIdChange={(v) => {
            setDraftParentId(v);
            setDocSavedHint(false);
          }}
          nodeLinkColor={draftNodeLinkColor}
          onNodeLinkColorChange={(v) => {
            setDraftNodeLinkColor(v);
            setDocSavedHint(false);
          }}
          objects={objectList}
          onDelete={handleDeleteDoc}
          onSave={handleSave}
          onCloseExpand={handleRequestCloseDoc}
          onOpenNodeForBlock={handleOpenNodeForBlock}
          onOpenNodeForH1={handleOpenNodeForH1}
          onAnswerBelowH1Change={handleAnswerBelowH1Change}
          onBlockAnchorChange={handleBlockAnchorChange}
          onInsertProductToCanvas={handleInsertProductToCanvas}
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
          onBackToDocument={handleRequestCloseNodeModal}
          anchorDate={nodeDraftAnchorDate}
          anchorTime={nodeDraftAnchorTime}
          onAnchorDateChange={handleNodeAnchorDateChange}
          onAnchorTimeChange={handleNodeAnchorTimeChange}
          onClose={handleRequestCloseNodeModal}
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
      )}
      {showUnsavedConfirm ? (
        <div className="doc-unsaved-confirm-overlay" role="presentation">
          <div
            className="doc-unsaved-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-unsaved-confirm-title"
          >
            <p id="doc-unsaved-confirm-title" className="doc-unsaved-confirm__text">
              Would you like to save the changes?
            </p>
            <div className="doc-unsaved-confirm__actions">
              <button
                type="button"
                className="doc-unsaved-confirm__btn doc-unsaved-confirm__btn--yes"
                onClick={() => {
                  handleSave();
                  setShowUnsavedConfirm(false);
                  onClose();
                }}
              >
                yes
              </button>
              <button
                type="button"
                className="doc-unsaved-confirm__btn"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  onClose();
                }}
              >
                no
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showNodeUnsavedConfirm ? (
        <div className="doc-unsaved-confirm-overlay" role="presentation">
          <div
            className="doc-unsaved-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="node-unsaved-confirm-title"
          >
            <p id="node-unsaved-confirm-title" className="doc-unsaved-confirm__text">
              Would you like to save the changes?
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
                yes
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
        </div>
      ) : null}
    </>
  );
}
