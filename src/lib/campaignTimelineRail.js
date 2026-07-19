/**
 * Manually inserted date markers for the object rail.
 * Dates only separate folders / track time — they are not folders or documents.
 * Gate: Select → Insert to timeline (`allowedDateNodeIds`). Never auto-add.
 */

import { parseDate } from "./dates.js";
import { resolveCanvasNodeObjectId } from "./objectColors.js";
import { resolveCampaignFolderSourceDate } from "./campaignDocSource.js";

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
 * Campaign folder chip date = Created (fallback when no active source launch).
 * @param {object|null|undefined} doc
 * @returns {Date|null}
 */
export function resolveCampaignFolderCreatedDate(doc) {
  if (!doc?.campaignActive) return null;
  return parseDate(doc.createdAt) || parseDate(doc.updatedAt);
}

/**
 * Prefer active source document launchAt; else Created.
 * @param {object|null|undefined} doc
 * @param {Record<string, object>} [nodesById]
 * @returns {Date|null}
 */
export function resolveCampaignFolderTimelineDate(doc, nodesById = {}) {
  if (!doc?.campaignActive) return null;
  return resolveCampaignFolderSourceDate(doc, nodesById)
    || resolveCampaignFolderCreatedDate(doc);
}

/**
 * @param {object|null|undefined} node
 * @returns {Date|null}
 */
export function resolveTimelineDateNodeDate(node) {
  if (!node) return null;
  if (node.launchAt) {
    const fromLaunch = parseDate(node.launchAt);
    if (fromLaunch) return fromLaunch;
  }
  return parseDateContent(node.content);
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
 * Collect manually inserted date markers for an object row.
 *
 * @param {object} opts
 * @param {string} opts.objectId
 * @param {object[]} [opts.canvasNodes]
 * @param {Record<string, object>} [opts.docsById]
 * @param {Record<string, object>} [opts.nodeEntitiesById]
 * @param {Set<string>|string[]} [opts.allowedDateNodeIds]
 * @returns {object[]}
 */
export function collectFolderLinkedDateMarkers({
  objectId,
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  allowedDateNodeIds = [],
} = {}) {
  if (!objectId || !canvasNodes.length) return [];

  const allowedIds = allowedDateNodeIds instanceof Set
    ? allowedDateNodeIds
    : new Set(allowedDateNodeIds);
  if (!allowedIds.size) return [];

  /** @type {object[]} */
  const markers = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const node of canvasNodes) {
    if (!isTimelineDateCanvasNode(node)) continue;
    if (!allowedIds.has(node.id)) continue;
    if (seen.has(node.id)) continue;

    const date = resolveTimelineDateNodeDate(node);
    if (!date) continue;

    const parentDocId = resolveDateParentDocId(node, docsById);
    const objectForNode = resolveCanvasNodeObjectId(node, docsById, nodeEntitiesById)
      || (parentDocId ? docsById[parentDocId]?.parentObjectId : null);
    if (objectForNode !== objectId) continue;

    seen.add(node.id);
    markers.push({
      nodeId: node.id,
      date,
      docId: parentDocId || undefined,
      dataType: "date",
      timeMarker: true,
      title: (node.title || (node.canvasKind === "launch" ? "Launch" : "Date")).trim() || "Date",
      canvasKind: node.canvasKind || null,
    });
  }

  return markers;
}
