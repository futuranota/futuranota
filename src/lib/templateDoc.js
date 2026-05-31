/** Document kind: standard product file vs campaign analysis template. */
export const DOC_KIND_STANDARD = "standard";
export const DOC_KIND_TEMPLATE = "template";

export const TEMPLATE_KIND_CAMPAIGN = "campaign";

export const TEMPLATE_KIND_LABELS = {
  [TEMPLATE_KIND_CAMPAIGN]: "Campaign",
};

export function emptyTemplateFields() {
  return {
    docKind: DOC_KIND_STANDARD,
    templateKind: null,
    templateSubcategoryDocIds: [],
  };
}

export function isTemplateDoc(doc) {
  return doc?.docKind === DOC_KIND_TEMPLATE;
}

export function templateKindLabel(templateKind) {
  if (!templateKind) return null;
  return TEMPLATE_KIND_LABELS[templateKind] || templateKind;
}

/** Single line label: "product a + 1.0" */
export function formatProductSubcategoryLine(doc) {
  const category = doc?.category?.trim();
  const version = doc?.version?.trim();
  if (!category || !version) return null;
  return `${category} + ${version}`;
}

/**
 * Product docs under the same parent with category + version filled.
 * @returns {{ docId: string, label: string }[]}
 */
export function listProductSubcategoryCandidates(allDocs, parentObjectId, excludeDocId = null) {
  if (!parentObjectId) return [];
  return Object.values(allDocs || {})
    .filter((doc) => doc.parentObjectId === parentObjectId)
    .filter((doc) => doc.docKind !== DOC_KIND_TEMPLATE)
    .filter((doc) => doc.id !== excludeDocId)
    .map((doc) => {
      const label = formatProductSubcategoryLine(doc);
      if (!label) return null;
      return { docId: doc.id, label };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveSubcategoryLines(allDocs, docIds = []) {
  const byId = allDocs || {};
  return (docIds || [])
    .map((id) => {
      const doc = byId[id];
      const label = formatProductSubcategoryLine(doc);
      return label ? { docId: id, label } : null;
    })
    .filter(Boolean);
}
