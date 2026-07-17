/**
 * Cross-company folder inheritance projections (timeline-scoped, non-mutating).
 * Host Corpus authority owns effective Created / Launch for guest folders.
 */

import { parseDate } from "../temporal.js";
import {
  CONNECTION_KIND_CROSS_FAMILY_DOC,
  CONNECTION_KIND_CROSS_FAMILY_DATE,
  buildClassifiedConnections,
  isCrossFamilyConnectionKind,
} from "./timelineGraph.js";
import { resolvePrimarySecondarySides } from "./timelinePrimary.js";
import {
  resolveCampaignFolderCreatedDate,
  resolveTimelineDateNodeDate,
  isTimelineDateCanvasNode,
} from "./campaignTimelineRail.js";
import { resolveExplicitDocScheduleDate } from "./docSchedule.js";

/**
 * Host folder Created date used for guest alignment.
 * @param {object|null|undefined} hostDoc
 * @returns {Date|null}
 */
export function resolveHostFolderCreatedDate(hostDoc) {
  if (!hostDoc) return null;
  return resolveCampaignFolderCreatedDate(hostDoc)
    || parseDate(hostDoc.createdAt)
    || resolveExplicitDocScheduleDate(hostDoc)
    || null;
}

/**
 * Host Launch date from canvas date/launch node or doc.launchAt.
 * @param {string} hostDocId
 * @param {object[]} canvasNodes
 * @param {Record<string, object>} docsById
 * @param {string[]} [timelineDateNodeIds]
 * @returns {Date|null}
 */
export function resolveHostFolderLaunchDate(
  hostDocId,
  canvasNodes = [],
  docsById = {},
  timelineDateNodeIds = [],
) {
  if (!hostDocId) return null;
  const allowed = new Set(timelineDateNodeIds || []);
  for (const node of canvasNodes) {
    if (!isTimelineDateCanvasNode(node)) continue;
    if (node.parentDocId !== hostDocId) continue;
    if (allowed.size && !allowed.has(node.id)) continue;
    const d = resolveTimelineDateNodeDate(node);
    if (d) return d;
  }
  const doc = docsById[hostDocId];
  return parseDate(doc?.launchAt) || parseDate(doc?.scheduleStartAt) || null;
}

/**
 * Resolve host/guest sides for a classified cross-family connection.
 * @param {import('../types/timelineTactical.js').ClassifiedConnection} classified
 * @param {string|null} primaryObjectId
 * @returns {{ hostObjectId: string, guestObjectId: string, hostDocId: string|null, guestDocId: string|null, hostNodeId: string, guestNodeId: string }|null}
 */
export function resolveHostGuestSides(classified, primaryObjectId) {
  if (!classified || !isCrossFamilyConnectionKind(classified.kind)) return null;
  if (!classified.fromObjectId || !classified.toObjectId) return null;

  const { primarySide, secondarySide } = resolvePrimarySecondarySides(
    classified.fromObjectId,
    classified.toObjectId,
    primaryObjectId,
  );
  if (!primarySide || !secondarySide) return null;

  const hostIsFrom = primarySide === "from";
  return {
    hostObjectId: hostIsFrom ? classified.fromObjectId : classified.toObjectId,
    guestObjectId: hostIsFrom ? classified.toObjectId : classified.fromObjectId,
    hostDocId: hostIsFrom ? classified.fromDocId : classified.toDocId,
    guestDocId: hostIsFrom ? classified.toDocId : classified.fromDocId,
    hostNodeId: hostIsFrom ? classified.from : classified.to,
    guestNodeId: hostIsFrom ? classified.to : classified.from,
    connectionId: classified.id,
    kind: classified.kind,
  };
}

/**
 * List directed inheritance links under the active Corpus authority.
 * @param {object} params
 * @returns {Array<object>}
 */
