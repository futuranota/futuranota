import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function H1BlockView({
  value,
  onChange,
  queryEnabled = false,
  nodeLinkColor = "dark",
  linksEnabled = true,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  onFocus,
  placeholder = "Create a new query or title ",
}) {
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
    </div>
  );
}
