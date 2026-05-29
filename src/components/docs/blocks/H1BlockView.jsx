import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";
import { BlockAnchorFields } from "./BlockAnchorFields.jsx";

export function H1BlockView({
  value,
  onChange,
  queryEnabled = false,
  nodeLinkColor = "mint",
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
        queryEnabled={queryEnabled}
        nodeLinkColor={nodeLinkColor}
        placeholder="Insert Query (?) or title"
        ariaLabel="Title block query or title"
        multiline
      />
      {queryEnabled ? (
        <BlockAnchorFields
          anchorDate={anchorDate}
          anchorTime={anchorTime}
          onAnchorDateChange={onAnchorDateChange}
          onAnchorTimeChange={onAnchorTimeChange}
        />
      ) : null}
    </div>
  );
}
