import { describe, expect, it } from "vitest";
import {
  moveIdBeforeTarget,
  nextSidebarOrderAmong,
  sidebarOrderPatchForIds,
  sortDocsBySidebarOrder,
} from "./folderSidebarOrder.js";

describe("folderSidebarOrder", () => {
  it("sorts by sidebarOrder then title", () => {
    const docs = [
      { id: "b", title: "Beta", sidebarOrder: 2 },
      { id: "a", title: "Alpha", sidebarOrder: 0 },
      { id: "c", title: "Charlie", sidebarOrder: null },
      { id: "d", title: "Delta", sidebarOrder: 1 },
    ];
    expect(sortDocsBySidebarOrder(docs).map((d) => d.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("moves an id before the target", () => {
    expect(moveIdBeforeTarget(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveIdBeforeTarget(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveIdBeforeTarget(["a", "b"], "a", "a")).toBeNull();
  });

  it("builds dense order patches", () => {
    expect(sidebarOrderPatchForIds(["x", "y"])).toEqual({ x: 0, y: 1 });
  });

  it("picks next sidebar order among siblings", () => {
    expect(nextSidebarOrderAmong([{ sidebarOrder: 0 }, { sidebarOrder: 3 }])).toBe(4);
    expect(nextSidebarOrderAmong([])).toBe(0);
  });
});
