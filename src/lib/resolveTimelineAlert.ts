import { checkTimelineTrigger } from "./checkTimelineTrigger.js";
import { normalizeDoc } from "./normalizeDoc.js";
import { isContentDoc } from "./templateDoc.js";
import { parseDate } from "../temporal.js";
import type { TimelineAlertData } from "../types/timelineAlert";

function timelineTitleForObject(
  objectId: string,
  objects: Record<string, { name?: string }>,
  objectTimelineTitles: Record<string, string>,
) {
  const custom = (objectTimelineTitles[objectId] || "").trim();
  if (custom) return custom;
  return objects[objectId]?.name?.trim() || "Timeline";
}

/**
 * Scan workspace for content launches / launch nodes and return the first active alert.
 */
export function resolveActiveTimelineAlert({
  docs = {},
  objects = {},
  objectTimelineTitles = {},
  selectedObjectId = null,
  canvasNodes = [],
}: {
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
}): TimelineAlertData | null {
  const objectIds = new Set<string>();

  if (selectedObjectId) {
    objectIds.add(selectedObjectId);
  }

  for (const node of canvasNodes) {
    if (node.canvasKind !== "document" || !node.docId) continue;
    const doc = docs[node.docId] as { parentObjectId?: string } | undefined;
    if (doc?.parentObjectId) objectIds.add(doc.parentObjectId);
  }

  for (const objectId of objectIds) {
    const title = timelineTitleForObject(objectId, objects, objectTimelineTitles);

    const contentDocs = Object.values(docs).filter((raw) => {
      const doc = normalizeDoc(raw);
      return (
        isContentDoc(doc)
        && doc.parentObjectId === objectId
        && doc.launchAt
      );
    });

    for (const raw of contentDocs) {
      const doc = normalizeDoc(raw);
      const launch = parseDate(doc.launchAt);
      if (!launch) continue;
      const alert = checkTimelineTrigger(launch, title);
      if (alert) return alert;
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
    const alert = checkTimelineTrigger(launch, title);
    if (alert) return alert;
  }

  return null;
}
