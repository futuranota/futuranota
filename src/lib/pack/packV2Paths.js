import { isContentDoc, isProductDoc } from "../templateDoc.js";

/**
 * @param {string} value
 * @param {number} [maxLen]
 */
export function slugify(value, maxLen = 56) {
  const s = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
  return s || "untitled";
}

/**
 * @param {string} base
 * @param {Set<string>} used
 */
function uniqueSlug(base, used) {
  let slug = slugify(base);
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${slug}-${n}`)) n += 1;
  slug = `${slug}-${n}`;
  used.add(slug);
  return slug;
}

/**
 * @param {import('../../types/docs.js').Doc} doc
 * @param {Set<string>} used
 */
export function productDocFolder(doc, used) {
  const cat = uniqueSlug(doc.category || doc.title || "product", used);
  const verUsed = new Set();
  const ver = uniqueSlug(doc.version || "base", verUsed);
  return `Products/${cat}/${ver}`;
}

/**
 * @param {import('../../types/docs.js').Doc} doc
 * @param {Set<string>} used
 */
export function contentDocFolder(doc, used) {
  const slug = uniqueSlug(doc.title || doc.id, used);
  return `Content/${slug}`;
}

/**
 * @param {import('../../types/docs.js').Doc} doc
 * @param {Set<string>} used
 */
export function knowledgeDocFolder(doc, used) {
  const label = doc.knowledgeImport?.fileName || doc.title || doc.id;
  const slug = uniqueSlug(label, used);
  return `Knowledge/${slug}`;
}

/**
 * @param {import('../../types/docs.js').Doc} doc
 * @param {Set<string>} usedSlugs
 */
export function resolveDocFolderPath(doc, usedSlugs) {
  if (isProductDoc(doc)) return productDocFolder(doc, usedSlugs);
  if (isContentDoc(doc)) return contentDocFolder(doc, usedSlugs);
  if (doc?.docKind === "knowledge") return knowledgeDocFolder(doc, usedSlugs);
  return `Documents/${uniqueSlug(doc.title || doc.id, usedSlugs)}`;
}

/**
 * @param {import('../../types/nodes.js').Node} node
 * @param {Set<string>} used
 */
export function nodeFileSlug(node, used) {
  const label = node.title || node.content?.slice?.(0, 40) || node.id;
  return uniqueSlug(label, used);
}
