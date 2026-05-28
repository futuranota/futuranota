import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";
import { BlockAnchorFields } from "./BlockAnchorFields.jsx";

export function H1BlockView({
  value,
  onChange,
  anchorDate = "",
  anchorTime = "",
  onAnchorDateChange,
  onAnchorTimeChange,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
}) {
  return (
    <div className="doc-h1-block">
      <DocQueryHandleRow
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        onQueryHandleClick={onQueryHandleClick}
        placeholder="Insert Query (?) or title"
        ariaLabel="Title block query or title"
      />
      <BlockAnchorFields
        anchorDate={anchorDate}
        anchorTime={anchorTime}
        onAnchorDateChange={onAnchorDateChange}
        onAnchorTimeChange={onAnchorTimeChange}
      />
    </div>
  );
}
