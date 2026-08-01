import { describe, expect, it, vi } from "vitest";
import {
  folderScheduleDateInputBounds,
  folderScheduleRangeChanged,
  isDateInputWithinFolderSchedule,
  isFolderScheduleReserved,
  isTodayWithinFolderSchedule,
  resetNonReservedChildrenForFolderScheduleChange,
  validateFolderSchedule,
} from "./folderScheduleReservation.js";

describe("folder schedule reservation gate", () => {
  it("is reserved only when explicit scheduleStartAt is set", () => {
    expect(isFolderScheduleReserved(null)).toBe(false);
    expect(isFolderScheduleReserved({})).toBe(false);
    expect(isFolderScheduleReserved({
      scheduleStartAt: "2026-07-15T12:00:00.000Z",
      scheduleFinishAt: "2026-07-20T12:00:00.000Z",
    })).toBe(true);
  });

  it("exposes date input bounds only when reserved", () => {
    expect(folderScheduleDateInputBounds({})).toBe(null);
    const bounds = folderScheduleDateInputBounds({
      scheduleStartAt: "2026-07-15T12:00:00.000Z",
      scheduleFinishAt: "2026-07-20T12:00:00.000Z",
    });
    expect(bounds).toEqual({ minDate: "2026-07-15", maxDate: "2026-07-20" });
    expect(isDateInputWithinFolderSchedule("2026-07-18", {
      scheduleStartAt: "2026-07-15T12:00:00.000Z",
      scheduleFinishAt: "2026-07-20T12:00:00.000Z",
    })).toBe(true);
    expect(isDateInputWithinFolderSchedule("2026-07-21", {
      scheduleStartAt: "2026-07-15T12:00:00.000Z",
      scheduleFinishAt: "2026-07-20T12:00:00.000Z",
    })).toBe(false);
  });

  it("never invents Schedule from launchAt alone", () => {
    expect(isFolderScheduleReserved({
      launchAt: "2026-07-26T12:00:00.000Z",
    })).toBe(false);
  });

  it("never treats campaign Launch as a Schedule reservation", () => {
    const campaign = {
      campaignActive: true,
      launchAt: "2026-07-26T12:00:00.000Z",
      // Legacy aliases must also be ignored.
      scheduleStartAt: "2026-07-26T12:00:00.000Z",
      scheduleFinishAt: "2026-07-26T12:00:00.000Z",
    };
    expect(isFolderScheduleReserved(campaign)).toBe(false);
  });
});

describe("validateFolderSchedule", () => {
  it("allows overlapping folder date ranges", () => {
    const docs = [
      {
        id: "a",
        parentObjectId: "obj-1",
        scheduleStartAt: "2026-07-10T12:00:00.000Z",
        scheduleFinishAt: "2026-07-12T12:00:00.000Z",
      },
    ];
    expect(validateFolderSchedule("2026-07-11", "2026-07-13", docs, "obj-1")).toEqual({ ok: true });
  });
});

describe("isTodayWithinFolderSchedule", () => {
  it("is true when today is inside Start→Finish inclusive", () => {
    const folder = {
      scheduleStartAt: "2026-08-01T12:00:00.000Z",
      scheduleFinishAt: "2026-08-03T12:00:00.000Z",
    };
    expect(isTodayWithinFolderSchedule(folder, new Date("2026-08-01T15:00:00"))).toBe(true);
    expect(isTodayWithinFolderSchedule(folder, new Date("2026-08-03T08:00:00"))).toBe(true);
    expect(isTodayWithinFolderSchedule(folder, new Date("2026-07-31T15:00:00"))).toBe(false);
    expect(isTodayWithinFolderSchedule(folder, new Date("2026-08-04T08:00:00"))).toBe(false);
  });

  it("is false when folder has no reservation", () => {
    expect(isTodayWithinFolderSchedule({}, new Date("2026-08-01"))).toBe(false);
  });
});

describe("folderScheduleRangeChanged", () => {
  it("detects clear and range replacement", () => {
    expect(folderScheduleRangeChanged(
      { start: "2026-07-10", finish: "2026-07-12" },
      { start: "", finish: "" },
    )).toBe(true);
    expect(folderScheduleRangeChanged(
      { start: "2026-07-10", finish: "2026-07-12" },
      { start: "2026-08-01", finish: "2026-08-07" },
    )).toBe(true);
    expect(folderScheduleRangeChanged(
      { start: "2026-07-10", finish: "2026-07-12" },
      { start: "2026-07-10", finish: "2026-07-12" },
    )).toBe(false);
  });
});

describe("resetNonReservedChildrenForFolderScheduleChange", () => {
  it("resets non-reserved children and keeps reserved", () => {
    const nodes = {
      a: {
        id: "a",
        parentDocId: "folder-1",
        status: "in_progress",
        completed: false,
        anchorAt: "2026-07-10T15:00:00.000Z",
        anchorFinishAt: "2026-07-10T16:00:00.000Z",
      },
      b: {
        id: "b",
        parentDocId: "folder-1",
        status: "reserved",
        completed: false,
        anchorAt: "2026-12-01T15:00:00.000Z",
        anchorFinishAt: "2026-12-01T16:00:00.000Z",
      },
      c: {
        id: "c",
        parentDocId: "folder-1",
        status: "completed",
        completed: true,
        anchorAt: "2026-07-11T15:00:00.000Z",
      },
    };
    const docs = {
      "folder-1": {
        id: "folder-1",
        blocks: [
          {
            type: "h1",
            nodeId: "a",
            anchorDate: "2026-07-10",
            anchorTime: "15:00",
            anchorFinishTime: "16:00",
            anchorFromNode: true,
          },
          {
            type: "h1",
            nodeId: "b",
            anchorDate: "2026-12-01",
            anchorTime: "15:00",
            anchorFinishTime: "16:00",
            anchorFromNode: true,
          },
        ],
      },
    };
    const updateNode = vi.fn((id, patch) => {
      nodes[id] = { ...nodes[id], ...patch };
    });
    const updateDoc = vi.fn((id, patch) => {
      docs[id] = { ...docs[id], ...patch };
    });

    const cleared = resetNonReservedChildrenForFolderScheduleChange("folder-1", {
      getDoc: (id) => docs[id],
      updateDoc,
      getNodesByDoc: (id) => Object.values(nodes).filter((n) => n.parentDocId === id),
      updateNode,
    });

    expect(cleared).toBe(2);
    expect(updateNode).toHaveBeenCalledWith("a", {
      anchorAt: null,
      anchorFinishAt: null,
      status: null,
      completed: false,
    });
    expect(updateNode).toHaveBeenCalledWith("c", {
      anchorAt: null,
      anchorFinishAt: null,
      status: null,
      completed: false,
    });
    expect(nodes.b.status).toBe("reserved");
    expect(nodes.b.anchorAt).toBe("2026-12-01T15:00:00.000Z");
    expect(updateDoc).toHaveBeenCalled();
    const nextBlocks = updateDoc.mock.calls[0][1].blocks;
    expect(nextBlocks[0].anchorDate).toBe("");
    expect(nextBlocks[1].anchorDate).toBe("2026-12-01");
  });
});
