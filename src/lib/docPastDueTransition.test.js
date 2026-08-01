import { describe, expect, it, vi } from "vitest";
import {
  applyPastDueTransitions,
  shouldAutoPastDue,
} from "./docPastDueTransition.js";

const folder = {
  id: "folder-1",
  scheduleStartAt: "2026-07-30T12:00:00.000Z",
  scheduleFinishAt: "2026-07-31T12:00:00.000Z",
};

describe("shouldAutoPastDue", () => {
  it("converts in_progress after scheduled day ends inside folder window", () => {
    const node = {
      id: "n1",
      parentDocId: "folder-1",
      status: "in_progress",
      anchorAt: "2026-07-30T15:00:00.000Z",
      anchorFinishAt: "2026-07-30T16:00:00.000Z",
    };
    expect(shouldAutoPastDue(node, folder, new Date("2026-07-31T12:00:00"))).toBe(true);
  });

  it("does not convert reserved / submitted / completed", () => {
    const base = {
      id: "n1",
      parentDocId: "folder-1",
      anchorAt: "2026-07-30T15:00:00.000Z",
    };
    expect(shouldAutoPastDue({ ...base, status: "reserved" }, folder, new Date("2026-08-01"))).toBe(false);
    expect(shouldAutoPastDue({ ...base, status: "submitted" }, folder, new Date("2026-08-01"))).toBe(false);
    expect(shouldAutoPastDue({ ...base, status: "completed", completed: true }, folder, new Date("2026-08-01"))).toBe(false);
  });

  it("does not convert when folder has no reservation", () => {
    const node = {
      id: "n1",
      parentDocId: "folder-1",
      status: "in_progress",
      anchorAt: "2026-07-30T15:00:00.000Z",
    };
    expect(shouldAutoPastDue(node, {}, new Date("2026-08-01"))).toBe(false);
  });

  it("does not convert while still on the scheduled day", () => {
    const node = {
      id: "n1",
      parentDocId: "folder-1",
      status: "in_progress",
      anchorAt: "2026-07-30T15:00:00.000Z",
    };
    expect(shouldAutoPastDue(node, folder, new Date("2026-07-30T20:00:00"))).toBe(false);
  });
});

describe("applyPastDueTransitions", () => {
  it("updates eligible nodes via updateNode", () => {
    const updateNode = vi.fn();
    const count = applyPastDueTransitions({
      nodes: {
        n1: {
          id: "n1",
          parentDocId: "folder-1",
          status: "in_progress",
          completed: false,
          anchorAt: "2026-07-30T15:00:00.000Z",
        },
        n2: {
          id: "n2",
          parentDocId: "folder-1",
          status: "reserved",
          completed: false,
          anchorAt: "2026-12-01T15:00:00.000Z",
        },
      },
      docs: { "folder-1": folder },
      updateNode,
      now: new Date("2026-08-01T12:00:00"),
    });
    expect(count).toBe(1);
    expect(updateNode).toHaveBeenCalledWith("n1", {
      status: "past_due",
      completed: false,
    });
  });
});
