import { useMemo } from "react";
import { computeEdgeTemporalLabel } from "../../temporal.js";
import { CONNECTION_KIND_INTRA_DOC } from "../../lib/timelineGraph.js";

export function TimelineConnectionSpan({
  segment,
  today,
  trackNodes = [],
  trackConnections = [],
  trackItemsById,
  meta = {},
}) {
  const label = useMemo(() => {
    if (!segment) return null;

    const fromNode = segment.fromNodeId
      ? trackItemsById?.get(segment.fromNodeId) || trackNodes.find((n) => n.id === segment.fromNodeId)
      : null;
    const toNode = segment.toNodeId
      ? trackItemsById?.get(segment.toNodeId) || trackNodes.find((n) => n.id === segment.toNodeId)
      : null;

    if (fromNode && toNode) {
      const rich = computeEdgeTemporalLabel(
        fromNode,
        toNode,
        today,
        trackNodes,
        trackConnections,
        [],
        meta,
      );
      if (rich) return rich;
    }

    return segment.label || null;
  }, [segment, today, trackNodes, trackConnections, trackItemsById, meta]);

  if (!segment) return null;

  const midPct = segment.leftPct + segment.widthPct / 2;
  const isIntraDocConnector = segment.kind === CONNECTION_KIND_INTRA_DOC;
  const dimensionClass = [
    segment.isDocDimension ? "is-doc-dimension" : "is-node-dimension",
    isIntraDocConnector ? "is-intra-doc-connector" : "",
  ].filter(Boolean).join(" ");

  const spanStyle = { left: `${segment.leftPct}%`, width: `${segment.widthPct}%` };

  return (
    <>
      <div
        className={`tl-tactical-range-window ${dimensionClass}`}
        style={spanStyle}
        aria-hidden
      />
      <div
        className={`tl-tactical-segment ${dimensionClass}`}
        style={spanStyle}
      >
        <span className="tl-tactical-segment__edge" aria-hidden />
        {label ? (
          <span
            className="tl-roadmap-span-label"
            style={{ left: `${((midPct - segment.leftPct) / segment.widthPct) * 100}%` }}
          >
            {label}
          </span>
        ) : null}
      </div>
    </>
  );
}
