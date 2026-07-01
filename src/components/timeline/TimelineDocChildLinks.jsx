import { useLayoutEffect, useState } from "react";

/**
 * Curved vertical wire between timeline anchor dots (matches canvas vertical conn style).
 */
function buildVerticalWirePath(x1, y1, x2, y2) {
  const dy = y2 - y1;
  if (dy <= 2) return null;
  const k = Math.max(28, Math.abs(dy) * 0.38);
  return `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
}

/**
 * Curved wires from parent doc rail dots to macronodo rail dots.
 */
export function TimelineDocChildLinks({
  links = [],
  containerRef,
}) {
  const [paths, setPaths] = useState([]);

  useLayoutEffect(() => {
    const container = containerRef?.current;
    if (!container || !links.length) {
      setPaths([]);
      return;
    }

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const next = [];

      for (const link of links) {
        const parentEl = container.querySelector(`[data-tl-anchor="${link.parentAnchorId}"]`);
        const childEl = container.querySelector(`[data-tl-anchor="${link.childAnchorId}"]`);
        if (!parentEl || !childEl) continue;

        const parentRect = parentEl.getBoundingClientRect();
        const childRect = childEl.getBoundingClientRect();
        const x1 = parentRect.left + parentRect.width / 2 - containerRect.left;
        const y1 = parentRect.bottom - containerRect.top;
        const x2 = childRect.left + childRect.width / 2 - containerRect.left;
        const y2 = childRect.top - containerRect.top;
        const d = buildVerticalWirePath(x1, y1, x2, y2);
        if (!d) continue;

        next.push({ key: link.key, d });
      }

      setPaths(next);
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

  if (!paths.length) return null;

  const width = containerRef?.current?.offsetWidth || 0;
  const height = containerRef?.current?.offsetHeight || 0;

  return (
    <svg
      className="tl-tactical-doc-child-links"
      width={width}
      height={height}
      aria-hidden
    >
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          className="tl-tactical-doc-child-links__path"
        />
      ))}
    </svg>
  );
}
