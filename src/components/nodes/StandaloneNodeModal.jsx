import { useMemo, useRef, useState } from "react";
import { useDocsStore } from "../../stores/docsStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { NODE_DATA_TYPES } from "../../lib/nodeDataTypes.js";
import { MarkLoadingOverlay } from "../shared/MarkLoading.jsx";

const DOC_SAVE_LOADING_MIN_MS = 700;
import {
  listAdoptableDocs,
  resolveAdoptableDocLabel,
  resolveNodeParentDocId,
} from "../../lib/nodeParentAdoption.js";
import { anchorFieldsFromIso, isoFromAnchorFields } from "../../lib/nodeAnchor.js";
import {
  dateInputFromIso,
  formatMmDdYy,
  isoFromDateInput,
  todayDateInputValue,
} from "../../lib/docDates.js";
import {
  folderScheduleDateInputBounds,
  isDateInputWithinFolderSchedule,
} from "../../lib/folderScheduleReservation.js";
import { confirmChildScheduleOrDiscard } from "../../lib/childScheduleConfirm.js";
import { useConfirmStore } from "../../stores/confirmStore.js";
import { useI18n } from "../../i18n/useI18n.js";
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
import {
  CAMPAIGN_DOC_STATUS_INACTIVE,
  normalizeCampaignDocStatus,
} from "../../lib/campaignDocSource.js";

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
 * Create or edit a document (node entity) from Folder / Independent Documents.
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
  const { t } = useI18n();
  const askConfirm = useConfirmStore((s) => s.ask);
  const addNode = useNodesStore((s) => s.addNode);
  const updateNode = useNodesStore((s) => s.updateNode);
  const getNode = useNodesStore((s) => s.getNode);
  const syncNodeToParentDoc = useNodesStore((s) => s.syncNodeToParentDoc);
  const removeNodeSyncFromDoc = useNodesStore((s) => s.removeNodeSyncFromDoc);
  const addNodeToDoc = useDocsStore((s) => s.addNodeToDoc);
  const removeNodeFromDoc = useDocsStore((s) => s.removeNodeFromDoc);
  const docsByStoreId = useDocsStore((s) => s.docs);

  const isNew = !node;
  // Parent folder assign/rename only for Independent Documents (no persisted parent).
  // Docs already inside a folder must not show the parent switcher.
  const canAssignParent = isNew ? !initialParentDocId : !node?.parentDocId;
  const docList = listAdoptableDocs(docs, { parentObjectId });
  const [query, setQuery] = useState(() => getNodeDisplayTitle(node) || "");
  const [dataType, setDataType] = useState(node?.dataType || NODE_DATA_TYPES.TEXT);
  const [content, setContent] = useState(() => contentToString(node?.content, node?.dataType));
  const docsById = Object.fromEntries(docList.map((d) => [d.id, d]));
  const [parentDocId, setParentDocId] = useState(() => {
    if (isNew && initialParentDocId) return initialParentDocId;
    // Keep the real parent even when it is absent from the adoptable picker list
    // (campaign folders must still drive campaignMode / Launch UI).
    if (node?.parentDocId && docsByStoreId?.[node.parentDocId]) {
      return node.parentDocId;
    }
    return resolveNodeParentDocId(node, null, { ...docsByStoreId, ...docsById }, { parentObjectId })
      || node?.parentDocId
      || "";
  });
  const lockedParentLabel = useMemo(() => {
    if (canAssignParent) return "";
    const id = parentDocId || node?.parentDocId || initialParentDocId || "";
    if (!id) return "";
    const doc = docsByStoreId?.[id]
      || docList.find((d) => d.id === id)
      || null;
    return doc ? resolveAdoptableDocLabel(doc) : "";
  }, [
    canAssignParent,
    parentDocId,
    node?.parentDocId,
    initialParentDocId,
    docsByStoreId,
    docList,
  ]);
  const [createdDate, setCreatedDate] = useState(() =>
    dateInputFromIso(node?.createdAt),
  );
  const parentFolderDocEarly = (() => {
    const id = (isNew && initialParentDocId)
      ? initialParentDocId
      : (node?.parentDocId || "");
    return id ? (docsByStoreId?.[id] || null) : null;
  })();
  const isCampaignDoc = Boolean(parentFolderDocEarly?.campaignActive);
  const initialLaunch = anchorFieldsFromIso(
    isCampaignDoc ? (node?.launchAt || null) : (node?.anchorAt || null),
  );
  const initialAnchor = isCampaignDoc
    ? initialLaunch
    : anchorFieldsFromIso(node?.anchorAt);
  const [anchorDate, setAnchorDate] = useState(initialAnchor.anchorDate);
  const [anchorTime, setAnchorTime] = useState(initialAnchor.anchorTime);
  const [completed, setCompleted] = useState(() => Boolean(node?.completed));
  const [campaignStatus, setCampaignStatus] = useState(() =>
    normalizeCampaignDocStatus(node?.campaignStatus ?? CAMPAIGN_DOC_STATUS_INACTIVE),
  );
  const [sourceId, setSourceId] = useState(() => node?.sourceId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const openSnapshotRef = useRef({
    query: getNodeDisplayTitle(node) || "",
    content: node?.content ?? null,
    createdAt: node?.createdAt ?? null,
    anchorAt: node?.anchorAt ?? null,
    completed: Boolean(node?.completed),
    sourceId: node?.sourceId ?? null,
    dataType: node?.dataType || NODE_DATA_TYPES.TEXT,
    parentDocId: node?.parentDocId || initialParentDocId || null,
  });

  const discardWithoutSave = () => {
    if (!isNew && node?.id) {
      const snap = openSnapshotRef.current;
      updateNode(node.id, {
        title: snap.query,
        sourceQuery: snap.query,
        content: snap.content,
        createdAt: snap.createdAt,
        anchorAt: snap.anchorAt,
        completed: snap.completed,
        sourceId: snap.sourceId,
        dataType: snap.dataType,
      });
      const parentId = snap.parentDocId || node.parentDocId || null;
      if (parentId) {
        syncNodeToParentDoc(node.id, parentId);
      }
    }
    onClose?.();
  };

  // Prefer live parent id (state can be empty when listAdoptableDocs omits the folder).
  const resolvedParentDocId = parentDocId
    || node?.parentDocId
    || initialParentDocId
    || null;
  const parentFolderDoc = resolvedParentDocId
    ? (docsByStoreId?.[resolvedParentDocId] || docsById[resolvedParentDocId] || null)
    : null;
  const campaignDocMode = Boolean(parentFolderDoc?.campaignActive);
  const childScheduleBounds = useMemo(
    () => (campaignDocMode ? null : folderScheduleDateInputBounds(parentFolderDoc)),
    [parentFolderDoc, campaignDocMode],
  );

  const handleAnchorDateChange = async (next) => {
    const nextDate = String(next || "").trim();
    if (
      !campaignDocMode
      && nextDate
      && !isDateInputWithinFolderSchedule(nextDate, parentFolderDoc)
    ) {
      if (childScheduleBounds) {
        await askConfirm({
          title: t("meta.scheduleTitle"),
          message: t("meta.childScheduleOutOfRange", {
            min: formatMmDdYy(childScheduleBounds.minDate) || childScheduleBounds.minDate,
            max: formatMmDdYy(childScheduleBounds.maxDate) || childScheduleBounds.maxDate,
          }),
          confirmLabel: t("common.ok"),
          tone: "default",
          hideCancel: true,
        });
      }
      return;
    }
    setAnchorDate(nextDate);
  };

  const handleDataTypeChange = (nextType) => {
    setDataType(nextType);
    setContent((prev) => normalizeContentForType(nextType, prev));
  };

  const handleSave = async () => {
    if (isSaving) return;
    const title = query.trim() || "Untitled query";
    let payload = parseContentForSave(content, dataType);
    if (node && dataType === NODE_DATA_TYPES.TEXT && parseCalendarEventNodeContent(node.content)) {
      payload = node.content;
    }
    const parentId = parentDocId || null;
    const createdAt = isoFromDateInput(createdDate);
    // Schedule is independent of Created — never copy Created into anchorAt.
    // Campaign docs use the same date inputs for launchAt (not folder Schedule).
    const scheduleDate = String(anchorDate || "").trim();
    const supportsSchedule =
      dataType === NODE_DATA_TYPES.TEXT || dataType === NODE_DATA_TYPES.CHECKBOX;
    if (
      !campaignDocMode
      && supportsSchedule
      && scheduleDate
      && !isDateInputWithinFolderSchedule(scheduleDate, parentFolderDoc)
    ) {
      if (childScheduleBounds) {
        await askConfirm({
          title: t("meta.scheduleTitle"),
          message: t("meta.childScheduleOutOfRange", {
            min: formatMmDdYy(childScheduleBounds.minDate) || childScheduleBounds.minDate,
            max: formatMmDdYy(childScheduleBounds.maxDate) || childScheduleBounds.maxDate,
          }),
          confirmLabel: t("common.ok"),
          tone: "default",
          hideCancel: true,
        });
      }
      return;
    }
    const anchorAt = (!campaignDocMode && supportsSchedule)
      ? (scheduleDate ? isoFromAnchorFields(scheduleDate, anchorTime) : null)
      : null;
    const launchAt = (campaignDocMode && supportsSchedule)
      ? (scheduleDate ? isoFromAnchorFields(scheduleDate, anchorTime) : null)
      : (node?.launchAt ?? null);
    const windowEndAt = campaignDocMode ? (launchAt || null) : (node?.windowEndAt ?? null);
    const windowStartAt = campaignDocMode
      ? (node?.windowStartAt ?? null)
      : (node?.windowStartAt ?? null);

    const corpusObjectId = parentId
      ? (docsByStoreId?.[parentId]?.parentObjectId || parentObjectId || null)
      : (parentObjectId || node?.objectId || null);

    const scheduleIncomplete = Boolean(
      !campaignDocMode
      && supportsSchedule
      && childScheduleBounds
      && (!scheduleDate || !String(anchorTime || "").trim()),
    );
    if (scheduleIncomplete) {
      const gate = await confirmChildScheduleOrDiscard(
        askConfirm,
        t,
        "/uploads/CalendarDots.svg",
      );
      if (gate === "stay") {
        // New docs cannot be created without schedule; existing stay open after OK.
        if (isNew) return;
      } else {
        // close & not save — revert live-persisted edits
        discardWithoutSave();
        return;
      }
    }

    setIsSaving(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, DOC_SAVE_LOADING_MIN_MS);
      });

      const campaignFields = campaignDocMode
        ? {
          campaignStatus: normalizeCampaignDocStatus(campaignStatus),
          launchAt,
          windowStartAt,
          windowEndAt,
          completed: false,
        }
        : {
          completed,
        };

      if (isNew) {
        const newId = addNode(title, dataType, payload, parentId, {
          sourceQuery: title,
          createdAt,
          anchorAt,
          sourceId,
          objectId: corpusObjectId,
          ...campaignFields,
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
      if (canAssignParent && prevParent && prevParent !== parentId) {
        removeNodeSyncFromDoc(node.id, prevParent);
        removeNodeFromDoc(prevParent, node.id);
      }
      if (canAssignParent && parentId) {
        addNodeToDoc(parentId, node.id);
      }
      updateNode(node.id, {
        title,
        sourceQuery: title,
        dataType,
        content: payload,
        ...(canAssignParent
          ? {
            parentDocId: parentId,
            linkedToDoc: Boolean(parentId),
            objectId: corpusObjectId,
          }
          : {
            objectId: node.objectId || corpusObjectId,
          }),
        createdAt,
        anchorAt,
        sourceId,
        ...campaignFields,
      });
      if (canAssignParent && parentId) {
        syncNodeToParentDoc(node.id, parentId);
      }
      onSaved?.(getNode(node.id));
      // Incomplete schedule: keep panel open so they can assign date/time.
      if (scheduleIncomplete) return;
      onClose?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompletedChange = (value) => {
    setCompleted(value);
    if (node?.id) updateNode(node.id, { completed: Boolean(value) });
  };

  const handleCampaignStatusChange = (value) => {
    const next = normalizeCampaignDocStatus(value);
    setCampaignStatus(next);
    if (node?.id) updateNode(node.id, { campaignStatus: next });
  };

  const handleSourceIdChange = (value) => {
    setSourceId(value);
    if (node?.id) updateNode(node.id, { sourceId: value ?? null });
  };

  /** Live-persist title so content-focus (Save hidden) still syncs chip + parent folder H1. */
  const handleQueryChange = (nextQuery) => {
    setQuery(nextQuery);
    if (isNew || !node?.id) return;
    const title = String(nextQuery ?? "").trim();
    if (!title) return;
    updateNode(node.id, { title, sourceQuery: title });
    const parentId = parentDocId || node.parentDocId || null;
    if (parentId) {
      syncNodeToParentDoc(node.id, parentId);
    }
  };

  /** Live-persist body so Folder Description excerpt updates while writing. */
  const handleContentChange = (nextContent) => {
    setContent(nextContent);
    if (isNew || !node?.id) return;
    if (dataType !== NODE_DATA_TYPES.TEXT) return;
    if (parseCalendarEventNodeContent(node.content)) return;
    const payload = parseContentForSave(nextContent, dataType);
    updateNode(node.id, { content: payload });
  };

  return (
    <>
      <NodeQueryModal
        query={query}
        onQueryChange={handleQueryChange}
        content={content}
        onContentChange={handleContentChange}
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
        onCompletedChange={campaignDocMode ? undefined : handleCompletedChange}
        campaignMode={campaignDocMode}
        campaignStatus={campaignStatus}
        onCampaignStatusChange={campaignDocMode ? handleCampaignStatusChange : undefined}
        sourceId={sourceId}
        onSourceIdChange={handleSourceIdChange}
        parentDocId={parentDocId}
        onParentDocIdChange={canAssignParent ? setParentDocId : undefined}
        parentDocLabel={canAssignParent ? undefined : (lockedParentLabel || undefined)}
        docs={docList}
        parentObjectId={parentObjectId}
        anchorDate={anchorDate}
        anchorTime={anchorTime}
        onAnchorDateChange={handleAnchorDateChange}
        onAnchorTimeChange={setAnchorTime}
        scheduleMinDate={childScheduleBounds?.minDate || ""}
        scheduleMaxDate={childScheduleBounds?.maxDate || ""}
        onSave={handleSave}
        onClose={onClose}
        onCloseWithoutSave={discardWithoutSave}
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
      <MarkLoadingOverlay open={isSaving} label="Saving…" />
    </>
  );
}
