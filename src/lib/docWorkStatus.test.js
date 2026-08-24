import { describe, expect, it } from "vitest";
import {
  DOC_WORK_STATUS,
  defaultStatusAfterScheduleSave,
  nextStatusOnMeaningfulWrite,
  nextStatusOnWriteDuringScheduleWindow,
  sanitizeDocStatusForFolderSchedule,
  shouldShowDocStatusChip,
} from "./docWorkStatus.js";

describe("nextStatusOnMeaningfulWrite", () => {
  it("never auto-sets in_progress on write alone", () => {
    expect(nextStatusOnMeaningfulWrite(null, true, { folderScheduleReserved: true })).toBe(null);
  });
});

describe("defaultStatusAfterScheduleSave", () => {
  it("sets not_started when schedule complete and status empty", () => {
    expect(defaultStatusAfterScheduleSave({
      status: null,
      hasCompleteSchedule: true,
    })).toBe(DOC_WORK_STATUS.NOT_STARTED);
  });

  it("does not override existing status", () => {
    expect(defaultStatusAfterScheduleSave({
      status: "reserved",
      hasCompleteSchedule: true,
    })).toBe(null);
  });

  it("requires complete schedule", () => {
    expect(defaultStatusAfterScheduleSave({
      status: null,
      hasCompleteSchedule: false,
    })).toBe(null);
    expect(defaultStatusAfterScheduleSave({
      status: null,
      hasCompleteSchedule: true,
      docDateInFolderFrame: false,
    })).toBe(null);
  });
});

describe("nextStatusOnWriteDuringScheduleWindow", () => {
  it("promotes not_started to in_progress when writing inside the window", () => {
    expect(nextStatusOnWriteDuringScheduleWindow({
      status: "not_started",
      content: "Working",
      anchorAt: "2026-08-01T14:00:00.000Z",
      anchorFinishAt: "2026-08-01T16:00:00.000Z",
    }, new Date("2026-08-01T15:00:00.000Z"))).toBe(DOC_WORK_STATUS.IN_PROGRESS);
  });

  it("does not promote outside the window", () => {
    expect(nextStatusOnWriteDuringScheduleWindow({
      status: "not_started",
      content: "Working",
      anchorAt: "2026-08-01T14:00:00.000Z",
      anchorFinishAt: "2026-08-01T16:00:00.000Z",
    }, new Date("2026-08-01T13:00:00.000Z"))).toBe(null);
  });

  it("does not promote reserved or empty content", () => {
    expect(nextStatusOnWriteDuringScheduleWindow({
      status: "reserved",
      content: "Working",
      anchorAt: "2026-08-01T14:00:00.000Z",
      anchorFinishAt: "2026-08-01T16:00:00.000Z",
    }, new Date("2026-08-01T15:00:00.000Z"))).toBe(null);
  });
});

describe("sanitizeDocStatusForFolderSchedule", () => {
  it("is a no-op (day-first: folder schedule no longer gates statuses)", () => {
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "not_started" },
      false,
    )).toBe(null);
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "reserved" },
      false,
    )).toBe(null);
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "flexible" },
      false,
    )).toBe(null);
  });
});

describe("shouldShowDocStatusChip", () => {
  it("always shows reserved", () => {
    expect(shouldShowDocStatusChip("reserved", false)).toBe(true);
  });

  it("always shows flexible", () => {
    expect(shouldShowDocStatusChip("flexible", false)).toBe(true);
  });

  it("shows not_started when the document has a schedule date", () => {
    expect(shouldShowDocStatusChip("not_started", true)).toBe(true);
    expect(shouldShowDocStatusChip("not_started", false)).toBe(false);
  });
});

describe("flexible status", () => {
  it("does not override defaultStatusAfterScheduleSave when already flexible", () => {
    expect(defaultStatusAfterScheduleSave({
      status: "flexible",
      hasCompleteSchedule: true,
      docDateInFolderFrame: true,
    })).toBe(null);
  });

  it("does not promote flexible to in_progress on write in window", () => {
    expect(nextStatusOnWriteDuringScheduleWindow({
      status: "flexible",
      content: "Working",
      anchorAt: "2026-08-01T14:00:00.000Z",
      anchorFinishAt: "2026-08-01T16:00:00.000Z",
    }, new Date("2026-08-01T15:00:00.000Z"))).toBe(null);
  });
});
