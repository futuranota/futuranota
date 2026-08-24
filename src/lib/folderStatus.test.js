import { describe, expect, it } from "vitest";
import {
  resolveFolderStatus,
  buildTimedScheduleProgress,
  docNodeHasSchedule,
} from "./folderStatus.js";

describe("resolveFolderStatus priority", () => {
  const folderId = "folder-1";

  it("returns submitted when any child is submitted", () => {
    const nodes = [
      { parentDocId: folderId, status: "in_progress", completed: false },
      { parentDocId: folderId, status: "submitted", completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("submitted");
  });

  it("returns reserved over past_due and completed", () => {
    const nodes = [
      { parentDocId: folderId, status: "completed", completed: true },
      { parentDocId: folderId, status: "completed", completed: true },
      { parentDocId: folderId, status: "past_due", completed: false },
      { parentDocId: folderId, status: "reserved", completed: false },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("reserved");
  });

  it("returns past_due when any child is past_due and none reserved/submitted", () => {
    const nodes = [
      { parentDocId: folderId, status: "past_due", completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("past_due");
  });

  it("returns in_progress when any child is in progress and none higher", () => {
    const nodes = [
      { parentDocId: folderId, status: "in_progress", completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("in_progress");
  });

  it("returns completed when every child is completed", () => {
    const nodes = [
      {
        parentDocId: folderId,
        status: "completed",
        completed: true,
        anchorAt: "2026-08-01T10:00:00",
      },
      {
        parentDocId: folderId,
        status: "completed",
        completed: true,
        anchorAt: "2026-08-02T10:00:00",
      },
    ];
    expect(resolveFolderStatus(nodes, folderId)).toEqual({
      status: "completed",
      total: 2,
      done: 2,
      percent: 100,
      scheduledTotal: 2,
      scheduledDone: 2,
      scheduledPercent: 100,
      unscheduledTotal: 0,
    });
  });

  it("migrates legacy in_review children to submitted priority", () => {
    const nodes = [
      { parentDocId: folderId, status: "in_review", completed: false },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("submitted");
  });

  it("returns not_started when children have no active work status", () => {
    const nodes = [
      { parentDocId: folderId, status: null, completed: false },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    expect(resolveFolderStatus(nodes, folderId).status).toBe("not_started");
  });
});

describe("resolveFolderStatus scheduled percent", () => {
  const folderId = "folder-sched";

  it("counts all docs in total but % only among scheduled", () => {
    const nodes = [
      {
        parentDocId: folderId,
        status: "completed",
        completed: true,
        anchorAt: "2026-08-01T09:00:00",
      },
      {
        parentDocId: folderId,
        status: "not_started",
        completed: false,
        anchorAt: "2026-08-05T09:00:00",
      },
      {
        parentDocId: folderId,
        status: "not_started",
        completed: false,
        // no schedule
      },
    ];
    const st = resolveFolderStatus(nodes, folderId);
    expect(st.total).toBe(3);
    expect(st.unscheduledTotal).toBe(1);
    expect(st.scheduledTotal).toBe(2);
    expect(st.scheduledDone).toBe(1);
    expect(st.scheduledPercent).toBe(50);
    expect(st.percent).toBe(50);
  });

  it("treats submitted as closed for scheduled %", () => {
    const nodes = [
      {
        parentDocId: folderId,
        status: "submitted",
        completed: false,
        anchorAt: "2026-08-01T09:00:00",
      },
      {
        parentDocId: folderId,
        status: "not_started",
        completed: false,
        anchorAt: "2026-08-02T09:00:00",
      },
    ];
    const st = resolveFolderStatus(nodes, folderId);
    expect(st.scheduledPercent).toBe(50);
  });

  it("returns 0% when no children have schedule", () => {
    const nodes = [
      { parentDocId: folderId, status: "completed", completed: true },
      { parentDocId: folderId, status: "completed", completed: true },
    ];
    const st = resolveFolderStatus(nodes, folderId);
    expect(st.total).toBe(2);
    expect(st.done).toBe(2);
    expect(st.scheduledTotal).toBe(0);
    expect(st.percent).toBe(0);
    expect(docNodeHasSchedule(nodes[0])).toBe(false);
  });
});

describe("buildTimedScheduleProgress", () => {
  it("is 0% when timed today docs are open", () => {
    const docs = [
      { status: "not_started", anchorAt: "2026-08-01T09:00:00" },
      { status: "in_progress", anchorAt: "2026-08-01T10:00:00" },
      { status: "past_due", anchorAt: "2026-08-01T11:00:00" },
      { status: "reserved", anchorAt: "2026-08-01T12:00:00" },
    ];
    expect(buildTimedScheduleProgress(docs)).toEqual({
      completed: 0,
      total: 4,
      remaining: 4,
      percent: 0,
    });
  });

  it("counts completed and submitted as closed", () => {
    const docs = [
      { status: "completed", completed: true, anchorAt: "2026-08-01T09:00:00" },
      { status: "submitted", completed: false, anchorAt: "2026-08-01T10:00:00" },
      { status: "not_started", anchorAt: "2026-08-01T11:00:00" },
    ];
    expect(buildTimedScheduleProgress(docs)).toEqual({
      completed: 2,
      total: 3,
      remaining: 1,
      percent: 67,
    });
  });
});
