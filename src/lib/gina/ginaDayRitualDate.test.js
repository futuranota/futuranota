import { describe, expect, it } from "vitest";
import {
  ginaDayKey,
  ginaYesterdayKey,
  isAcceptableGinaDayRitualDate,
  isGinaDayRitualOvernight,
} from "./ginaDayRitualDate.js";

describe("ginaDayRitualDate", () => {
  it("accepts today’s date always", () => {
    const now = new Date("2026-08-10T14:00:00");
    expect(isAcceptableGinaDayRitualDate(ginaDayKey(now), now)).toBe(true);
    expect(isGinaDayRitualOvernight(now)).toBe(false);
  });

  it("accepts yesterday before 06:00 local (overnight grace)", () => {
    const now = new Date("2026-08-10T01:03:00");
    expect(isGinaDayRitualOvernight(now)).toBe(true);
    expect(isAcceptableGinaDayRitualDate(ginaYesterdayKey(now), now)).toBe(true);
    expect(isAcceptableGinaDayRitualDate(ginaDayKey(now), now)).toBe(true);
  });

  it("rejects yesterday after 06:00", () => {
    const now = new Date("2026-08-10T06:00:00");
    expect(isGinaDayRitualOvernight(now)).toBe(false);
    expect(isAcceptableGinaDayRitualDate(ginaYesterdayKey(now), now)).toBe(false);
  });
});
