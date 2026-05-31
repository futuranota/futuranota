import { normalizeNodeLinkColorId } from "./docNodeLinkColors.js";
import {
  DOC_KIND_STANDARD,
  emptyTemplateFields,
} from "./templateDoc.js";

/** Default campaign/meta fields on documents. */
export function emptyDocCampaignFields() {
  return {
    ...emptyTemplateFields(),
    version: "",
    category: "",
    launchAt: null,
    campaignActive: false,
    nodeLinkColor: "dark",
  };
}

/** Ensure persisted docs include campaign meta fields. */
export function normalizeDoc(doc) {
  if (!doc) return null;
  const base = emptyDocCampaignFields();
  return {
    ...doc,
    docKind: doc.docKind === "template" ? "template" : DOC_KIND_STANDARD,
    templateKind: doc.templateKind ?? base.templateKind,
    templateSubcategoryDocIds: Array.isArray(doc.templateSubcategoryDocIds)
      ? doc.templateSubcategoryDocIds.filter(Boolean)
      : base.templateSubcategoryDocIds,
    version: typeof doc.version === "string" ? doc.version : base.version,
    category: typeof doc.category === "string" ? doc.category : base.category,
    launchAt: doc.launchAt ?? base.launchAt,
    campaignActive: Boolean(doc.campaignActive),
    nodeLinkColor: normalizeNodeLinkColorId(doc.nodeLinkColor ?? base.nodeLinkColor),
  };
}
