import { daysBetween, getToday } from "../data.jsx";
import { formatMmDdYy } from "./docDates.js";
import { normalizeDoc } from "./normalizeDoc.js";
import {
  formatProductSubcategoryLine,
  resolveSubcategoryLines,
  isContentDoc,
  isProductDoc,
  resolveLinkedProductCategories,
} from "./templateDoc.js";
import {
  isCampaignDocActive,
  resolveCampaignSourceNode,
} from "./campaignDocSource.js";

export { emptyDocCampaignFields } from "./normalizeDoc.js";
export { DOC_NODE_LINK_COLORS } from "./docNodeLinkColors.js";

export function formatCampaignLabel(active) {
  return active ? "active" : "inactive";
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

/** Days until/since launch for doc meta strip, e.g. "25 days". */
export function formatWindowDays(today, launchAt) {
  const launch = parseLaunchDate(launchAt);
  if (!launch) return null;
  const t = today instanceof Date ? today : getToday();
  const diff = daysBetween(t, launch);
  const n = Math.abs(diff);
  if (n === 0) return "0 days";
  return `${n} days`;
}

/**
 * Window label from child doc window fields, else countdown from launchAt.
 * @param {Date} today
 * @param {object|null|undefined} sourceNode
 * @returns {string|null}
 */
export function formatSourceWindowDays(today, sourceNode) {
  if (!sourceNode) return null;
  const start = parseLaunchDate(sourceNode.windowStartAt);
  const end = parseLaunchDate(sourceNode.windowEndAt);
  if (start && end) {
    const span = Math.max(0, daysBetween(start, end));
    if (span === 0) return "0 days";
    return `${span} days`;
  }
  return formatWindowDays(today, sourceNode.launchAt);
}

/** Comma-separated labels for linked subcategory documents. */
export function formatSubcategoriesDisplay(allDocs, docIds = []) {
  const lines = resolveSubcategoryLines(allDocs, docIds);
  if (!lines.length) return null;
  return lines.map(({ label }) => label).join(", ");
}

/** MetaBar "Category" cell — product/content use doc.category; legacy uses category + version line. */
function resolveMetaBarCategory(doc) {
  const category = doc?.category?.trim();
  if (isContentDoc(doc) || isProductDoc(doc)) {
    return category || null;
  }
  return formatProductSubcategoryLine(doc) || category || null;
}

/**
 * Campaign folder MetaBar: CAMPAIGN / LAUNCH / WINDOW from the source child doc.
 * Folder keeps corpus / brand / category / subcategories only.
 */
export function buildMetaBarFromDoc({
  doc,
  objectsById = {},
  selectedObjectId = null,
  allDocs = {},
  nodeEntitiesById = {},
  today = getToday(),
}) {
  const selectedObject =
    selectedObjectId && objectsById[selectedObjectId]
      ? objectsById[selectedObjectId]
      : null;
  const corpus = selectedObject?.name?.trim() || null;
  const brandFromSelection = selectedObject?.brand?.trim() || null;

  if (!doc) {
    return {
      corpus,
      brand: brandFromSelection,
      product: null,
      campaign: null,
      subcategories: null,
      launch: null,
      window: null,
    };
  }

  const normalized = normalizeDoc(doc);
  const parent =
    normalized.parentObjectId && objectsById[normalized.parentObjectId]
      ? objectsById[normalized.parentObjectId]
      : null;
  const brandFromDoc = parent?.brand?.trim() || null;
  const linkedProducts = isContentDoc(normalized)
    ? resolveLinkedProductCategories(allDocs, normalized.subcategoryDocIds)
    : null;
  const subcategoriesDisplay = linkedProducts?.length
    ? linkedProducts.join(", ")
    : formatSubcategoriesDisplay(allDocs, normalized.subcategoryDocIds);

  let campaign = null;
  let launch = null;
  let windowLabel = null;

  if (normalized.campaignActive) {
    // Container folder: status + dates live on the source child document.
    const source = resolveCampaignSourceNode(normalized, nodeEntitiesById)
      || (normalized.timelineSourceNodeId
        ? nodeEntitiesById[normalized.timelineSourceNodeId]
        : null);
    if (source) {
      campaign = formatCampaignLabel(isCampaignDocActive(source));
      const launchDate = parseLaunchDate(source.launchAt);
      launch = launchDate ? formatMmDdYy(launchDate) : null;
      windowLabel = formatSourceWindowDays(today, source);
    }
  } else {
    // Non-campaign folders may still surface their own launch (content schedule mirror).
    const launchDate = parseLaunchDate(normalized.launchAt);
    campaign = null;
    launch = launchDate ? formatMmDdYy(launchDate) : null;
    windowLabel = formatWindowDays(today, normalized.launchAt);
  }

  return {
    corpus,
    brand: brandFromSelection || brandFromDoc,
    product: resolveMetaBarCategory(normalized),
    campaign,
    subcategories: subcategoriesDisplay,
    launch,
    window: windowLabel,
  };
}

/** Merge canvas node snapshot fields into doc for MetaBar (content category, container flag). */
export function mergeDocWithCanvasNodeMetadata(doc, node) {
  if (!doc) return null;
  const normalized = normalizeDoc(doc);
  if (!node || node.canvasKind !== "document") return normalized;

  return normalizeDoc({
    ...normalized,
    category: node.contentCategory || normalized.category,
    // Do not pull Launch from canvas folder card — child source owns it.
    campaignActive: normalized.campaignActive ?? Boolean(node.campaignActive),
  });
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
    if (doc) return mergeDocWithCanvasNodeMetadata(doc, node);
  }
  return null;
}

/**
 * Last campaign folder permanently queued on the timeline for the given company.
 * Requires company context — never returns a global "last campaign" without ownership.
 * @param {string[]} timelineDocQueue
 * @param {Record<string, object>} docs
 * @param {string|null} selectedObjectId
 * @returns {object|null}
 */
export function resolveCampaignFolderFromTimelineQueue(
  timelineDocQueue = [],
  docs = {},
  selectedObjectId = null,
) {
  if (!selectedObjectId) return null;
  if (!Array.isArray(timelineDocQueue) || !timelineDocQueue.length) return null;
  for (let i = timelineDocQueue.length - 1; i >= 0; i -= 1) {
    const doc = docs[timelineDocQueue[i]];
    if (doc?.campaignActive && doc.parentObjectId === selectedObjectId) {
      return normalizeDoc(doc);
    }
  }
  return null;
}

export function buildMetaBarFromCanvas({
  selection = [],
  canvasNodes = [],
  docs = {},
  objectsById = {},
  selectedObjectId = null,
  expandedDocId = null,
  activeDocMetaDraft = null,
  timelineDocQueue = [],
  nodeEntitiesById = {},
  today = getToday(),
}) {
  let doc = null;

  if (expandedDocId && docs[expandedDocId]) {
    doc = normalizeDoc(docs[expandedDocId]);
    if (activeDocMetaDraft?.docId === expandedDocId) {
      doc = normalizeDoc({ ...doc, ...activeDocMetaDraft });
    }
  } else {
    doc = resolveActiveDocFromCanvas(selection, canvasNodes, docs);
  }

  if (!doc) {
    doc = resolveCampaignFolderFromTimelineQueue(
      timelineDocQueue,
      docs,
      selectedObjectId,
    );
  }

  return buildMetaBarFromDoc({
    doc,
    objectsById,
    selectedObjectId,
    allDocs: docs,
    nodeEntitiesById,
    today,
  });
}
