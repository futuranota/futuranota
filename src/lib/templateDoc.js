import { categoriesMatch } from "./docListGrouping.js";

/** Document kind: product, content/campaign, global knowledge corpus, legacy standard, or template. */
export const DOC_KIND_STANDARD = "standard";
export const DOC_KIND_PRODUCT = "product";
export const DOC_KIND_CONTENT = "content";
export const DOC_KIND_KNOWLEDGE = "knowledge";
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

export function isKnowledgeDoc(doc) {
  return doc?.docKind === DOC_KIND_KNOWLEDGE;
}

export function isProductDoc(doc) {
  if (!doc) return false;
  if (doc.docKind === DOC_KIND_KNOWLEDGE) return false;
  if (doc.docKind === DOC_KIND_PRODUCT) return true;
  if (doc.docKind === DOC_KIND_CONTENT || doc.docKind === DOC_KIND_TEMPLATE) return false;
  const linked = doc.subcategoryDocIds ?? doc.templateSubcategoryDocIds ?? [];
  if (Array.isArray(linked) && linked.filter(Boolean).length > 0) return false;
  return Boolean(doc.category?.trim());
}

export function isContentDoc(doc) {
  if (!doc) return false;
  if (doc.docKind === DOC_KIND_KNOWLEDGE) return false;
  if (doc.docKind === DOC_KIND_CONTENT) return true;
  if (doc.docKind === DOC_KIND_PRODUCT || doc.docKind === DOC_KIND_TEMPLATE) return false;
  const linked = doc.subcategoryDocIds ?? doc.templateSubcategoryDocIds ?? [];
  return Array.isArray(linked) && linked.filter(Boolean).length > 0;
}

export function resolveDocKind(doc) {
  if (!doc) return DOC_KIND_STANDARD;
  if (doc.docKind === DOC_KIND_TEMPLATE) return DOC_KIND_TEMPLATE;
  if (doc.docKind === DOC_KIND_KNOWLEDGE) return DOC_KIND_KNOWLEDGE;
  if (doc.docKind === DOC_KIND_PRODUCT) return DOC_KIND_PRODUCT;
  if (doc.docKind === DOC_KIND_CONTENT) return DOC_KIND_CONTENT;
  if (isContentDoc(doc)) return DOC_KIND_CONTENT;
  if (isProductDoc(doc)) return DOC_KIND_PRODUCT;
  return DOC_KIND_STANDARD;
}

export function templateKindLabel(templateKind) {
  if (!templateKind) return null;
  return TEMPLATE_KIND_LABELS[templateKind] || templateKind;
}

/** Product title / label: "Google Pixel" or "Google Pixel 1.0" when version is set. */
export function formatProductDocTitle(category, version) {
  const cat = String(category ?? "").trim();
  const ver = String(version ?? "").trim();
  if (!cat) return "";
  if (!ver) return cat;
  return `${cat} ${ver}`;
}

/** Single line label for versioned products in pickers: "product a 1.0" */
export function formatProductSubcategoryLine(doc) {
  const cat = doc?.category?.trim();
  const ver = doc?.version?.trim();
  if (!cat || !ver) return null;
  return formatProductDocTitle(cat, ver);
}

/** Display title for product docs in lists and selectors. */
export function resolveProductDocDisplayTitle(doc) {
  if (!doc) return "Untitled";
  if (!isProductDoc(doc)) {
    // Content folders: prefer title; category is department subcategory tag.
    return doc.title?.trim() || doc.category?.trim() || "Untitled";
  }
  return formatProductDocTitle(doc.category, doc.version)
    || doc.title?.trim()
    || doc.category?.trim()
    || "Untitled";
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
    .filter((doc) => !isTemplateDoc(doc))
    .filter((doc) => doc.id !== excludeDocId);
}

function productDocsUnderParent(allDocs, parentObjectId, excludeDocId = null) {
  return siblingDocsUnderParent(allDocs, parentObjectId, excludeDocId)
    .filter((doc) => isProductDoc(doc));
}

