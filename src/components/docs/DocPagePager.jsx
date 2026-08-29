/**
 * Bottom-of-sheet page chrome: [ ←  n  → ]
 * Presentation only — parent owns pageIndex / pageCount.
 */
export function DocPagePager({
  pageIndex = 0,
  pageCount = 1,
  onPrev,
  onNext,
  className = "",
}) {
  const safeCount = Math.max(1, pageCount | 0);
  const safeIndex = Math.max(0, Math.min(pageIndex | 0, safeCount - 1));
  const displayN = safeIndex + 1;
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < safeCount - 1;

  return (
    <nav
      className={"doc-page-pager" + (className ? ` ${className}` : "")}
      aria-label="Page"
    >
      <button
        type="button"
        className="doc-page-pager__arrow"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous page"
      >
        ←
      </button>
      <span className="doc-page-pager__n" aria-live="polite">
        {displayN}
      </span>
      <button
        type="button"
        className="doc-page-pager__arrow"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  );
}
