/**
 * Persist host→guest folder links captured at Insert.
 * Keeps guest chips under the host timeline after canvas clear/delete.
 * Does not change wire classification or campaign/Launch insert.
 */

import {
  CONNECTION_KIND_CROSS_FAMILY_DOC,
  CONNECTION_KIND_CROSS_FAMILY_DATE,
  buildClassifiedConnections,
  isCrossFamilyConnectionKind,
} from "./timelineGraph.js";

/**
 * @param {{ kind?: string, hostDocId?: string|null, guestDocId?: string|null, hostNodeId?: string|null, guestNodeId?: string|null }} link
 */
export function guestLinkKey(link) {
  if (!link) return "";
  return `${link.kind || "cross-family-doc"}::${link.hostDocId || link.hostNodeId || ""}::${link.guestDocId || link.guestNodeId || ""}`;
}

/**
 * Capture cross-company folder links from the current canvas wires.
 * @param {object} params
 * @returns {object[]}
 */
export function buildTimelineGuestLinksFromConnections({
  connections = [],
  canvasNodes = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  touchedDocIds = [],
} = {}) {
  const touched = new Set((touchedDocIds || []).filter(Boolean));
  const classified = buildClassifiedConnections(
    connections,
    canvasNodes,
    docsById,
    nodeEntitiesById,
    objectsById,
  );
  /** @type {object[]} */
  const links = [];
  const seen = new Set();
  for (const c of classified) {
    if (!c || !isCrossFamilyConnectionKind(c.kind)) continue;
    if (!c.fromObjectId || !c.toObjectId || c.fromObjectId === c.toObjectId) continue;
    if (
      c.kind !== CONNECTION_KIND_CROSS_FAMILY_DOC
      && c.kind !== CONNECTION_KIND_CROSS_FAMILY_DATE
    ) {
      continue;
    }
    if (
      touched.size
      && c.fromDocId
      && c.toDocId
      && !touched.has(c.fromDocId)
      && !touched.has(c.toDocId)
    ) {
      continue;
    }
    const sides = {
      kind: c.kind,
      hostObjectId: c.fromObjectId,
      guestObjectId: c.toObjectId,
      hostDocId: c.fromDocId || null,
      guestDocId: c.toDocId || null,
      hostNodeId: c.from,
      guestNodeId: c.to,
      connectionId: c.id || null,
    };
    const id = guestLinkKey(sides);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    links.push({ id, ...sides });
  }
  return links;
}
