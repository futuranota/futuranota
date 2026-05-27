import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function MetricBlockView({
  title,
  value,
  unit,
  onTitleChange,
  onValueChange,
  onUnitChange,
  onKeyDown,
  onQueryHandleClick,
}) {
  return (
    <div className="doc-h1-block doc-metric-block">
      <DocQueryHandleRow
        value={title}
        onChange={onTitleChange}
        onKeyDown={onKeyDown}
        onQueryHandleClick={onQueryHandleClick}
        placeholder="Insert Query (?) or title"
        ariaLabel="Metric block title or query"
      />
      <div className="doc-metric-block__fields">
        <input
          type="number"
          className="doc-metric-block__value"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Metric value"
        />
        <input
          type="text"
          className="doc-metric-block__unit"
          value={unit}
          placeholder="unit"
          onChange={(e) => onUnitChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Metric unit"
        />
      </div>
    </div>
  );
}
