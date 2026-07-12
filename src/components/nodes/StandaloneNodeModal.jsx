import { useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { listAdoptableDocs, resolveNodeParentDocId } from "../../lib/nodeParentAdoption.js";
import { anchorFieldsFromIso, isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import {
  dateInputFromIso,
  isoFromDateInput,
  todayDateInputValue,
} from "../../lib/docDates.js";
import { NodeQueryModal } from "./NodeQueryModal.jsx";
import {
  parseCalendarEventNodeContent,
} from "../../lib/eventCalendarSearch.js";
import { buildVideoNodeContent } from "../../lib/videoEmbed.js";
import {
  createDefaultNodeTodoContent,
  isNodeTodoContent,
  normalizeNodeTodoContent,
} from "../../lib/nodeTodoContent.js";
import {
  isNodeWritingBody,
  nodeDraftContentForStorage,
  parseNodeWritingBody,
  serializeNodeWritingBody,
} from "../../lib/nodeInlineContent.js";

function getNodeDisplayTitle(node) {
  return (node?.sourceQuery || node?.title || "").trim();
}

function resolveNodeBlockIndex(node, docs) {
  if (!node?.parentDocId || !node?.sourceBlockId) return null;
  const doc = Array.isArray(docs)
    ? docs.find((d) => d?.id === node.parentDocId)
    : docs?.[node.parentDocId];
  if (!doc?.blocks?.length) return null;
  const idx = doc.blocks.findIndex((b) => b?.id === node.sourceBlockId);
  return idx >= 0 ? idx : null;
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
  if (dataType === "checkbox") {
    return normalizeNodeTodoContent(content, getNodeDisplayTitle(node) || "Todo list:");
  }
  if (dataType === NODE_DATA_TYPES.TEXT) {
    if (isNodeWritingBody(content)) return content;
    if (typeof content === "string") return content;
  }
  if (dataType === "video") {
    if (content && typeof content === "object") return content;
    if (typeof content === "string") {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return content ?? buildVideoNodeContent(null);
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

  if (nextType === "checkbox") {
    if (isNodeTodoContent(prevContent)) return prevContent;
    if (typeof prevContent === "boolean") {
      return normalizeNodeTodoContent(prevContent);
    }
    return createDefaultNodeTodoContent();
  }
  if (nextType === "video") {
    if (prevContent && typeof prevContent === "object") return prevContent;
    return buildVideoNodeContent(null);
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
    if (text && typeof text === "object") {
      const raw = text.value;
      if (raw === "" || raw == null) return { value: "", unit: text.unit || "" };
      const n = Number(raw);
      return { value: Number.isNaN(n) ? raw : n, unit: text.unit || "" };
    }
    const n = Number(text);
    return { value: Number.isNaN(n) ? text : n, unit: "" };
  }
  if (dataType === "checkbox") {
    return normalizeNodeTodoContent(text);
  }
  if (dataType === NODE_DATA_TYPES.TEXT) {
    return nodeDraftContentForStorage(text, dataType);
  }
  if (dataType === "video") {
    if (text && typeof text === "object") return text;
    return buildVideoNodeContent(null);
  }
  return text;
}

/**
 * Create or edit a document (node entity) from Folder / Loose documents.
 */
export function StandaloneNodeModal({
  node = null,
  docs,
  parentObjectId = null,
  queryCanvasNodeId = null,
  embedded = false,
  initialContentFocus = false,
  initialParentDocId = null,
  onClose,
  onSaved,
  onDeleted,
}) {
  const addNode = useNodesStore((s) => s.addNode);
  const updateNode = useNodesStore((s) => s.updateNode);
  const getNode = useNodesStore((s) => s.getNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const removeNodeSyncFromDoc = useNodesStore((s) => s.removeNodeSyncFromDoc);
  const addNodeToDoc = useDocsStore((s) => s.addNodeToDoc);
  const removeNodeFromDoc = useDocsStore((s) => s.removeNodeFromDoc);

  const isNew = !node;
  const docList = listAdoptableDocs(docs, { parentObjectId });
  const [query, setQuery] = useState(() => getNodeDisplayTitle(node) || "");
  const [dataType, setDataType] = useState(node?.dataType || NODE_DATA_TYPES.TEXT);
  const [content, setContent] = useState(() => contentToString(node?.content, node?.dataType));
  const docsById = Object.fromEntries(docList.map((d) => [d.id, d]));
  const [parentDocId, setParentDocId] = useState(() => {
    if (isNew && initialParentDocId) return initialParentDocId;
    return resolveNodeParentDocId(node, null, docsById, { parentObjectId }) || "";
  });
  const [createdDate, setCreatedDate] = useState(() =>
    dateInputFromIso(node?.createdAt),
  );
  const initialAnchor = anchorFieldsFromIso(node?.anchorAt);
  const [anchorDate, setAnchorDate] = useState(initialAnchor.anchorDate);
  const [anchorTime, setAnchorTime] = useState(initialAnchor.anchorTime);
  const [completed, setCompleted] = useState(() => Boolean(node?.completed));
  const [sourceId, setSourceId] = useState(() => node?.sourceId ?? null);

  const handleDataTypeChange = (nextType) => {
    setDataType(nextType);
    setContent((prev) => normalizeContentForType(nextType, prev));
  };

  const handleSave = () => {
    const title = query.trim() || "Untitled query";
    let payload = parseContentForSave(content, dataType);
    if (node && dataType === NODE_DATA_TYPES.TEXT && parseCalendarEventNodeContent(node.content)) {
      payload = node.content;
    }
    const parentId = parentDocId || null;
    const createdAt = isoFromDateInput(createdDate);
    // Schedule is independent of Created — never copy Created into anchorAt.
    const scheduleDate = String(anchorDate || "").trim();
    const supportsSchedule =
      dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;
    const anchorAt = supportsSchedule
      ? (scheduleDate ? isoFromAnchorFields(scheduleDate, anchorTime) : null)
      : null;

    if (isNew) {
      const newId = addNode(title, dataType, payload, parentId, {
        sourceQuery: title,
        createdAt,
        anchorAt,
        completed,
        sourceId,
      });
      if (parentId) {
        syncNodeToParentDoc(newId, parentId);
      }
      const entity = getNode(newId);
      onSaved?.(entity);
      onClose?.();
      return;
    }

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
      completed,
      sourceId,
    });
    if (parentId) {
      syncNodeToParentDoc(node.id, parentId);
    }
    onSaved?.(getNode(node.id));
    onClose?.();
  };

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
        NODE_DATA_TYPES.CHECKBOX,
        NODE_DATA_TYPES.VIDEO,
      ]}
      createdDate={createdDate || todayDateInputValue()}
      onCreatedDateChange={setCreatedDate}
      completed={completed}
      onCompletedChange={setCompleted}
      sourceId={sourceId}
      onSourceIdChange={setSourceId}
      parentDocId={parentDocId}
      onParentDocIdChange={setParentDocId}
      docs={docList}
      parentObjectId={parentObjectId}
      anchorDate={anchorDate}
      anchorTime={anchorTime}
      onAnchorDateChange={setAnchorDate}
      onAnchorTimeChange={setAnchorTime}
      onSave={handleSave}
      onClose={onClose}
      embedded={embedded}
      initialContentFocus={initialContentFocus}
      entityNodeId={node?.id ?? null}
      intelSearchMeta={
        node?.id
          ? {
              queryNodeEntityId: node.id,
              queryCanvasNodeId,
              docId: parentDocId || node.parentDocId || null,
              blockIndex:
                (parentDocId || node.parentDocId) === node.parentDocId
                  ? resolveNodeBlockIndex(node, docs)
                  : null,
            }
          : null
      }
    />
  );
}
