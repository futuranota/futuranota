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

/** Prefer scheduleStartAt; legacy launchAt fills a 1-day reservation. */
function resolveNormalizedScheduleFields(doc, base) {
  let scheduleStartAt = doc.scheduleStartAt ?? null;
  let scheduleFinishAt = doc.scheduleFinishAt ?? null;
  const launchAt = doc.launchAt ?? base.launchAt;
  const synthesizedFromLaunch = Boolean(!scheduleStartAt && launchAt);
  if (!scheduleStartAt && launchAt) scheduleStartAt = launchAt;
  if (!scheduleFinishAt && scheduleStartAt) scheduleFinishAt = scheduleStartAt;
  // Launch is its own field — never clobber an explicit launchAt with the
  // schedule reservation (that froze the Launch date node on stale dates).
  // Only fill launchAt from start when the doc has no launch of its own.
  const mirroredLaunch = launchAt ?? scheduleStartAt ?? null;
  // #region agent log
  if (synthesizedFromLaunch && doc?.id) {
    fetch('http://127.0.0.1:7584/ingest/0bdaa960-233e-4e1f-9399-7eb9779e2d4f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'473a3d'},body:JSON.stringify({sessionId:'473a3d',runId:'pre-fix',hypothesisId:'A',location:'normalizeDoc.js:resolveNormalizedScheduleFields',message:'normalizeDoc synthesized schedule from launchAt',data:{docId:doc.id,title:doc.title||null,inScheduleStart:doc.scheduleStartAt??null,inScheduleFinish:doc.scheduleFinishAt??null,inLaunchAt:doc.launchAt??null,outScheduleStart:scheduleStartAt,outScheduleFinish:scheduleFinishAt,outLaunchAt:mirroredLaunch},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
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
