import { normalizeSidebarOrder } from "./folderSidebarOrder.js";
import { normalizeKnowledgeImport } from "./knowledgeImport.js";
import { normalizeNodeLinkColorId } from "./docNodeLinkColors.js";
import {
  FOLDER_VIEW_MODE_QUICK,
  normalizeFolderViewMode,
} from "./folderViewMode.js";
import { readLaunchRadarFromDoc } from "./launchRadarSnapshot.js";
import {
  DOC_KIND_CONTENT,
  DOC_KIND_KNOWLEDGE,
  DOC_KIND_PRODUCT,
  DOC_KIND_STANDARD,
  DOC_KIND_TEMPLATE,
  emptyTemplateFields,
  resolveDocKind,
} from "./templateDoc.js";

/** Default campaign/meta fields on documents. */
export function emptyDocCampaignFields() {
  return {
    ...emptyTemplateFields(),
    version: "",
    category: "",
    icon: "",
    departmentId: null,
    launchAt: null,
    scheduleStartAt: null,
    scheduleFinishAt: null,
    campaignActive: false,
    /** Selected campaign document (node id) that drives the folder timeline date. */
    timelineSourceNodeId: null,
    /** Manual Documents list order (left panel); null = sort by title. */
    sidebarOrder: null,
    nodeLinkColor: "dark",
    /** Story (descriptive) or Quick (title + direct link) presentation for linked docs. */
    viewMode: FOLDER_VIEW_MODE_QUICK,
    knowledgeImport: null,
    launchRadarSnapshot: null,
    reportPresentation: null,
  };
}

/** Explicit Schedule only — never invent reservation from launchAt (timeline product model). */
function resolveNormalizedScheduleFields(doc, base) {
  const scheduleStartAt = doc.scheduleStartAt ?? null;
  let scheduleFinishAt = doc.scheduleFinishAt ?? null;
  const launchAt = doc.launchAt ?? base.launchAt ?? null;
  if (!scheduleFinishAt && scheduleStartAt) scheduleFinishAt = scheduleStartAt;
  // Keep Launch as its own field. Do not clobber explicit launchAt with schedule,
  // and do not invent schedule from launchAt (Clear must stay cleared).
  const mirroredLaunch = launchAt ?? null;
  return {
    scheduleStartAt,
    scheduleFinishAt,
    launchAt: mirroredLaunch,
  };
}

function normalizeDocKind(doc) {
  const kind = doc.docKind;
  if (kind === DOC_KIND_TEMPLATE) return DOC_KIND_TEMPLATE;
  if (kind === DOC_KIND_KNOWLEDGE) return DOC_KIND_KNOWLEDGE;
  if (kind === DOC_KIND_PRODUCT) return DOC_KIND_PRODUCT;
  if (kind === DOC_KIND_CONTENT) return DOC_KIND_CONTENT;
  return resolveDocKind(doc);
}

/** Ensure persisted docs include campaign meta fields. */
export function normalizeDoc(doc) {
  if (!doc) return null;
  const base = emptyDocCampaignFields();
  const normalized = {
    ...doc,
    docKind: normalizeDocKind(doc),
    templateKind: doc.templateKind ?? base.templateKind,
    subcategoryDocIds: Array.isArray(doc.subcategoryDocIds)
      ? doc.subcategoryDocIds.filter(Boolean)
      : Array.isArray(doc.templateSubcategoryDocIds)
        ? doc.templateSubcategoryDocIds.filter(Boolean)
        : base.subcategoryDocIds,
    version: typeof doc.version === "string" ? doc.version : base.version,
    category: typeof doc.category === "string" ? doc.category : base.category,
    icon: typeof doc.icon === "string" ? doc.icon : base.icon,
    departmentId: typeof doc.departmentId === "string" && doc.departmentId.trim()
      ? doc.departmentId.trim()
      : null,
    ...resolveNormalizedScheduleFields(doc, base),
    campaignActive: Boolean(doc.campaignActive),
    timelineSourceNodeId: typeof doc.timelineSourceNodeId === "string" && doc.timelineSourceNodeId
      ? doc.timelineSourceNodeId
      : null,
    sidebarOrder: normalizeSidebarOrder(doc.sidebarOrder ?? base.sidebarOrder),
    nodeLinkColor: normalizeNodeLinkColorId(doc.nodeLinkColor ?? base.nodeLinkColor),
    viewMode: normalizeFolderViewMode(doc.viewMode ?? base.viewMode),
    knowledgeImport: normalizeKnowledgeImport(doc.knowledgeImport),
    reportPresentation: doc.reportPresentation ?? base.reportPresentation,
    launchRadarSnapshot: doc.launchRadarSnapshot ?? readLaunchRadarFromDoc(doc) ?? base.launchRadarSnapshot,
  };
  return normalized;
}
