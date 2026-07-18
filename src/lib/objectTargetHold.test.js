import { describe, expect, it } from "vitest";
import { resolveEffectiveDashboardObjectId } from "./objectTargetHold.js";

describe("resolveEffectiveDashboardObjectId", () => {
  it("uses the held object when pinned, ignoring the browsing target", () => {
    expect(resolveEffectiveDashboardObjectId("home", "futura")).toBe("home");
  });

  it("falls back to the browsing target when nothing is pinned", () => {
    expect(resolveEffectiveDashboardObjectId(null, "futura")).toBe("futura");
    expect(resolveEffectiveDashboardObjectId(undefined, "futura")).toBe("futura");
  });

  it("returns null when neither is set", () => {
    expect(resolveEffectiveDashboardObjectId(null, null)).toBe(null);
    expect(resolveEffectiveDashboardObjectId(undefined, undefined)).toBe(null);
  });

  it("keeps the pin even when there is no browsing target", () => {
    expect(resolveEffectiveDashboardObjectId("home", null)).toBe("home");
  });
});
