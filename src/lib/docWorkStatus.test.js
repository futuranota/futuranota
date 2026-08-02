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
  it("sets not_started when schedule complete in folder frame and status empty", () => {
    expect(defaultStatusAfterScheduleSave({
      status: null,
      hasCompleteSchedule: true,
      docDateInFolderFrame: true,
    })).toBe(DOC_WORK_STATUS.NOT_STARTED);
  });

  it("does not override existing status", () => {
    expect(defaultStatusAfterScheduleSave({
      status: "reserved",
      hasCompleteSchedule: true,
      docDateInFolderFrame: true,
    })).toBe(null);
  });

  it("requires complete schedule inside folder frame", () => {
    expect(defaultStatusAfterScheduleSave({
      status: null,
      hasCompleteSchedule: false,
      docDateInFolderFrame: true,
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
  it("clears not_started when folder has no reservation", () => {
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "not_started" },
      false,
    )).toEqual({ status: null, completed: false });
  });

  it("keeps reserved", () => {
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "reserved" },
      false,
    )).toBe(null);
  });
});

describe("shouldShowDocStatusChip", () => {
  it("always shows reserved", () => {
    expect(shouldShowDocStatusChip("reserved", false)).toBe(true);
  });

  it("shows not_started when doc date is in folder frame", () => {
    expect(shouldShowDocStatusChip("not_started", true)).toBe(true);
    expect(shouldShowDocStatusChip("not_started", false)).toBe(false);
  });
});
