import { describe, expect, it } from "vitest";
import { pruneStrayDefaultYo, localWorkspaceNeedsCloudHydrate } from "./storeSanitize.js";

describe("pruneStrayDefaultYo", () => {
  it("removes sole pristine yo placeholder", () => {
    const objects = {
      OBJ_YO: {
        id: "OBJ_YO",
        name: "yo",
        description: "",
        brand: "yo",
        children: [],
        cadence: {},
      },
    };
    const pruned = pruneStrayDefaultYo(objects);
    expect(Object.keys(pruned)).toEqual([]);
  });

  it("removes yo when real companies exist", () => {
    const objects = {
      OBJ_YO: {
        id: "OBJ_YO",
        name: "yo",
        description: "",
        brand: "",
        children: [],
        cadence: {},
      },
      OBJ_REAL: {
        id: "OBJ_REAL",
        name: "Futura nota",
        description: "",
        brand: "Admin",
        children: [],
        cadence: {},
      },
    };
    const pruned = pruneStrayDefaultYo(objects);
    expect(Object.keys(pruned)).toEqual(["OBJ_REAL"]);
  });

  it("keeps yo when it has content (user renamed workspace)", () => {
    const objects = {
      OBJ_YO: {
        id: "OBJ_YO",
        name: "yo",
        description: "My real company",
        brand: "yo",
        children: [],
        cadence: {},
      },
    };
    const pruned = pruneStrayDefaultYo(objects);
    expect(Object.keys(pruned)).toEqual(["OBJ_YO"]);
  });
});

describe("localWorkspaceNeedsCloudHydrate", () => {
  it("treats empty workspace as needing hydrate", () => {
    expect(localWorkspaceNeedsCloudHydrate({}, {})).toBe(true);
  });

  it("treats sole yo placeholder as needing hydrate", () => {
    expect(localWorkspaceNeedsCloudHydrate({
      OBJ_YO: {
        id: "OBJ_YO",
        name: "yo",
        description: "",
        brand: "yo",
        children: [],
        cadence: {},
      },
    }, {})).toBe(true);
  });

  it("does not hydrate over a real company", () => {
    expect(localWorkspaceNeedsCloudHydrate({
      OBJ_REAL: {
        id: "OBJ_REAL",
        name: "Futura nota",
        brand: "Admin",
        children: [],
        cadence: {},
      },
    }, {})).toBe(false);
  });
});
