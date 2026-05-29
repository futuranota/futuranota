import { normalizeNodeLinkColorId } from "./docNodeLinkColors.js";

/** Default campaign/meta fields on documents. */
export function emptyDocCampaignFields() {
  return {
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
    version: typeof doc.version === "string" ? doc.version : base.version,
    category: typeof doc.category === "string" ? doc.category : base.category,
    launchAt: doc.launchAt ?? base.launchAt,
    campaignActive: Boolean(doc.campaignActive),
    nodeLinkColor: normalizeNodeLinkColorId(doc.nodeLinkColor ?? base.nodeLinkColor),
  };
}
