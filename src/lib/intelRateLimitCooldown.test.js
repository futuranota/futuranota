import { describe, it, expect } from "vitest";
import {
  formatRateLimitClock,
  isIntelRateLimitError,
  parseRetryAfterSeconds,
  rateLimitProgress,
  resolveIntelRateLimitCooldownSec,
} from "./intelRateLimitCooldown.js";

describe("intelRateLimitCooldown", () => {
  it("detects rate limit errors", () => {
    expect(isIntelRateLimitError("Groq: rate limit alcanzado", "rate_limit", 429)).toBe(true);
    expect(isIntelRateLimitError("Search failed", null, 500)).toBe(false);
  });

  it("parses retry-after from message", () => {
    expect(parseRetryAfterSeconds("Groq 429: retry after 45 seconds")).toBe(45);
    expect(parseRetryAfterSeconds("no retry")).toBe(null);
  });

  it("defaults cooldown to 90s", () => {
    expect(resolveIntelRateLimitCooldownSec("rate limit")).toBe(90);
    expect(resolveIntelRateLimitCooldownSec("retry in 30")).toBe(30);
  });

  it("formats mm:ss clock", () => {
    expect(formatRateLimitClock(90)).toBe("1:30");
    expect(formatRateLimitClock(5)).toBe("0:05");
  });

  it("computes ring progress", () => {
    expect(rateLimitProgress(90, 45)).toBe(0.5);
    expect(rateLimitProgress(90, 0)).toBe(0);
  });
});