function contentDocsUnderParent(allDocs, parentObjectId, excludeDocId = null) {
  return siblingDocsUnderParent(allDocs, parentObjectId, excludeDocId)
    .filter((doc) => isContentDoc(doc));
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
    productDocsUnderParent(allDocs, parentObjectId).find(
      (doc) => categoriesMatch(doc.category, cat) && doc.version?.trim() === ver,
    ) ?? null
  );
}

/** Existing version strings for the same product line (parent + category). */
export function listProductVersionOptions(allDocs, parentObjectId, category) {
  const cat = category?.trim();
  if (!parentObjectId || !cat) return [];
  return productDocsUnderParent(allDocs, parentObjectId)
    .filter((doc) => categoriesMatch(doc.category, cat))
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
    productDocsUnderParent(allDocs, parentObjectId, excludeDocId).find(
      (doc) => categoriesMatch(doc.category, cat) && !doc.version?.trim(),
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

  productDocsUnderParent(allDocs, parentObjectId)
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

/** All product docs under an object (folder 1 flat list). */
export function listProductDocs(allDocs, parentObjectId) {
  if (!parentObjectId) return [];
  return listProductCategoryGroups(allDocs, parentObjectId).flatMap((group) => group.docs);
}

/** Content docs under an object (folder 2). */
export function listContentDocs(allDocs, parentObjectId) {
  if (!parentObjectId) return [];
  return contentDocsUnderParent(allDocs, parentObjectId)
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

/** Docs under an object that do not match content, product, knowledge, or template. */
export function listUncategorizedDocs(allDocs, parentObjectId) {
  if (!parentObjectId) return [];
  return siblingDocsUnderParent(allDocs, parentObjectId)
    .filter((doc) => !isContentDoc(doc) && !isProductDoc(doc) && !isKnowledgeDoc(doc) && !isTemplateDoc(doc))
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

/** Global knowledge corpus docs (no parent object). */
export function listKnowledgeDocs(allDocs) {
  return Object.values(allDocs || {})
    .filter((doc) => isKnowledgeDoc(doc))
    .sort((a, b) => resolveKnowledgeDocDisplayTitle(a).localeCompare(resolveKnowledgeDocDisplayTitle(b)));
}

/** Display title for knowledge docs in lists. */
export function resolveKnowledgeDocDisplayTitle(doc) {
  if (!doc) return "Untitled";
  const sub = doc.category?.trim();
  const title = doc.title?.trim();
  const fileName = doc.knowledgeImport?.fileName?.trim();
  return sub || title || fileName || "Untitled";
}

/**
 * One picker row per product category — links to base doc when available.
 * @returns {{ category: string, docId: string, label: string }[]}
 */
export function listProductCategoryPickerOptions(allDocs, parentObjectId, excludeDocId = null) {
  if (!parentObjectId) return [];
  const groups = listProductCategoryGroups(allDocs, parentObjectId);
  return groups
    .map((group) => {
      const base = findUnversionedProductDoc(allDocs, parentObjectId, group.category, excludeDocId);
      const representative = base
        || group.docs.find((doc) => doc.id !== excludeDocId)
        || group.docs[0];
      if (!representative || representative.id === excludeDocId) return null;
      return {
        category: group.category,
        docId: representative.id,
        label: group.category,
      };
    })
    .filter(Boolean);
}

/** Product category names linked from a content doc's subcategoryDocIds. */
export function resolveLinkedProductCategories(allDocs, subcategoryDocIds = []) {
  const byId = allDocs || {};
  const categories = [];
  const seen = new Set();

  for (const id of subcategoryDocIds || []) {
    const doc = byId[id];
    if (!doc) continue;
    const cat = doc.category?.trim();
    if (!cat) continue;
    const key = cat.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    categories.push(cat);
  }

  return categories.sort((a, b) => a.localeCompare(b));
}

/** @deprecated use listContentDocs */
export function listCampaignSubcategoryDocs(allDocs, parentObjectId) {
  return listContentDocs(allDocs, parentObjectId);
}
