import { beforeEach, describe, expect, it } from "vitest";
import {
  maxIsoTimestamp,
  maxUpdatedAtFromRows,
  parseVersionMs,
  readWorkspaceOwnerUserId,
  remoteHasMoreRowsThanLocal,
  shouldSkipFullHydrate,
  writeWorkspaceOwnerUserId,
  clearWorkspaceOwnerUserId,
  WORKSPACE_FOLDERS_TABLE,
  WORKSPACE_OWNER_USER_KEY,
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

  it("never skips when local workspace is empty", () => {
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: local,
        remoteVersion: local,
        hasPendingDeletes: false,
        localEmpty: true,
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

  it("hydrates when remote row counts exceed local (same timestamp)", () => {
    const counts = {
      companies: 2,
      [WORKSPACE_FOLDERS_TABLE]: 1,
      nodes: 0,
      canvas_nodes: 0,
      canvas_connections: 0,
      groupings: 0,
      timelines: 0,
    };
    expect(
      shouldSkipFullHydrate({
        lastSyncedAt: local,
        remoteVersion: local,
        hasPendingDeletes: false,
        localCounts: { ...counts, companies: 1 },
        remoteCounts: counts,
      }),
    ).toBe(false);
  });
});

describe("remoteHasMoreRowsThanLocal", () => {
  it("detects extra remote companies", () => {
    expect(
      remoteHasMoreRowsThanLocal(
        { companies: 1 },
        { companies: 2 },
      ),
    ).toBe(true);
  });

  it("ignores equal or lower remote counts", () => {
    expect(
      remoteHasMoreRowsThanLocal(
        { companies: 2 },
        { companies: 1 },
      ),
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

describe("workspace owner user id", () => {
  const memory = new Map();

  beforeEach(() => {
    memory.clear();
    globalThis.localStorage = {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
    };
  });

  it("writes and reads owner id", () => {
    writeWorkspaceOwnerUserId("user-a");
    expect(readWorkspaceOwnerUserId()).toBe("user-a");
    expect(memory.get(WORKSPACE_OWNER_USER_KEY)).toBe("user-a");
  });

  it("clears owner id", () => {
    writeWorkspaceOwnerUserId("user-a");
    clearWorkspaceOwnerUserId();
    expect(readWorkspaceOwnerUserId()).toBeNull();
  });
});
