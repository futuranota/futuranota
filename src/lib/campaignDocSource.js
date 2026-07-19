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
 * @param {object|null|undefined} folderDoc
 * @param {object|null|undefined} node
 * @returns {boolean}
 */
export function canSetCampaignTimelineSource(folderDoc, node) {
  if (!folderDoc?.campaignActive || !node?.id) return false;
  if (node.parentDocId !== folderDoc.id) return false;
  return isCampaignDocActive(node);
}
