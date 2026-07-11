import { useCallback, useRef, useState } from "react";
import { useTimelineStore } from "../stores/index.js";
import { resolveTacticalEdgeDrag } from "../lib/tacticalTimelineRange.js";

/**
 * Stretch zoom via one extreme at a time (delta-based).
 * - Pull outward → expand the visible window
 * - Pull inward from expanded → snap that edge back to the auto base
 * - From base, pull inward → compress (until min span); outward expands again
 */
export function useTacticalRangeDrag(grid) {
  const setTacticalRangeOverride = useTimelineStore((s) => s.setTacticalRangeOverride);
  const clearTacticalRangeOverride = useTimelineStore((s) => s.clearTacticalRangeOverride);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandleKey, setActiveHandleKey] = useState(null);
  const [activeEdge, setActiveEdge] = useState(null);
  const dragEdgeRef = useRef(null);

  const onRangeHandlePointerDown = useCallback((
    edge,
    plotEl,
    event,
    { handleKey = null } = {},
  ) => {
    if (!grid || !plotEl) return;
    if (edge !== "start" && edge !== "end") return;

    event.preventDefault();
    event.stopPropagation();
    dragEdgeRef.current = edge;
    setIsDragging(true);
    setActiveEdge(edge);
    setActiveHandleKey(handleKey);
    plotEl.setPointerCapture(event.pointerId);

    const rect = plotEl.getBoundingClientRect();
    const plotWidth = Math.max(1, rect.width);
    const baseStartMs = (grid.baseStart || grid.start).getTime();
    const baseEndMs = (grid.baseEnd || grid.end).getTime();
    const override = useTimelineStore.getState().tacticalRangeOverride;
    const originStartMs = override?.startMs ?? baseStartMs;
    const originEndMs = override?.endMs ?? baseEndMs;
    // Use base span for px→ms so outward expansion stays responsive (not stuck).
    const spanForScale = Math.max(1, baseEndMs - baseStartMs);
    const msPerPx = spanForScale / plotWidth;
    const originX = event.clientX;

    const apply = (startMs, endMs) => {
      const next = resolveTacticalEdgeDrag(
        edge,
        startMs,
        endMs,
        baseStartMs,
        baseEndMs,
        originStartMs,
        originEndMs,
      );
      if (next == null) {
        clearTacticalRangeOverride();
        return;
      }
      setTacticalRangeOverride(next);
    };

    const onMove = (ev) => {
      const dx = ev.clientX - originX;
      // Start extreme: drag left (dx < 0) → earlier start → expand
      // End extreme: drag right (dx > 0) → later end → expand
      if (edge === "start") {
        apply(originStartMs + dx * msPerPx, originEndMs);
      } else {
        apply(originStartMs, originEndMs + dx * msPerPx);
      }
    };

    const onUp = (ev) => {
      try {
        plotEl.releasePointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
      plotEl.removeEventListener("pointermove", onMove);
      plotEl.removeEventListener("pointerup", onUp);
      plotEl.removeEventListener("pointercancel", onUp);
      dragEdgeRef.current = null;
      setIsDragging(false);
      setActiveEdge(null);
      setActiveHandleKey(null);
    };

    plotEl.addEventListener("pointermove", onMove);
    plotEl.addEventListener("pointerup", onUp);
    plotEl.addEventListener("pointercancel", onUp);
    onMove(event);
  }, [grid, setTacticalRangeOverride, clearTacticalRangeOverride]);

  const onRangeHandleDoubleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTacticalRangeOverride();
  }, [clearTacticalRangeOverride]);

  return {
    isDragging,
    activeEdge,
    activeHandleKey,
    onRangeHandlePointerDown,
    onRangeHandleDoubleClick,
  };
}
