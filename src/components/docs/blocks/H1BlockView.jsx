import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function H1BlockView({
  value,
  onChange,
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
    </div>
  );
}
