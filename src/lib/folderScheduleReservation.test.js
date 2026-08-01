import { describe, expect, it } from "vitest";
import {
  folderScheduleDateInputBounds,
  isDateInputWithinFolderSchedule,
  isFolderScheduleReserved,
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
