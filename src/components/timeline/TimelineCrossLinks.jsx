import { useLayoutEffect, useState } from "react";

const CROSS_LINK_ATOM_ICON = "/uploads/botones/Atom.svg";
const CROSS_LINK_ATOM_SIZE = 18;

/**
 * Inheritance columns are plumb: one X from the host chip, straight down.
 * (Bezier curves looked wavy when folder chip centers were a few px apart.)
 */
function buildColumnWirePath(x, y1, y2) {
  if (y2 <= y1 + 2) return null;
  return `M ${x} ${y1} L ${x} ${y2}`;
}

/**
 * Body-level vertical connectors between host and guest folder/Launch chips.
 * Thick glass gray uprights of the 4-vector window — always straight columns.
 *
 * @param {{ key: string, kind?: string, primaryAnchor?: string, inheritAnchor?: string, primaryNodeId?: string, inheritNodeId?: string }[]} links
 */
export function TimelineCrossLinks({
  links = [],
  containerRef,
}) {
  const [segments, setSegments] = useState([]);

  useLayoutEffect(() => {
    const container = containerRef?.current;
    if (!container || !links.length) {
      setSegments([]);
      return undefined;
    }

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const next = [];

      for (const link of links) {
        const primarySel = link.primaryAnchor
          || (link.primaryNodeId ? `doc-${link.primaryNodeId}` : null)
          || link.primaryNodeId;
        const inheritSel = link.inheritAnchor
          || (link.inheritNodeId ? `doc-${link.inheritNodeId}` : null)
          || link.inheritNodeId;
        if (!primarySel || !inheritSel) continue;

        const primaryEl = container.querySelector(`[data-tl-anchor="${primarySel}"]`)
          || container.querySelector(`[data-tl-card-anchor="${primarySel}"]`);
        const inheritEl = container.querySelector(`[data-tl-anchor="${inheritSel}"]`)
          || container.querySelector(`[data-tl-card-anchor="${inheritSel}"]`);
        if (!primaryEl || !inheritEl) continue;

        const fromRect = primaryEl.getBoundingClientRect();
        const toRect = inheritEl.getBoundingClientRect();
        const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
        const x2 = toRect.left + toRect.width / 2 - containerRect.left;
        // Plumb column through both chip centers (guest is synced under host).
        const x = (x1 + x2) / 2;
        const y1 = fromRect.bottom - containerRect.top + 2;
        const y2 = toRect.top - containerRect.top - 2;
        const d = buildColumnWirePath(x, y1, y2);
        if (!d) continue;

        next.push({
          key: link.key,
          kind: link.kind || "folder",
          d,
          x,
          atomY: (y1 + y2) / 2,
        });
      }

      setSegments(next);
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    ro?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [links, containerRef]);

  if (!segments.length) return null;

  const width = containerRef?.current?.offsetWidth || 0;
  const height = containerRef?.current?.offsetHeight || 0;
  const atomHalf = CROSS_LINK_ATOM_SIZE / 2;

  return (
    <svg
      className="tl-tactical-cross-links"
      width={width}
      height={height}
      aria-hidden
    >
      {segments.map((seg) => (
        <g key={seg.key} className={`tl-tactical-cross-links__seg is-${seg.kind}`}>
          <path
            d={seg.d}
            className="tl-tactical-cross-links__line-glass"
            fill="none"
          />
          <path
            d={seg.d}
            className="tl-tactical-cross-links__line"
            fill="none"
          />
          <image
            href={CROSS_LINK_ATOM_ICON}
            x={seg.x - atomHalf}
            y={seg.atomY - atomHalf}
            width={CROSS_LINK_ATOM_SIZE}
            height={CROSS_LINK_ATOM_SIZE}
            className="tl-tactical-cross-links__atom"
          />
        </g>
      ))}
    </svg>
  );
}
