import { describe, it, expect, beforeEach, vi } from "vitest";

const getSession = vi.fn();
const refreshSession = vi.fn();
const setSession = vi.fn();

vi.mock("./supabaseClient.js", () => ({
  getSupabaseConfigError: () => null,
  supabase: {
    auth: {
      getSession: (...args) => getSession(...args),
      refreshSession: (...args) => refreshSession(...args),
      setSession: (...args) => setSession(...args),
    },
  },
}));

describe("resolveSyncUserId", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    refreshSession.mockReset();
    setSession.mockReset();
    localStorage.clear();
  });

  it("returns session user when getSession works", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" }, expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    });
    const { resolveSyncUserId } = await import("./resolveSyncUserId.js");
    await expect(resolveSyncUserId()).resolves.toBe("u1");
  });

  it("keeps current user when refresh fails near expiry", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 30;
    getSession.mockResolvedValue({
      data: { session: { user: { id: "u1" }, expires_at: expiresAt } },
      error: null,
    });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "refresh failed" },
    });
    const { resolveSyncUserId } = await import("./resolveSyncUserId.js");
    await expect(resolveSyncUserId()).resolves.toBe("u1");
  });

  it("recovers via setSession from localStorage when getSession is empty", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "no" } });
    localStorage.setItem(
      "sb-test-auth-token",
      JSON.stringify({
        access_token: "at",
        refresh_token: "rt",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "u-stored" },
      }),
    );
    setSession.mockResolvedValue({
      data: { session: { user: { id: "u-stored" }, expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    });
    const { resolveSyncUserId } = await import("./resolveSyncUserId.js");
    await expect(resolveSyncUserId()).resolves.toBe("u-stored");
    expect(setSession).toHaveBeenCalledWith({
      access_token: "at",
      refresh_token: "rt",
    });
  });
});
