import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function H3BlockView({
  value,
  onChange,
  queryEnabled = false,
  nodeLinkColor = "white",
  linksEnabled = true,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  onFocus,
  placeholder = "Heading 3",
  ghostHints,
  readOnly = false,
}) {
  return (
    <div className="doc-h3-block">
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
        ariaLabel="Heading 3"
        multiline
        ghostHints={ghostHints}
        readOnly={readOnly}
      />
    </div>
  );
}
