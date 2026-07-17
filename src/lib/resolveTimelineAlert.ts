import {
  checkMinuteReminder,
  checkTimelineTrigger,
  daysUntilTarget,
  resolveReminderLeadMs,
  REMINDER_LEAD_CAP_MS,
} from "./checkTimelineTrigger.js";
import { normalizeDoc } from "./normalizeDoc.js";
import { isContentDoc } from "./templateDoc.js";
import { parseDate } from "../temporal.js";
import { buildGuestInheritanceProjections } from "./timelineInheritance.js";
import type { TimelineAlertData, TimelineReminderData } from "../types/timelineAlert";

type ScheduleTarget = {
  key: string;
  date: Date;
  label: string;
  kind: "set" | "doc" | "macro" | "launch";
  kindLabel: string;
  /** Object / workspace name for greeting (“Hola {workspace}”). */
  workspaceLabel?: string;
};

type ResolveTimelineAlertParams = {
  docs?: Record<string, unknown>;
  objects?: Record<string, { name?: string }>;
  objectTimelineTitles?: Record<string, string>;
  selectedObjectId?: string | null;
  primaryObjectId?: string | null;
  inheritObjMode?: boolean;
  canvasNodes?: Array<{
    id?: string;
    canvasKind?: string;
    dataType?: string;
    docId?: string;
    parentDocId?: string;
    content?: unknown;
    title?: string;
    launchAt?: string | null;
    noteId?: string;
  }>;
  canvasConnections?: Array<{ id?: string; from?: string; to?: string }>;
  nodeEntities?: Record<string, {
    anchorAt?: string | null;
    title?: string;
    dataType?: string;
    parentDocId?: string | null;
    linkedToDoc?: string | null;
  }>;
  timelineDocQueue?: string[];
  timelineDocSnapshotsByDocId?: Record<string, {
    anchorDateMs?: number | null;
    children?: Array<{ key?: string; entityId?: string; dateMs?: number; dataType?: string }>;
  }>;
  timelineAgentSets?: Array<{
    id?: string;
    title?: string;
    triggerAt?: string;
  }>;
  timelineDateNodeIds?: string[];
  now?: Date;
  skippedAlertKeys?: Set<string> | string[];
};

function timelineTitleForObject(
  objectId: string,
  objects: Record<string, { name?: string }>,
  objectTimelineTitles: Record<string, string>,
) {
  const custom = (objectTimelineTitles[objectId] || "").trim();
  if (custom) return custom;
  return objects[objectId]?.name?.trim() || "Timeline";
}

function docScheduleLabel(doc: ReturnType<typeof normalizeDoc>) {
  return doc.category?.trim() || doc.title?.trim() || "Document";
}

function addTarget(
  bucket: ScheduleTarget[],
  seen: Set<string>,
  target: Omit<ScheduleTarget, "kindLabel"> & { kindLabel?: string },
) {
  if (seen.has(target.key)) return;
  seen.add(target.key);
  bucket.push({
    ...target,
    kindLabel: target.kindLabel || target.kind,
  });
}

function toSkippedSet(skipped?: Set<string> | string[]) {
  if (!skipped) return new Set<string>();
  if (skipped instanceof Set) return skipped;
  return new Set(skipped.filter(Boolean));
}

