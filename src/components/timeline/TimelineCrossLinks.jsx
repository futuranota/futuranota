import { useLayoutEffect, useState } from "react";

const CROSS_LINK_ATOM_ICON = "/uploads/botones/Atom.svg";
const CROSS_LINK_ATOM_SIZE = 23;

/**
 * Dotted vertical connectors between Blueprint and Obj-to-obj folder chips.
 */
export function TimelineCrossLinks({
  links = [],
  containerRef,
  blueprintFolderRef,
  inheritFolderRef,
}) {
  const [segments, setSegments] = useState([]);

  useLayoutEffect(() => {
    const container = containerRef?.current;
    const blueprint = blueprintFolderRef?.current;
    const inherit = inheritFolderRef?.current;

    if (!container || !blueprint || !inherit || !links.length) {
      setSegments([]);
      return;
    }

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const next = [];

      for (const link of links) {
        const primaryEl = blueprint.querySelector(`[data-tl-anchor="${link.primaryNodeId}"]`);
        const inheritEl = inherit.querySelector(`[data-tl-anchor="${link.inheritNodeId}"]`);
        if (!primaryEl || !inheritEl) continue;

        const fromRect = primaryEl.getBoundingClientRect();
        const toRect = inheritEl.getBoundingClientRect();
        const x = fromRect.left + fromRect.width / 2 - containerRect.left;
        const y1 = fromRect.bottom - containerRect.top + 2;
        const y2 = toRect.top - containerRect.top - 2;

        if (y2 <= y1) continue;

        next.push({
          key: link.key,
          x,
          y1,
          y2,
          atomY: (y1 + y2) / 2,
        });
      }

      setSegments(next);
    };

    measure();

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    ro?.observe(container);
    window.addEventListener("resize", measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [links, containerRef, blueprintFolderRef, inheritFolderRef]);

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
        <g key={seg.key}>
          <line
            x1={seg.x}
            y1={seg.y1}
            x2={seg.x}
            y2={seg.y2}
            className="tl-tactical-cross-links__line"
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
