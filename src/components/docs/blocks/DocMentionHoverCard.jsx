import { createPortal } from "react-dom";

const INFO_ICON = "/uploads/Info.svg";

/**
 * Hover card for a document mention (uses frozen name + description snapshot).
 * The chip itself is the link that opens the owning URL table filtered by the tag.
 * Tag handle is not shown here — it already appears in the inline chip.
 */
export function DocMentionHoverCard({
  open,
  anchor = null,
  name = "",
  description = "",
  onMouseEnter = null,
  onMouseLeave = null,
}) {
  if (!open || !anchor || typeof document === "undefined") return null;

  const title = String(name || "").trim() || "Untitled";
  const body = String(description || "").trim() || "No description";

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
      <p className="doc-mention-hover-card__body">{body}</p>
    </div>,
    document.body,
  );
}
