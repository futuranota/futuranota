import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";
import { BlockAnchorFields } from "./BlockAnchorFields.jsx";

export function H1BlockView({
  value,
  onChange,
  queryEnabled = false,
  nodeLinkColor = "dark",
  linksEnabled = true,
  anchorFromNode = false,
  anchorDate = "",
  anchorTime = "",
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  onFocus,
  contentExpanded = true,
  onContentToggle,
  placeholder = "Create a new query or title ",
}) {
  const showSchedule = linksEnabled && queryEnabled && anchorFromNode;

  return (
    <div className="doc-h1-block">
      <DocQueryHandleRow
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        onQueryHandleClick={onQueryHandleClick}
        onFocus={onFocus}
        queryEnabled={queryEnabled}
        nodeLinkColor={nodeLinkColor}
        showQueryHandle={linksEnabled}
        placeholder={placeholder}
        ariaLabel="Title block query or title"
        multiline
      />
      {showSchedule ? (
        <BlockAnchorFields
          readOnly
          showContentToggle={Boolean(onContentToggle)}
          contentExpanded={contentExpanded}
          onContentToggle={onContentToggle}
          anchorDate={anchorDate}
          anchorTime={anchorTime}
        />
      ) : null}
    </div>
  );
}
