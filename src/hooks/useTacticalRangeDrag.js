import { useCallback, useRef, useState } from "react";
import { useTimelineStore } from "../stores/index.js";
import {
  rangeFromAnchorPct,
  resolveTacticalEdgeDrag,
} from "../lib/tacticalTimelineRange.js";
import { startOfCalendarDay } from "../temporal.js";

/**
 * All folder dots are movable:
 * - start / end extremes → stretch that edge (outward expand, inward → base)
 * - middle ("anchor") → drag moves the window so that folder follows the pointer
 * Different-day folders never collapse below the min rail gap.
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
    { handleKey = null, anchorDate = null } = {},
  ) => {
    if (!grid || !plotEl) return;
    if (edge !== "start" && edge !== "end" && edge !== "anchor") return;

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
    const originSpanMs = Math.max(1, originEndMs - originStartMs);
    const spanForScale = Math.max(1, baseEndMs - baseStartMs);
    const msPerPx = spanForScale / plotWidth;
    const originX = event.clientX;
    const markerDates = grid.folderMarkers?.length
      ? grid.folderMarkers
      : (grid.markers || []);
    const anchorMs = anchorDate
      ? startOfCalendarDay(anchorDate).getTime()
      : null;

    const applyEdge = (startMs, endMs) => {
      const next = resolveTacticalEdgeDrag(
        edge,
        startMs,
        endMs,
        baseStartMs,
        baseEndMs,
        originStartMs,
        originEndMs,
        markerDates,
      );
      if (next == null) {
        clearTacticalRangeOverride();
        return;
      }
      setTacticalRangeOverride(next);
    };

    const onMove = (ev) => {
      const clampedX = Math.min(rect.right, Math.max(rect.left, ev.clientX));
      const pct = ((clampedX - rect.left) / plotWidth) * 100;

      if (edge === "anchor" && anchorMs != null) {
        // Middle folder: keep this node under the pointer (movable, not extremes-only).
        const next = rangeFromAnchorPct(anchorMs, pct, originSpanMs, markerDates);
        if (next) setTacticalRangeOverride(next);
        return;
      }

      const dx = clampedX - originX;
      if (edge === "start") {
        applyEdge(originStartMs + dx * msPerPx, originEndMs);
      } else {
        applyEdge(originStartMs, originEndMs + dx * msPerPx);
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
