import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatProductSubcategoryLine,
  listProductDocs,
} from "../../lib/templateDoc.js";

function productDocLabel(doc) {
  return formatProductSubcategoryLine(doc) || doc.category?.trim() || doc.title?.trim() || "Untitled";
}

export function ProductCategorySubcategoryField({
  parentId,
  allDocs,
  selectedDocIds = [],
  onChange,
  excludeDocId = null,
  optional = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const productOptions = useMemo(() => {
    if (!parentId) return [];
    return listProductDocs(allDocs, parentId)
      .filter((doc) => doc.id !== excludeDocId)
      .map((doc) => ({
        docId: doc.id,
        label: productDocLabel(doc),
      }));
  }, [allDocs, parentId, excludeDocId]);

  const selectedSet = new Set(selectedDocIds || []);
  const selectedLabels = (selectedDocIds || [])
    .map((docId) => productOptions.find((opt) => opt.docId === docId)?.label
      || (allDocs?.[docId] ? productDocLabel(allDocs[docId]) : null))
    .filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggleProduct = (docId) => {
    if (selectedSet.has(docId)) {
      onChange((selectedDocIds || []).filter((id) => id !== docId));
      return;
    }
    onChange([...(selectedDocIds || []), docId]);
  };

  const triggerLabel = selectedLabels.length
    ? selectedLabels.join(", ")
    : "select opcion";

  return (
    <div className="doc-meta-field template-subcategory-field product-select-field">
      <span className="doc-meta-field-k">
        Subcategories
        {optional ? <span className="doc-meta-field-optional"> (optional)</span> : null}
      </span>
      {!parentId ? (
        <p className="template-subcategory-empty dim">
          Assign a parent (header icon) to list products.
        </p>
      ) : productOptions.length === 0 ? (
        <p className="template-subcategory-empty dim">
          No products yet — create products in the first folder.
        </p>
      ) : (
        <div className="product-picker" ref={rootRef}>
          <button
            type="button"
            className={
              "product-picker__trigger"
              + (open ? " is-open" : "")
              + (selectedLabels.length ? " has-value" : " is-empty")
            }
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Select products"
          >
            <span className="product-picker__label">{triggerLabel}</span>
            <span className="product-picker__chevron" aria-hidden>{open ? "▾" : "›"}</span>
          </button>
          {open ? (
            <ul className="product-picker__menu" role="listbox" aria-multiselectable="true">
              {productOptions.map(({ docId, label }) => {
                const selected = selectedSet.has(docId);
                return (
                  <li key={docId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={"product-picker__option" + (selected ? " is-selected" : "")}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProduct(docId);
                      }}
                    >
                      {selected ? <span className="product-picker__check" aria-hidden>✓</span> : null}
                      <span>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
