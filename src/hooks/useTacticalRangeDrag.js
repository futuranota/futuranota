import { useCallback, useRef, useState } from "react";
import { useTimelineStore } from "../stores/index.js";
import { resolveTacticalEdgeDrag } from "../lib/tacticalTimelineRange.js";
import { startOfCalendarDay } from "../temporal.js";

/**
 * Folder dots:
 * - start / end extremes → stretch that edge (outward expand, inward → base)
 * - middle ("anchor") → local loupe only (node + governing extreme breathe; rest stay put)
 * Different-day folders never collapse below the min rail gap.
 */
export function useTacticalRangeDrag(grid) {
  const setTacticalRangeOverride = useTimelineStore((s) => s.setTacticalRangeOverride);
  const clearTacticalViewOverrides = useTimelineStore((s) => s.clearTacticalViewOverrides);
  const clearTacticalLoupe = useTimelineStore((s) => s.clearTacticalLoupe);
  const setTacticalLoupe = useTimelineStore((s) => s.setTacticalLoupe);
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
    const spanForScale = Math.max(1, baseEndMs - baseStartMs);
    const msPerPx = spanForScale / plotWidth;
    const originX = event.clientX;
    const markerDates = grid.folderMarkers?.length
      ? grid.folderMarkers
      : (grid.markers || []);
    const anchorMs = anchorDate
      ? startOfCalendarDay(anchorDate).getTime()
      : null;

    // Extreme stretch clears any leftover loupe so the window stays the source of truth.
    if (edge === "start" || edge === "end") {
      clearTacticalLoupe();
    }

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
        useTimelineStore.getState().clearTacticalRangeOverride();
        return;
      }
      setTacticalRangeOverride(next);
    };

    const onMove = (ev) => {
      const clampedX = Math.min(rect.right, Math.max(rect.left, ev.clientX));
      const pct = ((clampedX - rect.left) / plotWidth) * 100;

      if (edge === "anchor" && anchorMs != null) {
        // Middle folder: local lupa — this node (+ coupled extreme) only, no timeline pan.
        setTacticalLoupe({ focusMs: anchorMs, targetPct: pct });
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
  }, [
    grid,
    setTacticalRangeOverride,
    setTacticalLoupe,
    clearTacticalLoupe,
  ]);

  const onRangeHandleDoubleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTacticalViewOverrides();
  }, [clearTacticalViewOverrides]);

  return {
    isDragging,
    activeEdge,
    activeHandleKey,
    onRangeHandlePointerDown,
    onRangeHandleDoubleClick,
  };
}
