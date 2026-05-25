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

  return snapshot;
}
