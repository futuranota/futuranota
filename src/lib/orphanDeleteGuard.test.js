import { describe, expect, it } from "vitest";
import { shouldAllowOrphanDelete } from "./orphanDeleteGuard.js";

describe("shouldAllowOrphanDelete", () => {
  it("blocks empty local (second browser with no folders)", () => {
    expect(shouldAllowOrphanDelete({
      localCount: 0,
      remoteCount: 12,
    })).toBe(false);
  });

  it("blocks when remote has more rows than local (partial Chrome cache)", () => {
    expect(shouldAllowOrphanDelete({
      localCount: 1,
      remoteCount: 8,
    })).toBe(false);
  });

  it("allows when local matches remote (true source of truth)", () => {
    expect(shouldAllowOrphanDelete({
      localCount: 5,
      remoteCount: 5,
    })).toBe(true);
  });

  it("allows when local is ahead (new folders not yet on other devices)", () => {
    expect(shouldAllowOrphanDelete({
      localCount: 6,
      remoteCount: 5,
    })).toBe(true);
  });

  it("allows explicit tombstones even if local looks smaller", () => {
    expect(shouldAllowOrphanDelete({
      localCount: 1,
      remoteCount: 9,
      hasPendingDeletes: true,
    })).toBe(true);
  });

  it("refuses when remote count could not be read", () => {
    expect(shouldAllowOrphanDelete({
      localCount: 3,
      remoteCount: 0,
      remoteCountUnknown: true,
    })).toBe(false);
  });
});
