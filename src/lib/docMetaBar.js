import { daysBetween, fmtDate, getToday } from "../data.jsx";
import { normalizeDoc } from "./normalizeDoc.js";

export { emptyDocCampaignFields } from "./normalizeDoc.js";

export function formatCampaignLabel(active) {
  return active ? "ACTIVE" : "INACTIVE";
}

function parseLaunchDate(launchAt) {
  if (!launchAt) return null;
  const d = new Date(launchAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Countdown from today to launch (aligned with temporal countdownLabel). */
export function computeWindowLabel(today, launchAt) {
  const launch = parseLaunchDate(launchAt);
  if (!launch) return null;
  const t = today instanceof Date ? today : getToday();
  const diff = daysBetween(t, launch);
  if (diff > 0) return `T−${diff}d`;
  if (diff < 0) return `T+${-diff}d`;
  return "TODAY";
}

export function buildMetaBarFromDoc({ doc, objectsById = {}, today = getToday() }) {
  if (!doc) {
    return {
      brand: null,
      version: null,
      campaign: null,
      category: null,
      launch: null,
      window: null,
    };
  }

  const normalized = normalizeDoc(doc);
  const parent =
    normalized.parentObjectId && objectsById[normalized.parentObjectId]
      ? objectsById[normalized.parentObjectId]
      : null;
  const launchDate = parseLaunchDate(normalized.launchAt);

  return {
    brand: parent?.name?.trim() || null,
    version: normalized.version?.trim() || null,
    campaign: formatCampaignLabel(normalized.campaignActive),
    category: normalized.category?.trim() || null,
    launch: launchDate ? fmtDate(launchDate, "short") : null,
    window: computeWindowLabel(today, normalized.launchAt),
  };
}

export function resolveActiveDocFromCanvas(selection, canvasNodes, docs) {
  if (!Array.isArray(selection) || !selection.length) return null;
  const nodeById = new Map((canvasNodes || []).map((n) => [n.id, n]));
  for (const id of selection) {
    const node = nodeById.get(id);
    if (!node || node.canvasKind !== "document") continue;
    const docId = node.docId || node.noteId;
    if (!docId) continue;
    const doc = docs[docId];
    if (doc) return normalizeDoc(doc);
  }
  return null;
}

export function buildMetaBarFromCanvas({
  selection = [],
  canvasNodes = [],
  docs = {},
  objectsById = {},
  today = getToday(),
}) {
  const doc = resolveActiveDocFromCanvas(selection, canvasNodes, docs);
  return buildMetaBarFromDoc({ doc, objectsById, today });
}