export function listInheritanceLinks({
  connections = [],
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  primaryObjectId = null,
} = {}) {
  if (!primaryObjectId) return [];
  const classified = buildClassifiedConnections(
    connections,
    canvasNodes,
    docsById,
    nodeEntitiesById,
    objectsById,
  );
  /** @type {Array<object>} */
  const links = [];
  const seen = new Set();
  for (const c of classified) {
    const sides = resolveHostGuestSides(c, primaryObjectId);
    if (!sides) continue;
    if (sides.hostObjectId !== primaryObjectId) continue;
    const key = `${c.kind}::${sides.hostDocId || sides.hostNodeId}::${sides.guestDocId || sides.guestNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(sides);
  }
  return links;
}

/**
 * Build guest folder/launch projections for the host Corpus timeline.
 * Does not mutate guest docs — only effective dates for display + alerts.
 *
 * @param {object} params
 * @returns {{ guestFolderMarkers: object[], guestLaunchMarkers: object[], crossLinks: object[], alertTargets: object[] }}
 */
export function buildGuestInheritanceProjections({
  connections = [],
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  primaryObjectId = null,
  timelineDocQueue = [],
  timelineDateNodeIds = [],
} = {}) {
  const queued = new Set(timelineDocQueue || []);
  const links = listInheritanceLinks({
    connections,
    canvasNodes,
    docsById,
    nodeEntitiesById,
    objectsById,
    primaryObjectId,
  });

  /** @type {object[]} */
  const guestFolderMarkers = [];
  /** @type {object[]} */
  const guestLaunchMarkers = [];
  /** @type {object[]} */
  const crossLinks = [];
  /** @type {object[]} */
  const alertTargets = [];
  const seenGuestDocs = new Set();

  for (const link of links) {
    if (link.kind === CONNECTION_KIND_CROSS_FAMILY_DOC) {
      const hostDocId = link.hostDocId;
      const guestDocId = link.guestDocId;
      if (!hostDocId || !guestDocId) continue;
      // At least the host or guest must be on the timeline queue.
      if (!queued.has(guestDocId) && !queued.has(hostDocId)) continue;
      if (seenGuestDocs.has(guestDocId)) continue;
      seenGuestDocs.add(guestDocId);

      const hostDoc = docsById[hostDocId];
      const guestDoc = docsById[guestDocId];
      const effectiveCreated = resolveHostFolderCreatedDate(hostDoc);
      if (!effectiveCreated) continue;

      const guestCanvas = canvasNodes.find(
        (n) => (n.docId || n.noteId) === guestDocId
          && (n.canvasKind === "document" || n.dataType === "document"),
      );
      const hostCanvas = canvasNodes.find(
        (n) => (n.docId || n.noteId) === hostDocId
          && (n.canvasKind === "document" || n.dataType === "document"),
      );

      const folderMarker = {
        nodeId: guestCanvas?.id || `inherit-guest-${guestDocId}`,
        date: effectiveCreated,
        ownDate: parseDate(guestDoc?.createdAt) || null,
        effectiveAt: effectiveCreated,
        docId: guestDocId,
        dataType: "document",
        queued: true,
        virtual: !guestCanvas,
        inherited: true,
        inheritanceKind: "createdAt",
        authorityObjectId: primaryObjectId,
        inheritedFromDocId: hostDocId,
        sourceObjectId: link.guestObjectId,
        connectionId: link.connectionId,
        completed: false,
      };
      guestFolderMarkers.push(folderMarker);

      crossLinks.push({
        key: `inherit-doc-${hostDocId}-${guestDocId}`,
        primaryAnchor: `doc-${hostDocId}`,
        inheritAnchor: `doc-${guestDocId}`,
        primaryNodeId: hostCanvas?.id || `doc-${hostDocId}`,
        inheritNodeId: guestCanvas?.id || `inherit-guest-${guestDocId}`,
        authoritativeObjectId: primaryObjectId,
        secondaryObjectId: link.guestObjectId,
        connectionId: link.connectionId,
      });

      alertTargets.push({
        key: `inherit-doc-${primaryObjectId}-${guestDocId}`,
        date: effectiveCreated,
        label: (guestDoc?.title || guestDoc?.category || "Guest folder").trim(),
        kind: "doc",
        kindLabel: "Document",
        workspaceLabel: objectsById[primaryObjectId]?.name || "Corpus",
        inherited: true,
        authorityObjectId: primaryObjectId,
        guestDocId,
        hostDocId,
      });

      const hostLaunch = resolveHostFolderLaunchDate(
        hostDocId,
        canvasNodes,
        docsById,
        timelineDateNodeIds,
      );
      if (hostLaunch) {
        const launchMarker = {
          nodeId: `inherit-launch-${guestDocId}`,
          date: hostLaunch,
          ownDate: parseDate(guestDoc?.launchAt) || null,
          effectiveAt: hostLaunch,
          docId: guestDocId,
          dataType: "date",
          timeMarker: true,
          title: "Launch",
          inherited: true,
          inheritanceKind: "launchAt",
          authorityObjectId: primaryObjectId,
          inheritedFromDocId: hostDocId,
          sourceObjectId: link.guestObjectId,
          connectionId: link.connectionId,
          virtual: true,
        };
        guestLaunchMarkers.push(launchMarker);
        alertTargets.push({
          key: `inherit-launch-${primaryObjectId}-${guestDocId}`,
          date: hostLaunch,
          label: (guestDoc?.title || "Guest").trim(),
          kind: "launch",
          kindLabel: "Launch",
          workspaceLabel: objectsById[primaryObjectId]?.name || "Corpus",
          inherited: true,
          authorityObjectId: primaryObjectId,
          guestDocId,
          hostDocId,
        });
      }
    }

    if (link.kind === CONNECTION_KIND_CROSS_FAMILY_DATE) {
      // Date↔date: guest launch node inherits host launch node datetime.
      const hostNode = canvasNodes.find((n) => n.id === link.hostNodeId);
      const guestNode = canvasNodes.find((n) => n.id === link.guestNodeId);
      const hostLaunch = resolveTimelineDateNodeDate(hostNode);
      if (!hostLaunch || !guestNode) continue;
      const guestDocId = link.guestDocId || guestNode.parentDocId || null;
      guestLaunchMarkers.push({
        nodeId: guestNode.id,
        date: hostLaunch,
        effectiveAt: hostLaunch,
        docId: guestDocId,
        dataType: "date",
        timeMarker: true,
        title: (guestNode.title || "Launch").trim() || "Launch",
        inherited: true,
        inheritanceKind: "launchAt",
        authorityObjectId: primaryObjectId,
        inheritedFromDocId: link.hostDocId,
        sourceObjectId: link.guestObjectId,
        connectionId: link.connectionId,
      });
      crossLinks.push({
        key: `inherit-date-${link.hostNodeId}-${link.guestNodeId}`,
        primaryAnchor: `date-${link.hostNodeId}`,
        inheritAnchor: `date-${link.guestNodeId}`,
        primaryNodeId: link.hostNodeId,
        inheritNodeId: link.guestNodeId,
        authoritativeObjectId: primaryObjectId,
        secondaryObjectId: link.guestObjectId,
        connectionId: link.connectionId,
      });
      if (guestDocId) {
        alertTargets.push({
          key: `inherit-launch-${primaryObjectId}-${guestDocId}-wire`,
          date: hostLaunch,
          label: (docsById[guestDocId]?.title || "Guest").trim(),
          kind: "launch",
          kindLabel: "Launch",
          workspaceLabel: objectsById[primaryObjectId]?.name || "Corpus",
          inherited: true,
          authorityObjectId: primaryObjectId,
          guestDocId,
          hostDocId: link.hostDocId,
        });
      }
    }
  }

  return {
    guestFolderMarkers,
    guestLaunchMarkers,
    crossLinks,
    alertTargets,
  };
}
