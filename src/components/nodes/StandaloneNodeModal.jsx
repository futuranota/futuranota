import { useEffect, useMemo, useRef, useState } from "react";
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
  isoFromDateInput,
  todayDateInputValue,
} from "../../lib/docDates.js";
import { listOccupiedIntervalsByDate, hasTimeframeOverlap } from "../../lib/docScheduleOccupancy.js";
import {
  folderScheduleDateInputBounds,
  isDateInputWithinFolderSchedule,
  isFolderScheduleReserved,
} from "../../lib/folderScheduleReservation.js";
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
import { flushPersistenceSync } from "../../stores/middleware/persistenceMiddleware.js";
import {
  DOC_WORK_STATUS,
  defaultStatusAfterScheduleSave,
  resolveDocWorkStatus,
  sanitizeDocStatusForFolderSchedule,
} from "../../lib/docWorkStatus.js";

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
  const [anchorFinishTime, setAnchorFinishTime] = useState(
    anchorFieldsFromIso(node?.anchorFinishAt || null).anchorTime,
  );
  const [completed, setCompleted] = useState(() => {
    const parent = parentFolderDocEarly;
    const folderReserved = !parent?.campaignActive && isFolderScheduleReserved(parent);
    const patch = sanitizeDocStatusForFolderSchedule(node, folderReserved);
    if (patch) return false;
    return Boolean(node?.completed);
  });
  const [status, setStatus] = useState(() => {
    const parent = parentFolderDocEarly;
    const folderReserved = !parent?.campaignActive && isFolderScheduleReserved(parent);
    const patch = sanitizeDocStatusForFolderSchedule(node, folderReserved);
    if (patch) return null;
    return resolveDocWorkStatus(node);
  });
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
    anchorFinishAt: node?.anchorFinishAt ?? null,
    completed: (() => {
      const parent = parentFolderDocEarly;
      const folderReserved = !parent?.campaignActive && isFolderScheduleReserved(parent);
      const patch = sanitizeDocStatusForFolderSchedule(node, folderReserved);
      if (patch) return false;
      return Boolean(node?.completed);
    })(),
    status: (() => {
      const parent = parentFolderDocEarly;
      const folderReserved = !parent?.campaignActive && isFolderScheduleReserved(parent);
      const patch = sanitizeDocStatusForFolderSchedule(node, folderReserved);
      if (patch) return null;
      return resolveDocWorkStatus(node);
    })(),
    sourceId: node?.sourceId ?? null,
    dataType: node?.dataType || NODE_DATA_TYPES.TEXT,
    parentDocId: node?.parentDocId || initialParentDocId || null,
  });

  const discardWithoutSave = () => {
    if (!isNew && node?.id) {
      const snap = openSnapshotRef.current;
      const liveBeforeDiscard = useNodesStore.getState().nodes[node.id] || null;
      // #region agent log
      fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8974ed'},body:JSON.stringify({sessionId:'8974ed',runId:'pre-fix',hypothesisId:'H1',location:'src/components/nodes/StandaloneNodeModal.jsx:discardWithoutSave',message:'Discard path restoring opening snapshot',data:{nodeId:node.id,live:{numericTitle:/^\d+$/.test(String(liveBeforeDiscard?.title||'').trim())?String(liveBeforeDiscard.title).trim():null,titleLength:String(liveBeforeDiscard?.title||'').length,status:liveBeforeDiscard?.status??null,updatedAt:liveBeforeDiscard?.updatedAt??null},snapshot:{numericTitle:/^\d+$/.test(String(snap.query||'').trim())?String(snap.query).trim():null,titleLength:String(snap.query||'').length,status:snap.status??null,updatedAt:snap.updatedAt??null}},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      updateNode(node.id, {
        title: snap.query,
        sourceQuery: snap.query,
        content: snap.content,
        createdAt: snap.createdAt,
        anchorAt: snap.anchorAt,
        anchorFinishAt: snap.anchorFinishAt ?? null,
        status: snap.status ?? null,
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
  const folderScheduleReserved = !campaignDocMode && isFolderScheduleReserved(parentFolderDoc);
  const folderFrameBounds = folderScheduleReserved
    ? folderScheduleDateInputBounds(parentFolderDoc)
    : null;
  const docStatusReserved = status === DOC_WORK_STATUS.RESERVED;
  // Picker clamp only when not in Reserved free-scope; frame bounds still passed for status UI.
  const childScheduleBounds = (folderScheduleReserved && !docStatusReserved)
    ? folderFrameBounds
    : null;
  const canPersistDocSchedule = folderScheduleReserved || docStatusReserved;

  // Persist sanitize: work statuses are invalid without a folder reservation.
  useEffect(() => {
    if (!node?.id || campaignDocMode) return;
    const live = useNodesStore.getState().nodes[node.id] || node;
    const patch = sanitizeDocStatusForFolderSchedule(live, folderScheduleReserved);
    if (!patch) return;
    setStatus(null);
    setCompleted(false);
    updateNode(node.id, patch);
    openSnapshotRef.current = {
      ...openSnapshotRef.current,
      status: null,
      completed: false,
    };
  }, [node?.id, node?.status, campaignDocMode, folderScheduleReserved, updateNode]);

  const handleAnchorDateChange = (next) => {
    const nextDate = String(next || "").trim();
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
    // Schedule UI: folder frame, or free calendar when status is reserved.
    const persistSchedule = !campaignDocMode && supportsSchedule && canPersistDocSchedule;
    const anchorAt = persistSchedule
      ? (scheduleDate ? isoFromAnchorFields(scheduleDate, anchorTime) : null)
      : null;
    const anchorFinishAt = persistSchedule
      ? (scheduleDate ? isoFromAnchorFields(scheduleDate, anchorFinishTime) : null)
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

    // Schedule on child docs is optional and never mutates the folder window.

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
          status: null,
        }
        : (() => {
          const stale = sanitizeDocStatusForFolderSchedule(
            { status, completed },
            folderScheduleReserved,
          );
          let resolved = stale ? null : status;
          const hasCompleteSchedule = Boolean(
            persistSchedule
            && scheduleDate
            && String(anchorTime || "").trim()
            && String(anchorFinishTime || "").trim()
            && anchorAt
            && anchorFinishAt,
          );
          const docDateInFolderFrame = folderScheduleReserved
            && isDateInputWithinFolderSchedule(scheduleDate, parentFolderDoc);
          const autoNotStarted = defaultStatusAfterScheduleSave({
            status: resolved,
            hasCompleteSchedule,
            docDateInFolderFrame,
          });
          if (autoNotStarted) resolved = autoNotStarted;
          return {
            status: resolved,
            completed: resolved === DOC_WORK_STATUS.COMPLETED,
          };
        })();

      if (isNew) {
        const newId = addNode(title, dataType, payload, parentId, {
          sourceQuery: title,
          createdAt,
          anchorAt,
          anchorFinishAt,
          sourceId,
          objectId: corpusObjectId,
          ...campaignFields,
        });
        // Keep folder↔child link even when parent picker is locked (campaign folders).
        if (parentId) {
          addNodeToDoc(parentId, newId);
          syncNodeToParentDoc(newId, parentId);
        }
        // Flush immediately (same as folder create) so hydrate can't drop the
        // local-only node before the debounced cloud upsert lands.
        try {
          await flushPersistenceSync();
        } catch (err) {
          console.warn("[document sync] flush failed", newId, err);
        }
        const entity = getNode(newId);
        onSaved?.(entity);
        onClose?.();
        return;
      }

      const prevParent = node.parentDocId || null;
      const lockedParentId = !canAssignParent
        ? (parentId || node.parentDocId || initialParentDocId || null)
        : null;
      const effectiveParentId = canAssignParent ? parentId : lockedParentId;

      if (canAssignParent && prevParent && prevParent !== parentId) {
        removeNodeSyncFromDoc(node.id, prevParent);
        removeNodeFromDoc(prevParent, node.id);
      }
      if (effectiveParentId) {
        addNodeToDoc(effectiveParentId, node.id);
      }
      updateNode(node.id, {
        title,
        sourceQuery: title,
        dataType,
        content: payload,
        parentDocId: effectiveParentId,
        linkedToDoc: Boolean(effectiveParentId),
        objectId: corpusObjectId || node.objectId || null,
        createdAt,
        anchorAt,
        anchorFinishAt,
        sourceId,
        ...campaignFields,
      });
      if (effectiveParentId) {
        syncNodeToParentDoc(node.id, effectiveParentId);
      }
      onSaved?.(getNode(node.id));
      onClose?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (value) => {
    setStatus(value);
    setCompleted(value === "completed");
    if (node?.id) updateNode(node.id, { status: value });
    // Live-committed — do not treat as discardable unsaved edit.
    openSnapshotRef.current = {
      ...openSnapshotRef.current,
      status: value ?? null,
      completed: value === "completed",
    };
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
    const live = useNodesStore.getState().nodes[node.id];
    const liveStatus = resolveDocWorkStatus(live);
    if (liveStatus && liveStatus !== status) {
      setStatus(liveStatus);
      setCompleted(liveStatus === "completed");
    }
  };

  return (
    <>
      {/** Occupied intervals are visual only; never block save. */}
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
        status={status}
        onStatusChange={campaignDocMode ? undefined : handleStatusChange}
        onCompletedChange={undefined}
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
        anchorFinishTime={anchorFinishTime}
        onAnchorDateChange={handleAnchorDateChange}
        onAnchorTimeChange={setAnchorTime}
        onAnchorFinishTimeChange={setAnchorFinishTime}
        scheduleOccupied={listOccupiedIntervalsByDate(
          useNodesStore.getState().nodes,
          useDocsStore.getState().docs,
          anchorDate,
          {
            excludeNodeId: node?.id || null,
            objectId: parentObjectId || null,
          },
        )}
        scheduleOverlapHint={hasTimeframeOverlap(
          isoFromAnchorFields(anchorDate, anchorTime),
          isoFromAnchorFields(anchorDate, anchorFinishTime),
          listOccupiedIntervalsByDate(
            useNodesStore.getState().nodes,
            useDocsStore.getState().docs,
            anchorDate,
            { excludeNodeId: node?.id || null, objectId: parentObjectId || null },
          ),
        ) ? t("meta.scheduleOverlapHint") : ""}
        folderScheduleReserved={folderScheduleReserved}
        folderFrameMinDate={folderFrameBounds?.minDate || ""}
        folderFrameMaxDate={folderFrameBounds?.maxDate || ""}
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
