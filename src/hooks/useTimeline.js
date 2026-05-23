import { useTimelineStore } from "../stores/index.js";

export function useTimeline() {
  const timelines = useTimelineStore((state) => state.timelines);
  const currentTier = useTimelineStore((state) => state.currentTier);
  const zoomedTimelineId = useTimelineStore((state) => state.zoomedTimelineId);

  const addTimeline = useTimelineStore((state) => state.addTimeline);
  const addTimelineEntry = useTimelineStore((state) => state.addTimelineEntry);
  const removeTimelineEntry = useTimelineStore((state) => state.removeTimelineEntry);
  const setCurrentTier = useTimelineStore((state) => state.setCurrentTier);
  const setZoomedTimeline = useTimelineStore((state) => state.setZoomedTimeline);
  const setZoomedPlanId = useTimelineStore((state) => state.setZoomedPlanId);
  const clearZoom = useTimelineStore((state) => state.clearZoom);

  const currentTierTimelines = useTimelineStore((state) =>
    state.getTimelinesByTier(state.currentTier),
  );

  return {
    timelines,
    currentTier,
    currentTierTimelines,
    zoomedTimelineId,
    addTimeline,
    addTimelineEntry,
    removeTimelineEntry,
    setCurrentTier,
    setZoomedTimeline,
    setZoomedPlanId,
    clearZoom,
  };
}
