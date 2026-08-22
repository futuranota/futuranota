import { parseDate, startOfCalendarDay } from "../temporal.js";
import { isTacticalDocumentNode } from "./timelineGraph.js";

/**
 * Canvas TEXT / file chip (macronodo) — not a folder card, date, or launch.
 * Inserting these must queue the file, not the parent folder.
 */
export function isTimelineFileCanvasNode(node, nodeEntitiesById = {}) {
  if (!node || node.hidden) return false;
  if (isTacticalDocumentNode(node)) return false;
  if (node.dataType === "date" || node.canvasKind === "launch") return false;
  if (node.canvasKind === "agent" || node.dataType === "agent") return false;
  const entityId = node.noteId || null;
  if (!entityId) return false;
  const entity = nodeEntitiesById[entityId];
  return Boolean(entity?.parentDocId || node.parentDocId);
}

export function pushFileToTimelineQueue(queue, entityId) {
  if (!entityId) return queue;
  if (queue.includes(entityId)) return queue;
  return [...queue, entityId];
}

/**
 * Display date for a file on the rail.
 * Real schedule (`anchorAt`) when present; otherwise today (no commitment).
 * @returns {{ date: Date, unscheduled: boolean } | null}
 */
export function resolveFileRailDisplayDate(entity, today = new Date()) {
  if (!entity) return null;
  const scheduled = parseDate(entity.anchorAt);
  if (scheduled) return { date: scheduled, unscheduled: false };
  const day = startOfCalendarDay(today instanceof Date ? today : new Date());
  return { date: day, unscheduled: true };
}
