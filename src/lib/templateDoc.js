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
    subcategoryDocIds: [],
  };
}

/** @deprecated use subcategoryDocIds */
export const templateSubcategoryDocIds = "subcategoryDocIds";

export function isTemplateDoc(doc) {
  return doc?.docKind === DOC_KIND_TEMPLATE;
}

export function templateKindLabel(templateKind) {
  if (!templateKind) return null;
  return TEMPLATE_KIND_LABELS[templateKind] || templateKind;
}

/** Single line label: "product a 1.0" */
export function formatProductSubcategoryLine(doc) {
  const category = doc?.category?.trim();
  const version = doc?.version?.trim();
  if (!category || !version) return null;
  return `${category} ${version}`;
}

function docCandidateLabel(doc) {
  return formatProductSubcategoryLine(doc) || doc?.category?.trim() || doc?.title?.trim() || "Untitled";
}

/** Docs with a category filled and no subcategories of their own. */
export function isSubcategoryLinkCandidate(doc, selectedDocIds = []) {
  if (!doc?.id) return false;
  if (selectedDocIds.includes(doc.id)) return true;
  if (doc.docKind === DOC_KIND_TEMPLATE) return false;
  const category = doc.category?.trim();
  if (!category) return false;
  const linked = doc.subcategoryDocIds ?? doc.templateSubcategoryDocIds ?? [];
  return !Array.isArray(linked) || linked.filter(Boolean).length === 0;
}

function siblingDocsUnderParent(allDocs, parentObjectId, excludeDocId = null) {
  return Object.values(allDocs || {})
    .filter((doc) => doc.parentObjectId === parentObjectId)
    .filter((doc) => doc.docKind !== DOC_KIND_TEMPLATE)
    .filter((doc) => doc.id !== excludeDocId);
}

function docHasOwnSubcategories(doc) {
  const linked = doc.subcategoryDocIds ?? doc.templateSubcategoryDocIds ?? [];
  return Array.isArray(linked) && linked.filter(Boolean).length > 0;
}

function toSubcategoryListItem(doc) {
  return {
    docId: doc.id,
    label: docCandidateLabel(doc),
  };
}

/**
 * Sibling documents under the same parent that can be linked as subcategories:
 * have a category, no subcategories of their own (plus already-selected ids).
 */
