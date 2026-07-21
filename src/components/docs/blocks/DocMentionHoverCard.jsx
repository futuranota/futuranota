import { createPortal } from "react-dom";

const INFO_ICON = "/uploads/Info.svg";

function displayUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/**
 * Hover card for a document @tag mention (uses frozen description snapshot).
 */
export function DocMentionHoverCard({
  open,
  anchor = null,
  tag = "",
  description = "",
  url = "",
  onOpenTable = null,
  onMouseEnter = null,
  onMouseLeave = null,
}) {
  if (!open || !anchor || typeof document === "undefined") return null;

  const body = String(description || "").trim() || "No description";
  const token = tag ? (String(tag).startsWith("@") ? String(tag) : `@${tag}`) : "";
  const href = String(url || "").trim();

  return createPortal(
    <div
      className="doc-mention-hover-card"
      role="tooltip"
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        zIndex: 10070,
      }}
      onMouseEnter={onMouseEnter || undefined}
      onMouseLeave={onMouseLeave || undefined}
    >
      <div className="doc-mention-hover-card__header">
        <img
          src={INFO_ICON}
          alt=""
          className="doc-mention-hover-card__icon"
          width={16}
          height={16}
        />
        <span className="doc-mention-hover-card__title">Description</span>
      </div>
      {token ? <p className="doc-mention-hover-card__tag">{token}</p> : null}
      <p className="doc-mention-hover-card__body">{body}</p>
      {href ? (
        <a
          className="doc-mention-hover-card__link"
          href={href}
          target="_blank"
          rel="noreferrer noopener"
        >
          {displayUrl(href)}
        </a>
      ) : null}
      {onOpenTable ? (
        <button
          type="button"
          className="doc-mention-hover-card__table-link"
          onMouseDown={(event) => {
            // mousedown (not click) so the underlying field never steals focus.
            event.preventDefault();
            event.stopPropagation();
            onOpenTable();
          }}
        >
          Open in URL table
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
