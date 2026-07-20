/**
 * Campaign folder = container. Campaign documents (nodes under that folder) own
 * active/inactive + launchAt + optional window. Timeline row date follows one
 * selected SOURCE document (active only).
 */

import { parseDate } from "./dates.js";

export const CAMPAIGN_DOC_STATUS_ACTIVE = "active";
export const CAMPAIGN_DOC_STATUS_INACTIVE = "inactive";

/**
 * @param {unknown} status
 * @returns {"active"|"inactive"}
 */
export function normalizeCampaignDocStatus(status) {
  return status === CAMPAIGN_DOC_STATUS_ACTIVE
    ? CAMPAIGN_DOC_STATUS_ACTIVE
    : CAMPAIGN_DOC_STATUS_INACTIVE;
}

/**
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function isCampaignDocActive(node) {
  return normalizeCampaignDocStatus(node?.campaignStatus) === CAMPAIGN_DOC_STATUS_ACTIVE;
}

/**
 * Two-letter micro label for the timeline folder chip (source identity).
 * @param {string|null|undefined} title
 * @returns {string}
 */
export function campaignDocInitials(title) {
  const raw = String(title || "").trim();
  if (!raw) return "";
  const parts = raw.split(/[\s/_.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

/**
 * @param {object|null|undefined} folderDoc
 * @param {Record<string, object>} [nodesById]
 * @returns {object|null}
 */
export function resolveCampaignSourceNode(folderDoc, nodesById = {}) {
  if (!folderDoc?.campaignActive) return null;
  const sourceId = folderDoc.timelineSourceNodeId;
  if (!sourceId) return null;
  const node = nodesById[sourceId];
  if (!node) return null;
  if (node.parentDocId && node.parentDocId !== folderDoc.id) return null;
  if (!isCampaignDocActive(node)) return null;
  return node;
}

/**
 * Launch date that positions / labels the campaign folder row.
 * Only the active selected source moves this date.
 * @param {object|null|undefined} folderDoc
 * @param {Record<string, object>} [nodesById]
 * @returns {Date|null}
 */
export function resolveCampaignFolderSourceDate(folderDoc, nodesById = {}) {
  const source = resolveCampaignSourceNode(folderDoc, nodesById);
  if (!source) return null;
  return parseDate(source.launchAt) || null;
}

/**
 * Full title of the campaign folder's timeline source document.
 * @param {object|null|undefined} folderDoc
 * @param {Record<string, object>} [nodesById]
 * @returns {string}
 */
export function resolveCampaignSourceTitle(folderDoc, nodesById = {}) {
  const source = resolveCampaignSourceNode(folderDoc, nodesById);
  if (!source) return "";
  return String(source.title || source.sourceQuery || "").trim();
}

/**
 * @param {object|null|undefined} folderDoc
 * @param {Record<string, object>} [nodesById]
 * @returns {string}
 */
export function resolveCampaignSourceMicroLabel(folderDoc, nodesById = {}) {
  const source = resolveCampaignSourceNode(folderDoc, nodesById);
  if (!source) return "";
  return campaignDocInitials(source.title || source.sourceQuery);
}

/**
 * Whether a node under a campaign folder can become the timeline source.
 * Insert-to-timeline may switch source regardless of active/inactive — the
 * freshest inserted file wins for that parent folder.
 * @param {object|null|undefined} folderDoc
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function canSetCampaignTimelineSource(folderDoc, node) {
  if (!folderDoc?.campaignActive || !node?.id) return false;
  if (node.parentDocId !== folderDoc.id) return false;
  if (node.dataType === "date") return false;
  return true;
}

/**
 * True when the canvas selection is a child file entity under a campaign folder
 * (vs a bare folder document card). Used for source/Launch sync, not as a
 * timeline admission gate — folder cards enqueue like regular folders.
 * @param {object|null|undefined} canvasNode
 * @param {Record<string, object>} [nodeEntitiesById]
 * @param {Record<string, object>} [docsById]
 * @returns {boolean}
 */
export function isCampaignTimelineFileInsert(canvasNode, nodeEntitiesById = {}, docsById = {}) {
  if (!canvasNode?.noteId) return false;
  const entity = nodeEntitiesById[canvasNode.noteId];
  if (!entity?.parentDocId) return false;
  return Boolean(docsById[entity.parentDocId]?.campaignActive);
}

/**
 * Timeline queue: at most one campaign folder. Keep `keepDocId`, drop the rest.
 * @param {string[]} queue
 * @param {Record<string, object>} docsById
 * @param {string|null} keepDocId
 * @returns {{ queue: string[], removed: string[] }}
 */
export function replaceCampaignFoldersInTimelineQueue(queue, docsById = {}, keepDocId = null) {
  /** @type {string[]} */
  const removed = [];
  const next = (queue || []).filter((id) => {
    if (!docsById[id]?.campaignActive) return true;
    if (keepDocId && id === keepDocId) return true;
    removed.push(id);
    return false;
  });
  return { queue: next, removed };
}

/**
 * Deterministic canvas Launch node id for a campaign file.
 * @param {string} entityId
 * @returns {string}
 */
export function campaignLaunchCanvasNodeId(entityId) {
  return `CN-launch-node-${entityId}`;
}

/**
 * Whether a Launch/date canvas node belongs to the folder's current source file.
 * Non-campaign dates always pass.
 * @param {object|null|undefined} dateNode
 * @param {object|null|undefined} folderDoc
 * @returns {boolean}
 */
export function isCampaignSourceLaunchDateNode(dateNode, folderDoc) {
  if (!folderDoc?.campaignActive) return true;
  if (!dateNode || dateNode.canvasKind !== "launch") return true;
  const sourceId = folderDoc.timelineSourceNodeId || null;
  if (!sourceId) return false;
  if (dateNode.sourceNodeId === sourceId) return true;
  return dateNode.id === campaignLaunchCanvasNodeId(sourceId);
}

/**
 * One Launch date type on the rail per campaign folder — the active source's.
 * Drops other launches for that folder. Does **not** auto-add Launch from canvas;
 * Launch enters only via Select → Insert on the date node (or stays if already queued).
 * @param {Iterable<string>} dateNodeIds
 * @param {object} opts
 * @param {string} opts.folderDocId
 * @param {string|null} opts.sourceEntityId
 * @param {object[]} [opts.canvasNodes]
 * @param {Record<string, object>} [opts.dateSnapshotsById]
 * @returns {string[]}
 */
export function syncCampaignFolderLaunchDateQueue(
  dateNodeIds,
  {
    folderDocId,
    sourceEntityId = null,
    canvasNodes = [],
    dateSnapshotsById = {},
  } = {},
) {
  if (!folderDocId) return [...dateNodeIds];
  const keepLaunchId = sourceEntityId ? campaignLaunchCanvasNodeId(sourceEntityId) : null;
  const next = new Set();
  for (const id of dateNodeIds) {
    const node = canvasNodes.find((n) => n.id === id);
    const snap = dateSnapshotsById[id];
    const parentDocId = node?.parentDocId || snap?.parentDocId || null;
    const isLaunch = Boolean(
      node?.canvasKind === "launch" || snap?.canvasKind === "launch",
    );
    if (isLaunch && parentDocId === folderDocId) {
      if (keepLaunchId && id === keepLaunchId) next.add(id);
      continue;
    }
    next.add(id);
  }
  return [...next];
}
