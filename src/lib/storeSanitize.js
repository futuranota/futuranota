function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function findObjectIdByName(objectMap, name) {
  const needle = name.toLowerCase();
  for (const obj of Object.values(objectMap || {})) {
    if (obj?.name?.toLowerCase() === needle) return obj.id;
  }
  return "";
}

/**
 * Remove auto-seeded "yo" when the user already has real companies (refresh race fix).
 * @param {Record<string, { id?: string, name?: string, description?: string, brand?: string, children?: string[], cadence?: object }>} objectMap
 */
export function pruneStrayDefaultYo(objectMap) {
  if (!objectMap || typeof objectMap !== "object") return objectMap || {};

  const yoId = findObjectIdByName(objectMap, "yo");
  if (!yoId) return objectMap;

  const otherIds = Object.keys(objectMap).filter((id) => id !== yoId);
  if (otherIds.length === 0) return objectMap;

  const yo = objectMap[yoId];
  const desc = (yo?.description || "").trim();
  const brand = (yo?.brand || "").trim();
  const children = Array.isArray(yo?.children) ? yo.children : [];
  const cadence = yo?.cadence && typeof yo.cadence === "object" ? yo.cadence : {};
  const cadenceKeys = Object.keys(cadence).filter((key) => {
    const value = cadence[key];
    if (value == null) return false;
    if (typeof value === "object") return Object.keys(value).length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });

  const isPristineSeed = !desc
    && children.length === 0
    && cadenceKeys.length === 0
    && (!brand || brand.toLowerCase() === "yo");

  if (!isPristineSeed) return objectMap;

  const next = { ...objectMap };
  delete next[yoId];
  return next;
}

export function sanitizePersistedSnapshot(parsed) {
  if (!isRecord(parsed)) return null;

  const { objects, docs, nodes } = parsed;
  if (!isRecord(objects) || !isRecord(docs) || !isRecord(nodes)) return null;

  const snapshot = {
    objects,
    docs,
    nodes,
    canvasNodes: isRecord(parsed.canvasNodes) ? parsed.canvasNodes : {},
    canvasConnections: isRecord(parsed.canvasConnections)
      ? parsed.canvasConnections
      : {},
    groupings: isRecord(parsed.groupings) ? parsed.groupings : {},
  };

  if (isRecord(parsed.timelines)) {
    snapshot.timelines = parsed.timelines;
    snapshot.currentTier =
      typeof parsed.currentTier === "string" ? parsed.currentTier : "all";
  }

  if (Array.isArray(parsed.timelineDocQueue)) {
    snapshot.timelineDocQueue = parsed.timelineDocQueue;
    snapshot.timelineDocQueueFocusByDocId = isRecord(parsed.timelineDocQueueFocusByDocId)
      ? parsed.timelineDocQueueFocusByDocId
      : {};
    snapshot.timelineDocSnapshotsByDocId = isRecord(parsed.timelineDocSnapshotsByDocId)
      ? parsed.timelineDocSnapshotsByDocId
      : {};
    snapshot.timelineExcludedChildrenByDocId = isRecord(parsed.timelineExcludedChildrenByDocId)
      ? parsed.timelineExcludedChildrenByDocId
      : {};
    snapshot.expandedDocIds = Array.isArray(parsed.expandedDocIds)
      ? parsed.expandedDocIds
      : [];
    snapshot.timelineAgentSets = Array.isArray(parsed.timelineAgentSets)
      ? parsed.timelineAgentSets
      : [];
    if (typeof parsed.primaryTimelineObjectId === "string" && parsed.primaryTimelineObjectId) {
      snapshot.primaryTimelineObjectId = parsed.primaryTimelineObjectId;
    }
  }

  if (typeof parsed.scheduledAutoRunEnabled === "boolean") {
    snapshot.scheduledAutoRunEnabled = parsed.scheduledAutoRunEnabled;
  }
  if (Array.isArray(parsed.scheduledCompletedTaskKeys)) {
    snapshot.scheduledCompletedTaskKeys = parsed.scheduledCompletedTaskKeys;
  }

  if (Array.isArray(parsed.deletedDocIds)) {
    snapshot.deletedDocIds = parsed.deletedDocIds.filter(Boolean);
  }
  if (Array.isArray(parsed.deletedNodeIds)) {
    snapshot.deletedNodeIds = parsed.deletedNodeIds.filter(Boolean);
  }
  if (Array.isArray(parsed.deletedCompanyIds)) {
    snapshot.deletedCompanyIds = parsed.deletedCompanyIds.filter(Boolean);
  }

  if (typeof parsed.lastSyncedAt === "string" && parsed.lastSyncedAt.trim()) {
    snapshot.lastSyncedAt = parsed.lastSyncedAt.trim();
  }

  return snapshot;
}
