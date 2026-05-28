import { useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { anchorFieldsFromIso, isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import {
  dateInputFromIso,
  isoFromDateInput,
  todayDateInputValue,
} from "../../lib/docDates.js";
import { NodeQueryModal } from "./NodeQueryModal.jsx";

function getNodeDisplayTitle(node) {
  return (node?.sourceQuery || node?.title || "").trim();
}

function contentToString(content, dataType) {
  if (dataType === "date") {
    if (content && typeof content === "object") {
      return { date: content.date || "", time: content.time || "" };
    }
    if (typeof content === "string") {
      return { date: content, time: "" };
    }
    return { date: "", time: "" };
  }
  if (dataType === "metric" && content != null && typeof content === "object") {
    return String(content.value ?? "");
  }
  if (dataType === "checkbox" && typeof content === "boolean") {
    return content ? "true" : "false";
  }
  if (typeof content === "string") return content;
  if (content == null) return "";
  return JSON.stringify(content);
}

function normalizeContentForType(nextType, prevContent) {
  if (nextType === "date") {
    if (prevContent && typeof prevContent === "object") {
      return { date: prevContent.date || "", time: prevContent.time || "" };
    }
    if (typeof prevContent === "string") {
      return { date: prevContent, time: "" };
    }
    return { date: "", time: "" };
  }

  if (typeof prevContent === "string") return prevContent;
  if (prevContent == null) return "";

  if (nextType === "metric" && typeof prevContent === "object") {
    return String(prevContent.value ?? "");
  }

  if (nextType === "checkbox" && typeof prevContent === "boolean") {
    return prevContent ? "true" : "false";
  }

  return JSON.stringify(prevContent);
}

function parseContentForSave(text, dataType) {
  if (dataType === "date") {
    if (text && typeof text === "object") {
      return { date: text.date || "", time: text.time || "" };
    }
    if (typeof text === "string") {
      return { date: text, time: "" };
    }
    return { date: "", time: "" };
  }
  if (dataType === "metric") {
    const n = Number(text);
    return { value: Number.isNaN(n) ? text : n, unit: "" };
  }
  if (dataType === "checkbox") {
    const s = String(text).toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return text;
}

/**
 * Create or edit a node from the Nodes panel — same UI as doc-linked node modal.
 */
export function StandaloneNodeModal({
  node = null,
  docs,
  defaultParentDocId = "",
  queryCanvasNodeId = null,
  onClose,
  onSaved,
  onDeleted,
}) {
  const addNode = useNodesStore((s) => s.addNode);
  const updateNode = useNodesStore((s) => s.updateNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const removeNodeSyncFromDoc = useNodesStore((s) => s.removeNodeSyncFromDoc);
  const addNodeToDoc = useDocsStore((s) => s.addNodeToDoc);
  const removeNodeFromDoc = useDocsStore((s) => s.removeNodeFromDoc);

  const isNew = !node;
  const [query, setQuery] = useState(() => getNodeDisplayTitle(node) || "");
  const [dataType, setDataType] = useState(node?.dataType || NODE_DATA_TYPES.TEXT);
  const [content, setContent] = useState(() => contentToString(node?.content, node?.dataType));
  const [parentDocId, setParentDocId] = useState(node?.parentDocId || defaultParentDocId || "");
  const [createdDate, setCreatedDate] = useState(() =>
    dateInputFromIso(node?.createdAt),
  );
  const initialAnchor = anchorFieldsFromIso(node?.anchorAt);
  const [anchorDate, setAnchorDate] = useState(initialAnchor.anchorDate);
  const [anchorTime, setAnchorTime] = useState(initialAnchor.anchorTime);

  const handleDataTypeChange = (nextType) => {
    setDataType(nextType);
    setContent((prev) => normalizeContentForType(nextType, prev));
  };

  const handleSave = () => {
    const title = query.trim() || "Untitled query";
    const payload = parseContentForSave(content, dataType);
    const parentId = parentDocId || null;
    const createdAt = isoFromDateInput(createdDate);
    const anchorAt =
      dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX
        ? isoFromAnchorFields(anchorDate, anchorTime)
        : null;

    if (isNew) {
      const newId = addNode(title, dataType, payload, parentId, {
        sourceQuery: title,
        createdAt,
        anchorAt,
      });
      if (parentId) {
        syncNodeToParentDoc(newId, parentId);
      }
    } else {
      const prevParent = node.parentDocId || null;
      if (prevParent && prevParent !== parentId) {
        removeNodeSyncFromDoc(node.id, prevParent);
        removeNodeFromDoc(prevParent, node.id);
      }
      if (parentId) {
        addNodeToDoc(parentId, node.id);
      }
      updateNode(node.id, {
        title,
        sourceQuery: title,
        dataType,
        content: payload,
        parentDocId: parentId,
        linkedToDoc: Boolean(parentId),
        createdAt,
        anchorAt,
      });
      if (parentId) {
        syncNodeToParentDoc(node.id, parentId);
      }
    }
    onSaved?.();
    onClose?.();
  };

  const handleDelete = () => {
    if (isNew) {
      onClose?.();
      return;
    }
    if (!window.confirm("Delete this node? This cannot be undone.")) return;
    onDeleted?.(node.id);
    onClose?.();
  };

  const docList = Array.isArray(docs) ? docs : Object.values(docs || {});

  return (
    <NodeQueryModal
      query={query}
      onQueryChange={setQuery}
      content={content}
      onContentChange={setContent}
      dataType={dataType}
      onDataTypeChange={handleDataTypeChange}
      dataTypes={[
        NODE_DATA_TYPES.TEXT,
        NODE_DATA_TYPES.DATE,
        NODE_DATA_TYPES.METRIC,
        NODE_DATA_TYPES.CHECKBOX,
      ]}
      createdDate={createdDate || todayDateInputValue()}
      onCreatedDateChange={setCreatedDate}
      parentDocId={parentDocId}
      onParentDocIdChange={setParentDocId}
      docs={docList}
      anchorDate={anchorDate}
      anchorTime={anchorTime}
      onAnchorDateChange={setAnchorDate}
      onAnchorTimeChange={setAnchorTime}
      onSave={handleSave}
      onDelete={handleDelete}
      onClose={onClose}
      intelSearchMeta={
        node?.id
          ? {
              queryNodeEntityId: node.id,
              queryCanvasNodeId,
              docId: parentDocId || null,
            }
          : null
      }
    />
  );
}
