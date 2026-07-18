import { describe, expect, it } from "vitest";
import {
  maxIsoTimestamp,
  maxUpdatedAtFromRows,
  parseVersionMs,
  shouldSkipFullHydrate,
} from "./workspaceVersionGate.js";

describe("shouldSkipFullHydrate", () => {
  const local = "2026-07-18T12:00:00.000Z";

  it("never skips while tombstones are pending", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: local,
        remoteVersion: local,
        hasPendingDeletes: true,
      }),
    ).toBe(false);
  });

  it("never skips without lastSyncedAt", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: null,
        remoteVersion: local,
        hasPendingDeletes: false,
      }),
    ).toBe(false);
  });

  it("never skips without remote version", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: local,
        remoteVersion: null,
        hasPendingDeletes: false,
      }),
    ).toBe(false);
  });

  it("skips when remote equals local", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: local,
        remoteVersion: local,
        hasPendingDeletes: false,
      }),
    ).toBe(true);
  });

  it("skips when local is ahead (after successful push)", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: "2026-07-18T13:00:00.000Z",
        remoteVersion: local,
        hasPendingDeletes: false,
      }),
    ).toBe(true);
  });

  it("hydrates when remote is newer", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: local,
        remoteVersion: "2026-07-18T14:00:00.000Z",
        hasPendingDeletes: false,
      }),
    ).toBe(false);
  });
});

describe("maxUpdatedAtFromRows", () => {
  it("picks the latest updated_at", () => {
    expect(
      maxUpdatedAtFromRows([
        { updated_at: "2026-07-01T00:00:00.000Z" },
        { updatedAt: "2026-07-18T12:00:00.000Z" },
        { updated_at: "2026-07-10T00:00:00.000Z" },
      ]),
    ).toBe("2026-07-18T12:00:00.000Z");
  });
});

describe("parseVersionMs / maxIsoTimestamp", () => {
  it("parses ISO strings", () => {
    expect(parseVersionMs("2026-07-18T12:00:00.000Z")).toBe(
      Date.parse("2026-07-18T12:00:00.000Z"),
    );
  });

  it("returns the later of two timestamps", () => {
    expect(
      maxIsoTimestamp("2026-07-18T12:00:00.000Z", "2026-07-18T13:00:00.000Z"),
    ).toBe("2026-07-18T13:00:00.000Z");
  });
});
