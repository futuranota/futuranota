import { NODE_SEARCH_ICON } from "../../lib/docMediumAssets.js";
import { SearchSpinner } from "./SearchSpinner.jsx";

/**
 * Shared search trigger with loading state.
 * @param {"intel"|"modal"} variant
 */
export function IntelSearchButton({
  loading = false,
  disabled = false,
  onClick,
  variant = "intel",
  className = "",
  children,
  title = "Search",
  type = "button",
}) {
  const isModal = variant === "modal";

  return (
    <button
      type={type}
      className={
        (isModal
          ? "node-query-modal__action node-query-modal__action--search"
          : "intel-query-btn")
        + (loading ? " is-loading" : "")
        + (className ? ` ${className}` : "")
      }
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label={loading ? "Searching" : title}
      title={loading ? "Searching…" : title}
    >
      {isModal && (children ?? "Search")}
      {loading ? (
        <SearchSpinner size={isModal ? 18 : 17} />
      ) : (
        <img src={NODE_SEARCH_ICON} alt="" aria-hidden />
      )}
    </button>
  );
}
