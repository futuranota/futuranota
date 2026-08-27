import { describe, expect, it } from "vitest";
import {
  formatAffiliateMoney,
  fromAffiliateDateInputValue,
  normalizeAffiliateCurrency,
  resolveAffiliateLifecycle,
  toAffiliateDateInputValue,
} from "./urlTableAffiliate.js";

describe("normalizeAffiliateCurrency", () => {
  it("defaults to USD", () => {
    expect(normalizeAffiliateCurrency("")).toBe("USD");
    expect(normalizeAffiliateCurrency(null)).toBe("USD");
  });

  it("uppercases codes", () => {
    expect(normalizeAffiliateCurrency("eur")).toBe("EUR");
  });
});

describe("formatAffiliateMoney", () => {
  it("formats USD", () => {
    expect(formatAffiliateMoney(10, { currency: "USD" })).toMatch(/\$10/);
  });

  it("formats EUR", () => {
    const out = formatAffiliateMoney(10, { currency: "EUR" });
    expect(out).toMatch(/10/);
    expect(out).toMatch(/€|EUR/i);
  });

  it("falls back for custom codes", () => {
    const out = formatAffiliateMoney(12.5, { currency: "XYZ" });
    expect(out).toMatch(/XYZ\s12\.50/);
  });
});

describe("affiliate date helpers", () => {
  it("round-trips date input value", () => {
    const iso = fromAffiliateDateInputValue("2026-08-26");
    expect(iso).toBeTruthy();
    expect(toAffiliateDateInputValue(iso)).toBe("2026-08-26");
  });

  it("returns empty for invalid date input", () => {
    expect(fromAffiliateDateInputValue("")).toBeNull();
  });
});

describe("resolveAffiliateLifecycle pending", () => {
  it("preserves activatedAt while pending", () => {
    const iso = fromAffiliateDateInputValue("2026-08-26");
    const resolved = resolveAffiliateLifecycle({
      affiliateStatus: "pending",
      cookieDays: 30,
      activatedAt: iso,
    });
    expect(resolved.affiliateStatus).toBe("pending");
    expect(resolved.daysRemaining).toBe(30);
    expect(resolved.activatedAt).toBe(iso);
  });
});
