/** Inline loading spinner for search buttons (Intel + node modal). */
export function SearchSpinner({ className = "", size = 17 }) {
  return (
    <span
      className={`search-spinner ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Searching"
    />
  );
}
