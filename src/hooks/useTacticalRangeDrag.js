import { useCallback, useRef, useState } from "react";
import { useTimelineStore } from "../stores/index.js";
import {
  rangeFromAnchorPct,
  resolveTacticalEdgeDrag,
} from "../lib/tacticalTimelineRange.js";

/**
 * Node / today dots stretch individually (pair vs next only):
 * - Today (thermometer) moves → next schedule stays; then node 2 → node 3, etc.
 * - Scoped per row — never pans the shared folder timeline window.
 * Double-click resets.
 */
export function useTacticalRangeDrag(grid) {
  const setTacticalRangeOverride = useTimelineStore((s) => s.setTacticalRangeOverride);
  const clearTacticalViewOverrides = useTimelineStore((s) => s.clearTacticalViewOverrides);
  const setTacticalPairStretch = useTimelineStore((s) => s.setTacticalPairStretch);
  const clearTacticalPairStretchesForRow = useTimelineStore((s) => s.clearTacticalPairStretchesForRow);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandleKey, setActiveHandleKey] = useState(null);
  const [activeEdge, setActiveEdge] = useState(null);
  const dragEdgeRef = useRef(null);

  const onRangeHandlePointerDown = useCallback((
    edge,
    plotEl,
    event,
    {
      handleKey = null,
      anchorDate = null,
      markerDates: rowMarkerDates = null,
      pairNextDate = null,
      pairPrevDate = null,
      rowId = null,
      allowRangePan = false,
      focusKey = null,
    } = {},
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
    const spanForScale = Math.max(1, originEndMs - originStartMs);
    const msPerPx = spanForScale / plotWidth;
    const originX = event.clientX;
    const markerDates = (Array.isArray(rowMarkerDates) && rowMarkerDates.length > 0)
      ? rowMarkerDates
      : (grid.folderMarkers?.length
        ? grid.folderMarkers
        : (grid.markers || []));
    const isTodayFocus = focusKey === "today";
    const anchorMs = (!isTodayFocus && anchorDate instanceof Date && !Number.isNaN(anchorDate.getTime()))
      ? anchorDate.getTime()
      : null;
    const pairNextMs = pairNextDate instanceof Date && !Number.isNaN(pairNextDate.getTime())
      ? pairNextDate.getTime()
      : null;
    const pairPrevMs = pairPrevDate instanceof Date && !Number.isNaN(pairPrevDate.getTime())
      ? pairPrevDate.getTime()
      : null;
    const stretchMode = Boolean(event.shiftKey) && (edge === "start" || edge === "end") && allowRangePan;

    const applyEdgeStretch = (startMs, endMs) => {
      if (!allowRangePan) return;
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

    const applyRangePan = (pct) => {
      if (!allowRangePan) return;
      const focusMs = anchorMs != null
        ? anchorMs
        : (edge === "start"
          ? Math.min(...markerDates.map((d) => d.getTime()).filter(Number.isFinite))
          : Math.max(...markerDates.map((d) => d.getTime()).filter(Number.isFinite)));
      if (!Number.isFinite(focusMs)) return;
      const next = rangeFromAnchorPct(focusMs, pct, spanForScale, markerDates);
      if (!next) return;
      if (next.startMs === baseStartMs && next.endMs === baseEndMs) {
        useTimelineStore.getState().clearTacticalRangeOverride();
        return;
      }
      setTacticalRangeOverride(next);
    };

    const onMove = (ev) => {
      const clampedX = Math.min(rect.right, Math.max(rect.left, ev.clientX));
      const pct = ((clampedX - rect.left) / plotWidth) * 100;

      if (edge === "anchor" && rowId && (isTodayFocus || anchorMs != null)) {
        if (!allowRangePan && useTimelineStore.getState().tacticalRangeOverride) {
          useTimelineStore.getState().clearTacticalRangeOverride();
        }
        setTacticalPairStretch({
          rowId,
          focusKey: isTodayFocus ? "today" : null,
          focusMs: isTodayFocus ? null : anchorMs,
          pairNextMs,
          pairPrevMs,
          targetPct: pct,
        });
        return;
      }

      if (!allowRangePan) return;

      if ((edge === "start" || edge === "end") && !stretchMode) {
        applyRangePan(pct);
        return;
      }

      const dx = clampedX - originX;
      if (edge === "start") {
        applyEdgeStretch(originStartMs + dx * msPerPx, originEndMs);
      } else if (edge === "end") {
        applyEdgeStretch(originStartMs, originEndMs + dx * msPerPx);
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
    setTacticalPairStretch,
  ]);

  const onRangeHandleDoubleClick = useCallback((event, { rowId = null, localOnly = false } = {}) => {
    event.preventDefault();
    event.stopPropagation();
    if (localOnly && rowId) {
      clearTacticalPairStretchesForRow(rowId);
      return;
    }
    clearTacticalViewOverrides();
  }, [clearTacticalViewOverrides, clearTacticalPairStretchesForRow]);

  return {
    isDragging,
    activeEdge,
    activeHandleKey,
    onRangeHandlePointerDown,
    onRangeHandleDoubleClick,
  };
}
