import { createPortal } from "react-dom";

const INFO_ICON = "/uploads/Info.svg";

/**
 * Hover card for a document @tag mention (uses frozen name + description snapshot).
 * The underlined chip itself is the link that opens the owning URL table
 * filtered by the tag.
 */
export function DocMentionHoverCard({
  open,
  anchor = null,
  tag = "",
  name = "",
  description = "",
  onMouseEnter = null,
  onMouseLeave = null,
}) {
  if (!open || !anchor || typeof document === "undefined") return null;

  const title = String(name || "").trim() || "Untitled";
  const body = String(description || "").trim() || "No description";
  const token = tag ? (String(tag).startsWith("@") ? String(tag) : `@${tag}`) : "";

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
        <span className="doc-mention-hover-card__name">{title}</span>
      </div>
      {token ? <p className="doc-mention-hover-card__tag">{token}</p> : null}
      <p className="doc-mention-hover-card__body">{body}</p>
    </div>,
    document.body,
  );
}
