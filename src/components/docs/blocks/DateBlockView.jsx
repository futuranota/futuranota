import { DocQueryHandleRow } from "./DocQueryHandleRow.jsx";

export function DateBlockView({
  title,
  date,
  time = "",
  onTitleChange,
  onDateChange,
  onTimeChange,
  onKeyDown,
  onQueryHandleClick,
}) {
  return (
    <div className="doc-h1-block doc-date-block">
      <DocQueryHandleRow
        value={title}
        onChange={onTitleChange}
        onKeyDown={onKeyDown}
        onQueryHandleClick={onQueryHandleClick}
        placeholder="Insert Query (?) or title"
        ariaLabel="Date block title or query"
      />
      <div className="doc-date-block__fields">
        <input
          type="date"
          className="doc-date-block__date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Date"
        />
        <input
          type="time"
          className="doc-date-block__time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Time"
        />
      </div>
    </div>
  );
}
