import { Mark } from '../../marketing/components/Mark.jsx';

/**
 * Full-page / gate loading with the brand Mark animated as if writing.
 */
export function MarkLoading({ label = 'Loading…', size = 36 }) {
  return (
    <div className="mark-loading" role="status" aria-busy="true" aria-live="polite">
      <span className="mark-loading__stage" aria-hidden="true">
        <span className="mark-loading__stroke" />
        <span className="mark-loading__mark">
          <Mark size={size} />
        </span>
      </span>
      {label ? (
        <span className="mark-loading__label">{label}</span>
      ) : null}
    </div>
  );
}
