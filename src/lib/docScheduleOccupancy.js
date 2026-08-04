import { anchorFieldsFromIso, isoFromAnchorFields } from "./nodeAnchor.js";
import { formatClock12h } from "./clockFormat.js";

function toMs(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : NaN;
}

function formatTime(iso) {
  return formatClock12h(iso);
}

/**
 * Build occupied intervals for one calendar date.
 * @param {Record<string, any>} nodesById
 * @param {Record<string, any>} docsById
 * @param {string} dateInput YYYY-MM-DD
 * @param {{ excludeNodeId?: string | null, objectId?: string | null }} [options]
 */
export function listOccupiedIntervalsByDate(
  nodesById,
  docsById,
  dateInput,
  options = {},
) {
  const date = String(dateInput || "").trim();
  if (!date) return [];
  const excludeNodeId = options.excludeNodeId || null;
  const objectId = options.objectId || null;
  const out = [];
  for (const node of Object.values(nodesById || {})) {
    if (!node?.id || node.id === excludeNodeId) continue;
    const start = node.anchorAt || null;
    if (!start) continue;
    const { anchorDate } = anchorFieldsFromIso(start);
    if (anchorDate !== date) continue;
    if (objectId) {
      const parentDoc = node.parentDocId ? docsById?.[node.parentDocId] : null;
      const nodeObjectId = node.objectId || parentDoc?.parentObjectId || null;
      if (nodeObjectId !== objectId) continue;
    }
    const finish = node.anchorFinishAt || null;
    const startMs = toMs(start);
    const finishMs = toMs(finish);
    const normalizedFinish = Number.isFinite(finishMs) && finishMs >= startMs
      ? finish
      : isoFromAnchorFields(anchorDate, anchorFieldsFromIso(start).anchorTime || "");
    out.push({
      id: node.id,
      start,
      finish: normalizedFinish,
      startMs,
      finishMs: toMs(normalizedFinish),
      time: `${formatTime(start)}–${formatTime(normalizedFinish)}`,
      title: String(node.sourceQuery || node.title || "Document").trim() || "Document",
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

/**
 * Returns true when [start,finish] overlaps existing occupied intervals.
 * @param {string|null|undefined} startIso
 * @param {string|null|undefined} finishIso
 * @param {Array<{startMs:number,finishMs:number}>} occupied
 */
export function hasTimeframeOverlap(startIso, finishIso, occupied = []) {
  const startMs = toMs(startIso);
  const finishMs = toMs(finishIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs < startMs) return false;
  return occupied.some((item) => (
    Number.isFinite(item.startMs)
    && Number.isFinite(item.finishMs)
    && startMs <= item.finishMs
    && finishMs >= item.startMs
  ));
}
