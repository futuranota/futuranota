import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function H2BlockView({
  value,
  onChange,
  queryEnabled = false,
  nodeLinkColor = "dark",
  linksEnabled = true,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  onFocus,
  placeholder = "Heading 2",
  ghostHints,
}) {
  return (
    <div className="doc-h2-block">
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
        ariaLabel="Heading 2"
        multiline
        ghostHints={ghostHints}
      />
    </div>
  );
}
