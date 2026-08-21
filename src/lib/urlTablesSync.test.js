import { describe, it, expect, beforeEach } from "vitest";
import {
  mergeUrlTablesFromRemote,
  markUrlTableDeleted,
} from "./urlTablesSync.js";

describe("mergeUrlTablesFromRemote tombstones", () => {
  beforeEach(() => {
    // markUrlTableDeleted only adds; clear via sync success path is not available
    // in unit tests — re-marking known ids is enough if we assert exclusion.
    // Reset by importing fresh module state is hard; use unique ids per test.
  });

  it("does not reintroduce a tombstoned remote table", () => {
    const id = `URLT-tombstone-${Date.now()}-a`;
    markUrlTableDeleted(id);
    const remote = [
      {
        id,
        objectId: "OBJ-1",
        title: "Ghost",
        kind: "links",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const merged = mergeUrlTablesFromRemote([], remote);
    expect(merged.find((t) => t.id === id)).toBeUndefined();
  });

  it("does not keep a tombstoned local-only table", () => {
    const id = `URLT-tombstone-${Date.now()}-b`;
    markUrlTableDeleted(id);
    const local = [
      {
        id,
        objectId: "OBJ-1",
        title: "Local ghost",
        kind: "links",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const merged = mergeUrlTablesFromRemote(local, []);
    expect(merged.find((t) => t.id === id)).toBeUndefined();
  });

  it("still merges live remote tables", () => {
    const id = `URLT-live-${Date.now()}-c`;
    const remote = [
      {
        id,
        objectId: "OBJ-1",
        title: "Live",
        kind: "affiliates",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const merged = mergeUrlTablesFromRemote([], remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(id);
    expect(merged[0].kind).toBe("affiliates");
  });
});
