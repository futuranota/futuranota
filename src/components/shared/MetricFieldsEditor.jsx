import { METRIC_UNIT_OPTIONS } from "../../lib/metricUnits.js";

/**
 * Metric row: [dato text] [unit picker].
 * value/unit map to node.content { value, unit } and doc metric blocks.
 */
export function MetricFieldsEditor({
  value = "",
  unit = "",
  onValueChange,
  onUnitChange,
  valueInputRef = null,
  className = "",
  dataPlaceholder = "Dato",
}) {
  const unitStr = String(unit ?? "");

  return (
    <div className={`metric-fields-editor ${className}`.trim()}>
      <input
        ref={valueInputRef}
        type="text"
        className="metric-fields-editor__data"
        value={value != null ? String(value) : ""}
        placeholder={dataPlaceholder}
        onChange={(e) => onValueChange(e.target.value)}
        aria-label="Dato"
        spellCheck={false}
      />
      <select
        className="metric-fields-editor__picker"
        value={unitStr}
        onChange={(e) => onUnitChange(e.target.value)}
        aria-label="Metric unit"
      >
        {METRIC_UNIT_OPTIONS.map((opt) => (
          <option key={opt.id || "none"} value={opt.id}>
            {opt.label}
          </option>
        ))}
        {!METRIC_UNIT_OPTIONS.some((o) => o.id === unitStr) && unitStr ? (
          <option value={unitStr}>{unitStr}</option>
        ) : null}
      </select>
    </div>
  );
}