export function collectTimelineScheduleTargets({
  docs = {},
  objects = {},
  objectTimelineTitles = {},
  selectedObjectId = null,
  primaryObjectId = null,
  inheritObjMode = false,
  canvasNodes = [],
  canvasConnections = [],
  nodeEntities = {},
  timelineDocQueue = [],
  timelineDocSnapshotsByDocId = {},
  timelineAgentSets = [],
  timelineDateNodeIds = [],
}: ResolveTimelineAlertParams): ScheduleTarget[] {
  const targets: ScheduleTarget[] = [];
  const seen = new Set<string>();

  for (const set of timelineAgentSets) {
    const trigger = parseDate(set.triggerAt);
    if (!trigger || !set.id) continue;
    addTarget(targets, seen, {
      key: `set-${set.id}`,
      date: trigger,
      label: (set.title || "Set").trim(),
      kind: "set",
      kindLabel: "Set",
    });
  }

  for (const docId of timelineDocQueue) {
    const doc = normalizeDoc(docs[docId]);
    const snap = timelineDocSnapshotsByDocId[docId];
    const label = docScheduleLabel(doc);
    const objectId = doc.parentObjectId || null;
    const objectTitle = objectId
      ? timelineTitleForObject(objectId, objects, objectTimelineTitles)
      : label;

    const folderDate = snap?.anchorDateMs
      ? new Date(snap.anchorDateMs)
      : parseDate(doc.scheduleStartAt || doc.launchAt);
    if (folderDate && !Number.isNaN(folderDate.getTime())) {
      addTarget(targets, seen, {
        key: `doc-${docId}`,
        date: folderDate,
        label,
        kind: "doc",
        kindLabel: "Document",
        workspaceLabel: objectTitle,
      });
    } else if (doc.scheduleStartAt || doc.launchAt) {
      const launch = parseDate(doc.scheduleStartAt || doc.launchAt);
      if (launch) {
        addTarget(targets, seen, {
          key: `doc-${docId}`,
          date: launch,
          label,
          kind: "doc",
          kindLabel: "Document",
          workspaceLabel: objectTitle,
        });
      }
    }

    const childKeysSeen = new Set<string>();
    for (const child of snap?.children || []) {
      const entityId = child.entityId || null;
      const childKey = child.key || entityId || `child-${child.dateMs}`;
      childKeysSeen.add(childKey);
      const liveEntity = entityId ? nodeEntities[entityId] : null;
      const liveDate = liveEntity?.anchorAt ? parseDate(liveEntity.anchorAt) : null;
      const date = liveDate
        || (Number.isFinite(child.dateMs) ? new Date(child.dateMs as number) : null);
      if (!date || Number.isNaN(date.getTime())) continue;
      const childLabel = (liveEntity?.title || "").trim()
        || `${label} · ${child.dataType || liveEntity?.dataType || "macro"}`;
      addTarget(targets, seen, {
        key: `macro-${docId}-${childKey}`,
        date,
        label: childLabel,
        kind: "macro",
        kindLabel: "Macro",
        workspaceLabel: objectTitle,
      });
    }

    // Live linked nodes (schedule changed after timeline insert / not yet in snapshot).
    for (const [entityId, entity] of Object.entries(nodeEntities)) {
      if (!entity) continue;
      const parentId = entity.parentDocId || entity.linkedToDoc || null;
      if (parentId !== docId) continue;
      const date = parseDate(entity.anchorAt);
      if (!date) continue;
      const childKey = entityId;
      if (childKeysSeen.has(childKey) || childKeysSeen.has(`entity:${entityId}`)) continue;
      childKeysSeen.add(childKey);
      addTarget(targets, seen, {
        key: `macro-${docId}-${childKey}`,
        date,
        label: (entity.title || "").trim() || `${label} · ${entity.dataType || "macro"}`,
        kind: "macro",
        kindLabel: "Macro",
        workspaceLabel: objectTitle,
      });
    }

    // Keep launch-style object titles available for modal list compatibility.
    if (objectTitle && objectTitle !== label && folderDate) {
      /* no-op — modal still uses collect for all kinds below */
    }
  }

  const objectIds = new Set<string>();
  if (selectedObjectId) objectIds.add(selectedObjectId);

  for (const node of canvasNodes) {
    if (node.canvasKind !== "document" || !node.docId) continue;
    const doc = docs[node.docId] as { parentObjectId?: string } | undefined;
    if (doc?.parentObjectId) objectIds.add(doc.parentObjectId);
  }

  for (const objectId of objectIds) {
    const title = timelineTitleForObject(objectId, objects, objectTimelineTitles);

    const contentDocs = Object.values(docs).filter((raw) => {
      const doc = normalizeDoc(raw);
      return isContentDoc(doc)
        && doc.parentObjectId === objectId
        && (doc.scheduleStartAt || doc.launchAt);
    });

    for (const raw of contentDocs) {
      const doc = normalizeDoc(raw);
      const launch = parseDate(doc.scheduleStartAt || doc.launchAt);
      if (!launch) continue;
      addTarget(targets, seen, {
        key: `launch-${doc.id}`,
        date: launch,
        label: title,
        kind: "launch",
        kindLabel: "Launch",
      });
    }
  }

  for (const node of canvasNodes) {
    if (node.canvasKind !== "launch" || !node.parentDocId) continue;
    const doc = normalizeDoc(docs[node.parentDocId]);
    const objectId = doc.parentObjectId;
    const title = objectId
      ? timelineTitleForObject(objectId, objects, objectTimelineTitles)
      : (doc.title?.trim() || "Timeline");
    const launch = parseDate(node.content) || parseDate(doc.launchAt);
    if (!launch) continue;
    addTarget(targets, seen, {
      key: `launch-node-${node.docId || node.parentDocId}`,
      date: launch,
      label: title,
      kind: "launch",
      kindLabel: "Launch",
    });
  }

  // Guest folders under Corpus authority — use inherited effective Created/Launch.
  const authorityId = primaryObjectId || selectedObjectId || null;
  if (inheritObjMode && authorityId) {
    const projections = buildGuestInheritanceProjections({
      connections: canvasConnections,
      canvasNodes,
      docsById: docs as Record<string, object>,
      nodeEntitiesById: nodeEntities as Record<string, object>,
      objectsById: objects as Record<string, object>,
      primaryObjectId: authorityId,
      timelineDocQueue,
      timelineDateNodeIds,
    });
    for (const alert of projections.alertTargets) {
      addTarget(targets, seen, {
        key: alert.key,
        date: alert.date,
        label: alert.label,
        kind: alert.kind as ScheduleTarget["kind"],
        kindLabel: alert.kindLabel,
        workspaceLabel: alert.workspaceLabel,
      });
    }
  }

  return targets.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Folders + macros from the timeline queue only (for floating reminder). */
export function collectTimelineReminderTargets(params: ResolveTimelineAlertParams): ScheduleTarget[] {
  return collectTimelineScheduleTargets(params).filter(
    (t) => t.kind === "doc" || t.kind === "macro" || t.kind === "launch",
  );
}

export function resolveTimelineAlertsList(params: ResolveTimelineAlertParams) {
  return collectTimelineScheduleTargets(params).map((target) => ({
    key: target.key,
    label: target.label,
    kind: target.kind,
    kindLabel: target.kindLabel,
    daysRemaining: daysUntilTarget(target.date),
    alert: checkTimelineTrigger(target.date, target.label),
  }));
}

export function resolveActiveTimelineAlert(params: ResolveTimelineAlertParams): TimelineAlertData | null {
  for (const entry of resolveTimelineAlertsList(params)) {
    if (entry.alert) return entry.alert;
  }
  return null;
}

/**
 * First folder/macro on the timeline whose start is inside the lead window.
 * Floating card uses a fixed 30m lead so past/dense events cannot hide the next reminder.
 */
export function resolveActiveTimelineReminder(
  params: ResolveTimelineAlertParams,
): TimelineReminderData | null {
  const now = params.now instanceof Date ? params.now : new Date();
  const nowMs = now.getTime();
  const skipped = toSkippedSet(params.skippedAlertKeys);
  const targets = collectTimelineReminderTargets(params);

  for (const target of targets) {
    const startAtMs = target.date.getTime();
    if (!(startAtMs > nowMs)) continue;

    const occurrenceKey = `${target.key}|${startAtMs}`;
    if (skipped.has(target.key) || skipped.has(occurrenceKey)) continue;

    const reminder = checkMinuteReminder({
      alertKey: target.key,
      contentLabel: target.label,
      workspaceLabel: target.workspaceLabel,
      startAt: target.date,
      kind: target.kind === "macro" ? "macro" : "doc",
      leadMs: REMINDER_LEAD_CAP_MS,
      now,
    });
    if (reminder) return reminder;
  }
  return null;
}

/** Debug snapshot: upcoming reminder targets and minutes until start. */
export function inspectTimelineReminderState(params: ResolveTimelineAlertParams) {
  const now = params.now instanceof Date ? params.now : new Date();
  const nowMs = now.getTime();
  const targets = collectTimelineReminderTargets(params);
  const upcoming = targets
    .filter((t) => t.date.getTime() > nowMs)
    .slice(0, 8)
    .map((t) => {
      const startAtMs = t.date.getTime();
      const remainingMs = startAtMs - nowMs;
      return {
        key: t.key,
        label: t.label,
        startIso: t.date.toISOString(),
        mins: Math.round(remainingMs / 60_000),
        inLead: remainingMs > 0 && remainingMs <= REMINDER_LEAD_CAP_MS,
      };
    });
  return {
    nowIso: now.toISOString(),
    targetCount: targets.length,
    upcomingCount: upcoming.length,
    upcoming,
  };
}
