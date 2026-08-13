import { describe, expect, it } from "vitest";
import {
  mergeDepartmentRecords,
  mergeSubcategoryLists,
} from "./departments.js";

describe("mergeDepartmentRecords", () => {
  it("keeps local department description when remote is newer but empty", () => {
    const local = {
      id: "d1",
      objectId: "co1",
      category: "Marketing",
      description: "Owns blogs and social",
      subcategories: [{ label: "Blogs", description: "Long form" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const remote = {
      ...local,
      description: "",
      subcategories: [{ label: "Blogs", description: "" }],
      updatedAt: "2026-01-03T00:00:00.000Z",
    };
    const merged = mergeDepartmentRecords(local, remote);
    expect(merged.description).toBe("Owns blogs and social");
    expect(merged.subcategories).toEqual([
      { label: "Blogs", description: "Long form" },
    ]);
  });

  it("unions tags from both sides and fills empty descriptions", () => {
    expect(
      mergeSubcategoryLists(
        [{ label: "Blogs", description: "" }],
        [{ label: "Blogs", description: "Long form" }, { label: "Social", description: "Posts" }],
      ),
    ).toEqual([
      { label: "Blogs", description: "Long form" },
      { label: "Social", description: "Posts" },
    ]);
  });
});
