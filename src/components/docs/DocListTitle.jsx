import {
  isKnowledgeDoc,
  isProductDoc,
  resolveKnowledgeDocDisplayTitle,
  resolveProductDocDisplayTitle,
} from "../../lib/templateDoc.js";

/**
 * Sidebar / folder doc label — category is bold; files and nested rows stay lighter.
 * @param {{ doc: import("../../types/docs.js").Doc, nestedInGroup?: boolean }} props
 */
export function DocListTitle({ doc, nestedInGroup = false }) {
  if (!doc) return null;

  const isKnowledge = isKnowledgeDoc(doc);
  const isProduct = isProductDoc(doc);
  const category = doc.category?.trim();
  const version = doc.version?.trim();

  if (isProduct && category && nestedInGroup) {
    if (version) {
      return <span className="lp-doc-file-name" title={version}>{version}</span>;
    }
    const title = doc.title?.trim();
    if (title && title.toLowerCase() !== category.toLowerCase()) {
      return <span className="lp-doc-file-name" title={title}>{title}</span>;
    }
    return <span className="lp-doc-file-name lp-doc-file-name--muted">—</span>;
  }

  if (isProduct && category) {
    const fullLabel = version ? `${category} ${version}` : category;
    return (
      <span className="lp-doc-list-label" title={fullLabel}>
        <span className="lp-doc-category">{category}</span>
        {version ? <span className="lp-doc-version">{version}</span> : null}
      </span>
    );
  }

  const fallback = isKnowledge
    ? resolveKnowledgeDocDisplayTitle(doc)
    : resolveProductDocDisplayTitle(doc);

  if (isKnowledge && doc.knowledgeImport?.fileName) {
    return <span className="lp-doc-file-name" title={fallback}>{fallback}</span>;
  }

  return <span className="lp-doc-title-text" title={fallback}>{fallback}</span>;
}
