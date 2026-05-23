import { DATA_TYPE_LABELS, DATA_TYPE_ICONS } from "../../lib/nodeDataTypes.js";

export function DataTypeTag({ type, className = "" }) {
  const label = DATA_TYPE_LABELS[type] || type;
  const icon = DATA_TYPE_ICONS[type] || "◯";
  return (
    <span className={"fn-data-type-tag " + className}>
      <span aria-hidden>{icon}</span> {label}
    </span>
  );
}
