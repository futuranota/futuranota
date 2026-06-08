import { useCallback, useRef, useState } from "react";
import { useTimelineStore } from "../stores/index.js";
import {
  clampTacticalRangeMs,
  gridEndMsFromAnchorPct,
  gridStartMsFromAnchorPct,
  pctFromClientX,
} from "../lib/tacticalTimelineRange.js";
import { startOfCalendarDay } from "../temporal.js";

function resolveEffectiveRange(grid, override) {
  return {
    startMs: override?.startMs ?? grid.start.getTime(),
    endMs: override?.endMs ?? grid.end.getTime(),
  };
}

export function useTacticalRangeDrag(grid) {
  const setTacticalRangeOverride = useTimelineStore((s) => s.setTacticalRangeOverride);
  const clearTacticalRangeOverride = useTimelineStore((s) => s.clearTacticalRangeOverride);
  const [isDragging, setIsDragging] = useState(false);
  const dragEdgeRef = useRef(null);

  const onRangeHandlePointerDown = useCallback((
    edge,
    plotEl,
    event,
    { anchorDate, anchorPct = 0 } = {},
  ) => {
    if (!grid || !plotEl || !anchorDate) return;
    event.preventDefault();
    event.stopPropagation();
    dragEdgeRef.current = edge;
    setIsDragging(true);
    plotEl.setPointerCapture(event.pointerId);

    const anchorMs = startOfCalendarDay(anchorDate).getTime();
    const initialOverride = useTimelineStore.getState().tacticalRangeOverride;
    const initialRange = resolveEffectiveRange(grid, initialOverride);

    const applyRange = (startMs, endMs) => {
      const clamped = clampTacticalRangeMs(startMs, endMs);
      if (!clamped) return;
      setTacticalRangeOverride(clamped);
    };

    const onMove = (ev) => {
      const pct = pctFromClientX(ev.clientX, plotEl);
      const override = useTimelineStore.getState().tacticalRangeOverride;
      const { startMs, endMs } = resolveEffectiveRange(grid, override ?? initialOverride);

      if (edge === "both") {
        if (pct <= anchorPct) {
          applyRange(gridStartMsFromAnchorPct(anchorMs, pct, endMs), endMs);
        } else {
          applyRange(startMs, gridEndMsFromAnchorPct(anchorMs, pct, startMs));
        }
        return;
      }

      if (edge === "start") {
        applyRange(gridStartMsFromAnchorPct(anchorMs, pct, endMs), endMs);
      } else {
        applyRange(startMs, gridEndMsFromAnchorPct(anchorMs, pct, startMs));
      }
    };

    const onUp = (ev) => {
      plotEl.releasePointerCapture(ev.pointerId);
      plotEl.removeEventListener("pointermove", onMove);
      plotEl.removeEventListener("pointerup", onUp);
      plotEl.removeEventListener("pointercancel", onUp);
      dragEdgeRef.current = null;
      setIsDragging(false);
    };

    plotEl.addEventListener("pointermove", onMove);
    plotEl.addEventListener("pointerup", onUp);
    plotEl.addEventListener("pointercancel", onUp);

    if (!initialOverride) {
      setTacticalRangeOverride(initialRange);
    }
    onMove(event);
  }, [grid, setTacticalRangeOverride]);

  const onRangeHandleDoubleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTacticalRangeOverride();
  }, [clearTacticalRangeOverride]);

  return {
    isDragging,
    onRangeHandlePointerDown,
    onRangeHandleDoubleClick,
  };
}
