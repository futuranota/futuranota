import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function H1BlockView({
  value,
  onChange,
  queryEnabled = false,
  nodeLinkColor = "white",
  linksEnabled = true,
  onKeyDown,
  autoFocus = false,
  onQueryHandleClick,
  onFocus,
  placeholder = "Create a title",
  ghostHints,
  titleAddon = null,
  readOnly = false,
  shredNodeId = null,
  onOpenFile = null,
  shredDragEnabled = true,
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
        ghostHints={ghostHints}
        titleAddon={titleAddon}
        readOnly={readOnly}
        shredNodeId={shredNodeId}
        onOpenFile={onOpenFile}
        shredDragEnabled={shredDragEnabled}
      />
    </div>
  );
}
