import { checkTimelineTrigger, daysUntilTarget } from "./checkTimelineTrigger.js";
import { normalizeDoc } from "./normalizeDoc.js";
import { isContentDoc } from "./templateDoc.js";
import { parseDate } from "../temporal.js";
import type { TimelineAlertData } from "../types/timelineAlert";

type ScheduleTarget = {
  key: string;
  date: Date;
  label: string;
  kind: "set" | "doc" | "macro" | "launch";
  kindLabel: string;
};

type ResolveTimelineAlertParams = {
  docs?: Record<string, unknown>;
  objects?: Record<string, { name?: string }>;
  objectTimelineTitles?: Record<string, string>;
  selectedObjectId?: string | null;
  canvasNodes?: Array<{
    canvasKind?: string;
    docId?: string;
    parentDocId?: string;
    content?: unknown;
  }>;
  timelineDocQueue?: string[];
  timelineDocSnapshotsByDocId?: Record<string, {
    anchorDateMs?: number | null;
    children?: Array<{ key?: string; dateMs?: number }>;
  }>;
  timelineAgentSets?: Array<{
    id?: string;
    title?: string;
    triggerAt?: string;
  }>;
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

export function collectTimelineScheduleTargets({
  docs = {},
  objects = {},
  objectTimelineTitles = {},
  selectedObjectId = null,
  canvasNodes = [],
  timelineDocQueue = [],
  timelineDocSnapshotsByDocId = {},
  timelineAgentSets = [],
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

    if (snap?.anchorDateMs) {
      addTarget(targets, seen, {
        key: `doc-${docId}`,
        date: new Date(snap.anchorDateMs),
        label: objectTitle,
        kind: "doc",
        kindLabel: "Document",
      });
    } else if (doc.scheduleStartAt || doc.launchAt) {
      const launch = parseDate(doc.scheduleStartAt || doc.launchAt);
      if (launch) {
        addTarget(targets, seen, {
          key: `doc-${docId}`,
          date: launch,
          label: objectTitle,
          kind: "doc",
          kindLabel: "Document",
        });
      }
    }

    for (const child of snap?.children || []) {
      if (!Number.isFinite(child.dateMs)) continue;
      const childKey = child.key || `child-${child.dateMs}`;
      addTarget(targets, seen, {
        key: `macro-${docId}-${childKey}`,
        date: new Date(child.dateMs as number),
        label: `${label} · macro`,
        kind: "macro",
        kindLabel: "Macro",
      });
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

  return targets.sort((a, b) => a.date.getTime() - b.date.getTime());
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
