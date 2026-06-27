import { DOC_NODE_LINK_COLORS } from "../../../lib/docNodeLinkColors.js";

/** Link-color swatches — meta strip or block context. */
export function NodeLinkColorPicker({
  value = "mint",
  onChange,
  className = "",
  label = "Nodes colors",
  variant = "block",
}) {
  if (!onChange && variant !== "inline") return null;

  const swatches = (
    <div className="doc-node-link-colors" role="radiogroup" aria-label={label}>
      {DOC_NODE_LINK_COLORS.map(({ id, stroke, label: colorLabel }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={colorLabel}
          title={colorLabel}
          className={"doc-node-link-color" + (value === id ? " is-on" : "")}
          style={{ "--node-link-swatch": stroke }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(id);
          }}
        />
      ))}
    </div>
  );

  if (variant === "inline") {
    return swatches;
  }

  if (variant === "meta") {
    return (
      <div className={("doc-meta-field doc-meta-field--link-colors " + className).trim()}>
        <span className="doc-meta-field-k">{label}</span>
        {swatches}
      </div>
    );
  }

  return (
    <div className={`doc-block-link-color ${className}`.trim()}>
      <span className="doc-block-link-color__label">{label}</span>
      {swatches}
    </div>
  );
}
