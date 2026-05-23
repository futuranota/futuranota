import { useEffect, useMemo } from "react";
import { useTimelineStore } from "../../stores/timelineStore.js";
import { useCanvasStore } from "../../stores/canvasStore.js";
import { useNodesStore } from "../../stores/nodesStore.js";
import { extractDatesFromCanvas } from "../../lib/canvasHelpers.js";
import { TimelineEntry } from "./TimelineEntry.jsx";
import { TimelineEventDetector } from "./TimelineEventDetector.jsx";

const TIERS = [
  { id: "all", label: "Todos" },
  { id: "objects", label: "[OBJECTS]" },
  { id: "docs", label: "[DOCS]" },
  { id: "nodes", label: "[NODES]" },
];

export function FuturaTimeline() {
  const currentTier = useTimelineStore((s) => s.currentTier);
  const setCurrentTier = useTimelineStore((s) => s.setCurrentTier);
  const getAllEntries = useTimelineStore((s) => s.getAllEntries);
  const syncEntriesFromNodes = useTimelineStore((s) => s.syncEntriesFromNodes);
  const nodes = useNodesStore((s) => s.nodes);
  const canvasNodes = useCanvasStore((s) => s.canvasNodes);
  const nodesStore = useNodesStore();

  useEffect(() => {
    syncEntriesFromNodes(nodes);
  }, [nodes, syncEntriesFromNodes]);

  const datesInCanvas = useMemo(
    () => extractDatesFromCanvas(canvasNodes, nodesStore),
    [canvasNodes, nodesStore],
  );

  const entries = getAllEntries();
  const tierMap = { objects: "object", docs: "doc", nodes: "node" };
  const filtered = entries.filter((entry) => {
    if (currentTier === "all") return true;
    return entry.itemType === tierMap[currentTier];
  });

  const sortedEntries = [...filtered].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="fn-timeline">
      <div className="fn-timeline-header">
        <b>Futura Timeline</b>
        <span className="fn-timeline-meta">{sortedEntries.length} eventos</span>
      </div>

      <div className="fn-timeline-tiers">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            className={"btn xs " + (currentTier === tier.id ? "solid" : "ghost")}
            onClick={() => setCurrentTier(tier.id)}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {datesInCanvas.length > 0 && (
        <TimelineEventDetector dates={datesInCanvas} />
      )}

      <div className="fn-timeline-track">
        <div className="fn-timeline-today">
          <span className="fn-timeline-today-dot">●</span>
          <span>Hoy</span>
        </div>
        {sortedEntries.length === 0 && (
          <p className="notes-folder-empty">Añade nodos tipo fecha o entradas en timelines.</p>
        )}
        {sortedEntries.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
