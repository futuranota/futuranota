/**
 * Manually inserted date markers for the object rail.
 * Dates only separate folders / track time — they are not folders or documents.
 * Gate: Select → Insert to timeline (`allowedDateNodeIds`). Never auto-add.
 *
 * Campaign model:
 * - Parent folder chip sits on **today** (time runs as days pass).
 * - Launch date type is the **future** event for the inserted source file.
 * - Launch never renders left of today (no reverse on the rail).
 */

import { parseDate } from "./dates.js";
import { startOfCalendarDay } from "../temporal.js";
import { resolveCanvasNodeObjectId } from "./objectColors.js";
import {
  isCampaignSourceLaunchDateNode,
} from "./campaignDocSource.js";

/**
 * @param {unknown} content
 * @returns {Date|null}
 */
function parseDateContent(content) {
  if (content && typeof content === "object" && content.date) {
    const time = content.time || "12:00";
    const normalized = String(time).length === 5 ? `${time}:00` : time;
    const d = new Date(`${content.date}T${normalized}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseDate(content);
}

/**
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function isTimelineDateCanvasNode(node) {
  if (!node) return false;
  return node.dataType === "date" || node.canvasKind === "launch";
}

/**
 * Campaign folder chip = today (thermometer day). Days advance with the clock.
 * @param {object|null|undefined} doc
 * @param {Date} [today]
 * @returns {Date|null}
 */
export function resolveCampaignFolderCreatedDate(doc, today = new Date()) {
  if (!doc?.campaignActive) return null;
  return startOfCalendarDay(today);
}

/**
 * Parent campaign folder always measures time from today — not launchAt.
 * Launch is a separate future marker on the rail.
 * @param {object|null|undefined} doc
 * @param {Record<string, object>} [_nodesById]
 * @param {Date} [today]
 * @returns {Date|null}
 */
export function resolveCampaignFolderTimelineDate(doc, _nodesById = {}, today = new Date()) {
  if (!doc?.campaignActive) return null;
  return startOfCalendarDay(today);
}

/**
 * Launch / date markers cannot sit before today on the campaign rail.
 * @param {Date|null|undefined} date
 * @param {Date} [today]
 * @returns {Date|null}
 */
export function clampTimelineLaunchNotBeforeToday(date, today = new Date()) {
  if (!date || Number.isNaN(date.getTime())) return null;
  const todayDay = startOfCalendarDay(today);
  const day = startOfCalendarDay(date);
  if (day.getTime() < todayDay.getTime()) return null;
  return date;
}

/**
 * @param {object|null|undefined} node
 * @param {Date} [today]
 * @returns {Date|null}
 */
export function resolveTimelineDateNodeDate(node, today = new Date()) {
  if (!node) return null;
  let raw = null;
  if (node.launchAt) {
    raw = parseDate(node.launchAt);
  }
  if (!raw) raw = parseDateContent(node.content);
  if (!raw) return null;
  if (node.canvasKind === "launch") {
    return clampTimelineLaunchNotBeforeToday(raw, today);
  }
  return raw;
}

/**
 * @param {object} node
 * @param {Record<string, object>} docsById
 * @returns {string|null}
 */
function resolveDateParentDocId(node, docsById = {}) {
  if (!node) return null;
  if (node.parentDocId && docsById[node.parentDocId]) return node.parentDocId;
  if (node.canvasKind === "launch" && node.parentDocId) return node.parentDocId;
  return null;
}

/**
 * Persist a date/Launch marker so it stays on the rail after canvas delete.
 * Removed only via timeline close (×) or campaign source switch.
 * @param {object|null|undefined} node
 * @returns {object|null}
 */
export function captureTimelineDateSnapshot(node) {
  if (!isTimelineDateCanvasNode(node) || !node.id) return null;
  let raw = null;
  if (node.launchAt) raw = parseDate(node.launchAt);
  if (!raw) raw = parseDateContent(node.content);
  if (!raw && Number.isFinite(node.dateMs)) {
    const fromMs = new Date(node.dateMs);
    if (!Number.isNaN(fromMs.getTime())) raw = fromMs;
  }
  if (!raw || Number.isNaN(raw.getTime())) return null;
  return {
    id: node.id,
    parentDocId: node.parentDocId || null,
    title: (node.title || (node.canvasKind === "launch" ? "Launch" : "Date")).trim() || "Date",
    canvasKind: node.canvasKind || null,
    dataType: "date",
    launchAt: node.launchAt || null,
    content: node.content ?? null,
    sourceNodeId: node.sourceNodeId || null,
    dateMs: raw.getTime(),
  };
}

/**
 * Collect manually inserted date markers for an object row.
 * Uses live canvas nodes when present; otherwise persisted snapshots
 * (so deleting Launch from canvas does not drop it from the timeline).
 *
 * @param {object} opts
 * @param {string} opts.objectId
 * @param {object[]} [opts.canvasNodes]
 * @param {Record<string, object>} [opts.docsById]
 * @param {Record<string, object>} [opts.nodeEntitiesById]
 * @param {Set<string>|string[]} [opts.allowedDateNodeIds]
 * @param {Record<string, object>} [opts.dateSnapshotsById]
 * @param {Date} [opts.today]
 * @returns {object[]}
 */
export function collectFolderLinkedDateMarkers({
  objectId,
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  allowedDateNodeIds = [],
  dateSnapshotsById = {},
  today = new Date(),
} = {}) {
  if (!objectId) return [];

  const allowedIds = allowedDateNodeIds instanceof Set
    ? allowedDateNodeIds
    : new Set(allowedDateNodeIds);
  if (!allowedIds.size) return [];

  const liveById = new Map(
    canvasNodes.filter((n) => n?.id).map((n) => [n.id, n]),
  );

  /** @type {object[]} */
  const markers = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const id of allowedIds) {
    if (seen.has(id)) continue;
    const live = liveById.get(id);
    const snap = dateSnapshotsById[id] || null;
    const node = live || (snap ? { ...snap, id } : null);
    if (!node || !isTimelineDateCanvasNode(node)) continue;

    let date = resolveTimelineDateNodeDate(node, today);
    if (!date && Number.isFinite(snap?.dateMs)) {
      date = node.canvasKind === "launch"
        ? clampTimelineLaunchNotBeforeToday(new Date(snap.dateMs), today)
        : new Date(snap.dateMs);
    }
    if (!date) continue;

    const parentDocId = resolveDateParentDocId(node, docsById) || snap?.parentDocId || null;
    const parentDoc = parentDocId ? docsById[parentDocId] : null;
    // Campaigns: only the current source file's Launch date type on the rail.
    if (!isCampaignSourceLaunchDateNode(node, parentDoc)) continue;

    const objectForNode = (live
      ? resolveCanvasNodeObjectId(live, docsById, nodeEntitiesById)
      : null)
      || (parentDocId ? docsById[parentDocId]?.parentObjectId : null);
    if (objectForNode !== objectId) continue;

    seen.add(id);
    markers.push({
      nodeId: id,
      date,
      docId: parentDocId || undefined,
      dataType: "date",
      timeMarker: true,
      title: (node.title || (node.canvasKind === "launch" ? "Launch" : "Date")).trim() || "Date",
      canvasKind: node.canvasKind || null,
      fromSnapshot: !live,
    });
  }

  return markers;
}
