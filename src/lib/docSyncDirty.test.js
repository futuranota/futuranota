import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAllDocDirty,
  clearDocDirty,
  getDirtyDocIds,
  markDocDirty,
  markDocsDirtyIfNewerThan,
  pickDirtyDocs,
} from "./docSyncDirty.js";

describe("docSyncDirty", () => {
  beforeEach(() => {
    clearAllDocDirty();
  });

  it("tracks dirty doc ids for selective cloud upsert", () => {
    markDocDirty("DOC-1");
    expect(getDirtyDocIds().has("DOC-1")).toBe(true);
    clearDocDirty("DOC-1");
    expect(getDirtyDocIds().has("DOC-1")).toBe(false);
  });

  it("marks docs newer than last sync baseline", () => {
    markDocsDirtyIfNewerThan({
      fresh: { updatedAt: "2026-08-30T20:00:00.000Z" },
      stale: { updatedAt: "2026-08-30T10:00:00.000Z" },
    }, Date.parse("2026-08-30T15:00:00.000Z"));

    expect(getDirtyDocIds().has("fresh")).toBe(true);
    expect(getDirtyDocIds().has("stale")).toBe(false);
  });

  it("pickDirtyDocs returns only touched docs", () => {
    markDocDirty("DOC-A");
    const picked = pickDirtyDocs({
      "DOC-A": { id: "DOC-A", title: "A" },
      "DOC-B": { id: "DOC-B", title: "B" },
    });
    expect(Object.keys(picked)).toEqual(["DOC-A"]);
  });
});
