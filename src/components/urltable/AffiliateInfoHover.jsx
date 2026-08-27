import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const INFO_ICON = "/uploads/Info.svg";

/**
 * Info icon with hover tooltip (portal).
 */
export function AffiliateInfoHover({ label, text }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return undefined;
    }
    const update = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: rect.bottom + 6,
        left: Math.min(
          Math.max(8, rect.left),
          window.innerWidth - 280,
        ),
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span className="affiliate-info-hover">
      <button
        ref={btnRef}
        type="button"
        className="affiliate-info-hover__btn"
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <img src={INFO_ICON} alt="" aria-hidden className="affiliate-info-hover__icon" />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
          <span
            className="doc-meta-chip-info__pop doc-meta-chip-info__pop--portal affiliate-info-hover__pop"
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
          >
            {text}
          </span>,
          document.body,
        )
        : null}
    </span>
  );
}
