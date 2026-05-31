import { normalizeNodeLinkColorId } from "./docNodeLinkColors.js";
import {
  DOC_KIND_CONTENT,
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
    launchAt: null,
    campaignActive: false,
    nodeLinkColor: "dark",
  };
}

function normalizeDocKind(doc) {
  const kind = doc.docKind;
  if (kind === DOC_KIND_TEMPLATE) return DOC_KIND_TEMPLATE;
  if (kind === DOC_KIND_PRODUCT) return DOC_KIND_PRODUCT;
  if (kind === DOC_KIND_CONTENT) return DOC_KIND_CONTENT;
  return resolveDocKind(doc);
}

/** Ensure persisted docs include campaign meta fields. */
export function normalizeDoc(doc) {
  if (!doc) return null;
  const base = emptyDocCampaignFields();
  return {
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
    launchAt: doc.launchAt ?? base.launchAt,
    campaignActive: Boolean(doc.campaignActive),
    nodeLinkColor: normalizeNodeLinkColorId(doc.nodeLinkColor ?? base.nodeLinkColor),
  };
}
