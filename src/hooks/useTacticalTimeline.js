import { useMemo } from "react";
import { buildTimelineChains } from "../lib/timelineChains.js";
import { useTimelineStore } from "../stores/index.js";

/**
 * Bloque A selector: canvas graph → tactical chains + classified wires.
 * Consumed by Bloque B (TacticalTimeline UI).
 *
 * @param {Object} params
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.connections
 * @param {Record<string, object>} params.docsById
 * @param {Record<string, object>} params.nodeEntitiesById
 * @param {Record<string, object>} params.objectsById
 * @param {Date} [params.today]
 * @param {string|null} [params.filterObjectId]
 */
export function useTacticalTimeline({
  canvasNodes = [],
  connections = [],
  docsById = {},
  nodeEntitiesById = {},
  objectsById = {},
  today = new Date(),
  filterObjectId = null,
}) {
  const inheritObjMode = useTimelineStore((s) => s.inheritObjMode);
  const canvasMode = useTimelineStore((s) => s.getEffectiveCanvasMode());
  const timelineFocus = useTimelineStore((s) => s.timelineFocus);
  const expandedDocIds = useTimelineStore((s) => s.expandedDocIds);
  const timelineDocQueue = useTimelineStore((s) => s.timelineDocQueue);
  const objectTimelineTitles = useTimelineStore((s) => s.objectTimelineTitles);

  const tactical = useMemo(
    () => buildTimelineChains({
      canvasNodes,
      connections,
      docsById,
      nodeEntitiesById,
      objectsById,
      objectTimelineTitles,
      today,
      filterObjectId,
      inheritObjMode,
    }),
    [
      canvasNodes,
      connections,
      docsById,
      nodeEntitiesById,
      objectsById,
      objectTimelineTitles,
      today,
      filterObjectId,
      inheritObjMode,
    ],
  );

  return {
    canvasMode,
    inheritObjMode,
    timelineFocus,
    expandedDocIds,
    timelineDocQueue,
    ...tactical,
  };
}
