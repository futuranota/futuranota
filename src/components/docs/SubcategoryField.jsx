import {
  listSubcategoryPickerGroups,
  resolveSubcategoryLines,
} from "../../lib/templateDoc.js";

function SubcategoryOption({ docId, label, checked, onToggle, readOnly = false }) {
  if (readOnly) {
    return (
      <li>
        <span className="template-subcategory-option template-subcategory-option--readonly">
          <span className="template-subcategory-option-label">{label}</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <label className="template-subcategory-option">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(docId)}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="template-subcategory-option-label">{label}</span>
      </label>
    </li>
  );
}

function SubcategoryPicker({ parentId, allDocs, selectedDocIds, onChange, excludeDocId = null }) {
  const { linkable, withSubcategories } = listSubcategoryPickerGroups(
    allDocs,
    parentId,
    excludeDocId,
    selectedDocIds,
  );
  const selectedSet = new Set(selectedDocIds || []);

  const toggle = (docId) => {
    const next = selectedSet.has(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...(selectedDocIds || []), docId];
    onChange(next);
  };

  if (!parentId) {
    return (
      <p className="template-subcategory-empty dim">
        Assign a parent (header icon) to list documents.
      </p>
    );
  }

  if (linkable.length === 0 && withSubcategories.length === 0) {
    return (
      <p className="template-subcategory-empty dim">
        No docs with category under this parent yet.
      </p>
    );
  }

  return (
    <div className="template-subcategory-picker">
      {linkable.length > 0 ? (
        <ul className="template-subcategory-list" role="list">
          {linkable.map(({ docId, label }) => (
            <SubcategoryOption
              key={docId}
              docId={docId}
              label={label}
              checked={selectedSet.has(docId)}
              onToggle={toggle}
            />
          ))}
        </ul>
      ) : null}
      {linkable.length > 0 && withSubcategories.length > 0 ? (
        <hr className="template-subcategory-divider" aria-hidden />
      ) : null}
      {withSubcategories.length > 0 ? (
        <ul className="template-subcategory-list template-subcategory-list--grouped" role="list">
          {withSubcategories.map(({ docId, label }) => (
            <SubcategoryOption
              key={docId}
              docId={docId}
              label={label}
              readOnly
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SubcategoryField({
  parentId,
  allDocs,
  selectedDocIds = [],
  onChange,
  excludeDocId = null,
  optional = true,
}) {
  const lines = resolveSubcategoryLines(allDocs, selectedDocIds);

  return (
    <div className="doc-meta-field template-subcategory-field">
      <span className="doc-meta-field-k">
        Subcategories
        {optional ? <span className="doc-meta-field-optional"> (optional)</span> : null}
      </span>
      {lines.length > 0 ? (
        <ul className="template-subcategory-lines" role="list">
          {lines.map(({ docId, label }) => (
            <li key={docId}>
              <span className="template-subcategory-line-tag">{label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <SubcategoryPicker
        parentId={parentId}
        allDocs={allDocs}
        selectedDocIds={selectedDocIds}
        onChange={onChange}
        excludeDocId={excludeDocId}
      />
    </div>
  );
}
