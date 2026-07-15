import { describe, expect, it, vi } from "vitest";
import {
  clearChildScheduleAnchorsForFolder,
  folderScheduleDateInputBounds,
  isFolderScheduleReserved,
} from "./folderScheduleReservation.js";

describe("folder schedule reservation gate", () => {
  it("is reserved only when start/launch resolves", () => {
    expect(isFolderScheduleReserved(null)).toBe(false);
    expect(isFolderScheduleReserved({})).toBe(false);
    expect(isFolderScheduleReserved({
      scheduleStartAt: "2026-07-15T12:00:00.000Z",
      scheduleFinishAt: "2026-07-20T12:00:00.000Z",
    })).toBe(true);
    expect(folderScheduleDateInputBounds({
      scheduleStartAt: "2026-07-15T12:00:00.000Z",
      scheduleFinishAt: "2026-07-20T12:00:00.000Z",
    })).toEqual({
      minDate: "2026-07-15",
      maxDate: "2026-07-20",
    });
  });
});

describe("clearChildScheduleAnchorsForFolder", () => {
  it("clears node anchorAt and mirrored block schedule fields", () => {
    const updateNode = vi.fn();
    const updateDoc = vi.fn();
    const getNodesByDoc = vi.fn(() => [
      { id: "n1", anchorAt: "2026-07-16T10:00:00.000Z" },
      { id: "n2", anchorAt: null },
      { id: "n3", anchorAt: "" },
    ]);
    const getDoc = vi.fn(() => ({
      id: "folder-1",
      blocks: [
        { id: "b1", anchorDate: "2026-07-16", anchorTime: "10:00", anchorFromNode: true },
        { id: "b2", anchorDate: "", anchorTime: "", anchorFromNode: false },
      ],
    }));

    const cleared = clearChildScheduleAnchorsForFolder("folder-1", {
      getDoc,
      updateDoc,
      getNodesByDoc,
      updateNode,
    });

    expect(cleared).toBe(1);
    expect(updateNode).toHaveBeenCalledWith("n1", { anchorAt: null });
    expect(updateNode).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith("folder-1", {
      blocks: [
        { id: "b1", anchorDate: "", anchorTime: "", anchorFromNode: false },
        { id: "b2", anchorDate: "", anchorTime: "", anchorFromNode: false },
      ],
    });
  });
});