export function listSubcategoryDocCandidates(
  allDocs,
  parentObjectId,
  excludeDocId = null,
  selectedDocIds = [],
) {
  if (!parentObjectId) return [];
  const selected = selectedDocIds || [];
  return siblingDocsUnderParent(allDocs, parentObjectId, excludeDocId)
    .filter((doc) => isSubcategoryLinkCandidate(doc, selected))
    .map(toSubcategoryListItem)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Linkable (top) vs docs that already have subcategories (bottom). */
export function listSubcategoryPickerGroups(
  allDocs,
  parentObjectId,
  excludeDocId = null,
  selectedDocIds = [],
) {
  if (!parentObjectId) {
    return { linkable: [], withSubcategories: [] };
  }
  const selected = selectedDocIds || [];
  const withCategory = siblingDocsUnderParent(allDocs, parentObjectId, excludeDocId)
    .filter((doc) => doc.category?.trim());

  const linkable = withCategory
    .filter((doc) => isSubcategoryLinkCandidate(doc, selected))
    .map(toSubcategoryListItem)
    .sort((a, b) => a.label.localeCompare(b.label));

  const withSubcategories = withCategory
    .filter((doc) => docHasOwnSubcategories(doc))
    .map(toSubcategoryListItem)
    .sort((a, b) => a.label.localeCompare(b.label));

  return { linkable, withSubcategories };
}

/** @deprecated use listSubcategoryDocCandidates */
export function listProductSubcategoryCandidates(allDocs, parentObjectId, excludeDocId = null) {
  return listSubcategoryDocCandidates(allDocs, parentObjectId, excludeDocId).filter(
    (item) => item.label.includes(" "),
  );
}

export function findProductVersionDoc(allDocs, parentObjectId, category, version) {
  const cat = category?.trim();
  const ver = version?.trim();
  if (!parentObjectId || !cat || !ver) return null;
  return (
    Object.values(allDocs || {}).find(
      (doc) => doc.parentObjectId === parentObjectId
        && doc.docKind !== DOC_KIND_TEMPLATE
        && doc.category?.trim() === cat
        && doc.version?.trim() === ver,
    ) ?? null
  );
}

/** Existing version strings for the same product line (parent + category). */
export function listProductVersionOptions(allDocs, parentObjectId, category) {
  const cat = category?.trim();
  if (!parentObjectId || !cat) return [];
  return Object.values(allDocs || {})
    .filter((doc) => doc.parentObjectId === parentObjectId)
    .filter((doc) => doc.docKind !== DOC_KIND_TEMPLATE)
    .filter((doc) => doc.category?.trim() === cat)
    .filter((doc) => doc.version?.trim())
    .map((doc) => ({
      docId: doc.id,
      version: doc.version.trim(),
    }))
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
}

/** Unversioned base doc for a product category (same parent + category, empty version). */
export function findUnversionedProductDoc(allDocs, parentObjectId, category, excludeDocId = null) {
  const cat = category?.trim();
  if (!parentObjectId || !cat) return null;
  return (
    Object.values(allDocs || {}).find(
      (doc) => doc.id !== excludeDocId
        && doc.parentObjectId === parentObjectId
        && doc.docKind !== DOC_KIND_TEMPLATE
        && doc.category?.trim() === cat
        && !doc.version?.trim(),
    ) ?? null
  );
}

/** Where to open after deleting a version instance. */
export function resolveDocAfterVersionDelete(allDocs, deletedDocId, parentObjectId, category) {
  const cat = category?.trim();
  if (!parentObjectId || !cat) return null;

  const base = findUnversionedProductDoc(allDocs, parentObjectId, category, deletedDocId);
  if (base) return base.id;

  const remaining = listProductVersionOptions(allDocs, parentObjectId, category)
    .filter(({ docId }) => docId !== deletedDocId);
  return remaining[0]?.docId ?? null;
}

export function buildProductDeleteConfirmMessage({
  title,
  category = "",
  version = "",
  versionInstanceCount = 0,
}) {
  const cat = category.trim();
  const ver = version.trim();
  const label = title?.trim() || "this document";

  if (ver && cat) {
    if (versionInstanceCount > 1) {
      return `Delete version ${ver} of "${cat}"? ${versionInstanceCount - 1} other version(s) will remain. This cannot be undone.`;
    }
    return `Delete version ${ver} of "${cat}"? This cannot be undone.`;
  }

  if (cat && versionInstanceCount > 0) {
    return `Delete "${label}"? ${versionInstanceCount} version instance(s) of "${cat}" will remain. This cannot be undone.`;
  }

  return `Delete "${label}" and its nodes? This cannot be undone.`;
}

export function resolveSubcategoryLines(allDocs, docIds = []) {
  const byId = allDocs || {};
  return (docIds || [])
    .map((id) => {
      const doc = byId[id];
      if (!doc) return null;
      const label = formatProductSubcategoryLine(doc) || doc.title?.trim() || "Untitled";
      return { docId: id, label };
    })
    .filter(Boolean);
}

function sortProductGroupDocs(docs) {
  return [...docs].sort((a, b) => {
    const aVer = a.version?.trim() || "";
    const bVer = b.version?.trim() || "";
    if (!aVer && bVer) return -1;
    if (aVer && !bVer) return 1;
    if (!aVer && !bVer) return 0;
    return aVer.localeCompare(bVer, undefined, { numeric: true });
  });
}

/**
 * Product lines under one object: one folder per category with all sibling docs
 * (unversioned base + version instances, e.g. "product b" and "product b 1.0").
 */
export function listProductCategoryGroups(allDocs, parentObjectId) {
  if (!parentObjectId) return [];
  const byCategory = new Map();

  siblingDocsUnderParent(allDocs, parentObjectId)
    .filter((doc) => doc.category?.trim())
    .forEach((doc) => {
      const cat = doc.category.trim();
      const key = cat.toLowerCase();
      if (!byCategory.has(key)) {
        byCategory.set(key, { category: cat, docs: [] });
      }
      byCategory.get(key).docs.push(doc);
    });

  return [...byCategory.values()]
    .map((group) => ({
      category: group.category,
      docs: sortProductGroupDocs(group.docs),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/** Versioned product docs (category + version) for the Campaign subfolder. */
export function listCampaignSubcategoryDocs(allDocs, parentObjectId) {
  if (!parentObjectId) return [];
  return siblingDocsUnderParent(allDocs, parentObjectId)
    .filter((doc) => formatProductSubcategoryLine(doc))
    .sort((a, b) => {
      const aLabel = formatProductSubcategoryLine(a);
      const bLabel = formatProductSubcategoryLine(b);
      return aLabel.localeCompare(bLabel, undefined, { numeric: true });
    });
}
