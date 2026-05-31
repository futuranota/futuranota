import { useState } from "react";

/** Shared +/- accordion shell for Intel folder panels (Calendar, Forecast). */
export function IntelFolderAccordion({
  summary,
  defaultOpen = false,
  onOpenChange,
  children,
  className = "",
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <article
      className={
        "forecast-accordion"
        + (open ? " is-open" : "")
        + (className ? ` ${className}` : "")
      }
      data-state={open ? "open" : "closed"}
    >
      <h3 className="forecast-accordion__heading">
        <button
          type="button"
          className="forecast-accordion__trigger"
          aria-expanded={open}
          onClick={() => toggle(!open)}
        >
          <span className="forecast-accordion__summary">{summary}</span>
          <span className="forecast-accordion__toggle" aria-hidden>
            <span className="forecast-accordion__icon forecast-accordion__icon--plus" />
            <span className="forecast-accordion__icon forecast-accordion__icon--minus" />
          </span>
        </button>
      </h3>
      {open ? (
        <div className="forecast-accordion__content" role="region">
          {children}
        </div>
      ) : null}
    </article>
  );
}
