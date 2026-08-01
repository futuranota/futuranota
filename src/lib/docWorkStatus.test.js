import { describe, expect, it } from "vitest";
import {
  DOC_WORK_STATUS,
  nextStatusOnMeaningfulWrite,
  sanitizeDocStatusForFolderSchedule,
  shouldShowDocStatusChip,
} from "./docWorkStatus.js";

describe("nextStatusOnMeaningfulWrite", () => {
  it("does not auto in_progress without folder reservation", () => {
    expect(nextStatusOnMeaningfulWrite(null, true, { folderScheduleReserved: false })).toBe(null);
  });

  it("auto in_progress when folder is reserved and status empty", () => {
    expect(nextStatusOnMeaningfulWrite(null, true, { folderScheduleReserved: true })).toBe(
      DOC_WORK_STATUS.IN_PROGRESS,
    );
  });

  it("does not override reserved", () => {
    expect(nextStatusOnMeaningfulWrite(
      DOC_WORK_STATUS.RESERVED,
      true,
      { folderScheduleReserved: true },
    )).toBe(null);
  });
});

describe("sanitizeDocStatusForFolderSchedule", () => {
  it("clears work statuses when folder has no reservation", () => {
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "in_progress" },
      false,
    )).toEqual({ status: null, completed: false });
  });

  it("keeps reserved", () => {
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "reserved" },
      false,
    )).toBe(null);
  });

  it("no-op when folder is reserved", () => {
    expect(sanitizeDocStatusForFolderSchedule(
      { status: "submitted" },
      true,
    )).toBe(null);
  });
});

describe("shouldShowDocStatusChip", () => {
  it("always shows reserved", () => {
    expect(shouldShowDocStatusChip("reserved", false)).toBe(true);
  });

  it("hides work statuses when doc date is outside the folder frame", () => {
    expect(shouldShowDocStatusChip("in_progress", false)).toBe(false);
    expect(shouldShowDocStatusChip("completed", false)).toBe(false);
  });

  it("shows work statuses when doc date is inside the folder frame", () => {
    expect(shouldShowDocStatusChip("in_progress", true)).toBe(true);
  });
});
