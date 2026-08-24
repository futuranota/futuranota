import { describe, expect, it } from "vitest";
import { startOfCalendarDay } from "../temporal.js";
import {
  isTimelineFileCanvasNode,
  mergeTimelineFileQueues,
  pushFileToTimelineQueue,
  resolveCanvasEntityId,
  resolveFileRailDisplayDate,
} from "./timelineFileQueue.js";

describe("timelineFileQueue", () => {
  const entities = {
    studios: { id: "studios", parentDocId: "ideas", title: "Studios plan", dataType: "text" },
  };

  it("treats TEXT chips as files, not folder cards", () => {
    expect(isTimelineFileCanvasNode({
      id: "cn-1",
      noteId: "studios",
      parentDocId: "ideas",
      dataType: "text",
    }, entities)).toBe(true);

    expect(isTimelineFileCanvasNode({
      id: "cn-2",
      nodeId: "studios",
      dataType: "text",
    }, entities)).toBe(true);

    expect(isTimelineFileCanvasNode({
      id: "cn-folder",
      canvasKind: "document",
      dataType: "document",
      docId: "ideas",
    }, entities)).toBe(false);
  });

  it("resolveCanvasEntityId prefers noteId then nodeId", () => {
    expect(resolveCanvasEntityId({ noteId: "a", nodeId: "b" })).toBe("a");
    expect(resolveCanvasEntityId({ nodeId: "b" })).toBe("b");
    expect(resolveCanvasEntityId(null)).toBeNull();
  });

  it("mergeTimelineFileQueues unions in order without dupes", () => {
    expect(mergeTimelineFileQueues(["a", "b"], ["b", "c"], [])).toEqual(["a", "b", "c"]);
  });

  it("keeps insert order without duplicating", () => {
    let q = [];
    q = pushFileToTimelineQueue(q, "studios");
    q = pushFileToTimelineQueue(q, "slot");
    q = pushFileToTimelineQueue(q, "studios");
    expect(q).toEqual(["studios", "slot"]);
  });

  it("uses today when the file has no schedule", () => {
    const today = new Date("2026-08-22T15:00:00.000Z");
    const out = resolveFileRailDisplayDate(
      { id: "studios", parentDocId: "ideas" },
      today,
    );
    expect(out.unscheduled).toBe(true);
    expect(out.date.getTime()).toBe(startOfCalendarDay(today).getTime());
  });

  it("uses anchorAt when the file is scheduled", () => {
    const out = resolveFileRailDisplayDate({
      id: "slot",
      parentDocId: "dev",
      anchorAt: "2026-08-12T13:00:00.000Z",
    });
    expect(out.unscheduled).toBe(false);
    expect(out.date.toISOString()).toBe("2026-08-12T13:00:00.000Z");
  });
});
