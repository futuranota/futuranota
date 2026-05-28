import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";
import { MetricFieldsEditor } from "../../shared/MetricFieldsEditor.jsx";

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
        multiline
      />
      <p className="doc-block-type-label">Metric</p>
      <MetricFieldsEditor
        className="doc-metric-block__fields"
        value={value}
        unit={unit}
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
      />
    </div>
  );
}
