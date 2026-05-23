import { parseDate, toISODate } from "./dates.js";

export function isValidDate(dateString) {
  if (!dateString) return false;
  const s = typeof dateString === "string" ? dateString : toISODate(dateString);
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(s) && !Number.isNaN(new Date(s).getTime());
}

/** Extract ISO dates from canvas nodes linked to date-type nodes */
export function extractDatesFromCanvas(canvasNodes, nodesStore) {
  const dates = [];

  Object.values(canvasNodes || {}).forEach((canvasNode) => {
    const nodeId = canvasNode.nodeId || canvasNode.refId;
    const refType = canvasNode.refType || (nodeId ? "node" : null);

    if (refType !== "node" || !nodeId) return;

    const node = nodesStore.getNode?.(nodeId) ?? nodesStore.nodes?.[nodeId];
    if (!node || node.dataType !== "date") return;

    const raw = typeof node.content === "string" ? node.content : toISODate(node.content);
    if (isValidDate(raw)) dates.push(raw);
  });

  return [...new Set(dates)];
}
