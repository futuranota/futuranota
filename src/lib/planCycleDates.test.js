import { describe, expect, it } from "vitest";
import {
  addUtcMonthsClamped,
  nextMonthlyAnniversaryUtc,
  resolveUserPlanDates,
  utcCalendarDaysBetween,
} from "./planCycleDates.js";

describe("addUtcMonthsClamped", () => {
  it("clamps Jan 31 to Feb 28", () => {
    const next = addUtcMonthsClamped(new Date("2026-01-31T12:00:00.000Z"), 1);
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("nextMonthlyAnniversaryUtc", () => {
  it("returns this month when the day is still ahead", () => {
    const next = nextMonthlyAnniversaryUtc("2026-06-18T18:00:00.000Z", "2026-08-11T15:00:00.000Z");
    expect(next.toISOString().slice(0, 10)).toBe("2026-08-18");
  });

  it("rolls to next month when the day already passed", () => {
    const next = nextMonthlyAnniversaryUtc("2026-08-05T18:00:00.000Z", "2026-08-11T15:00:00.000Z");
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-05");
  });

  it("returns today when asOf is the anniversary day", () => {
    const next = nextMonthlyAnniversaryUtc("2026-06-18T09:00:00.000Z", "2026-08-18T22:00:00.000Z");
    expect(next.toISOString().slice(0, 10)).toBe("2026-08-18");
  });

  it("rolls to next month after the anniversary day", () => {
    const next = nextMonthlyAnniversaryUtc("2026-06-18T09:00:00.000Z", "2026-08-19T01:00:00.000Z");
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-18");
  });
});

describe("resolveUserPlanDates", () => {
  it("free-only: next date from signup day", () => {
    const d = resolveUserPlanDates({
      plan: "free",
      freeStartedAt: "2026-08-05T14:00:00.000Z",
      proStartedAt: null,
      asOf: "2026-08-11T12:00:00.000Z",
    });
    expect(d.freeYmd).toBe("2026-08-05");
    expect(d.proYmd).toBe(null);
    expect(d.nextYmd).toBe("2026-09-05");
    expect(d.daysToPro).toBe(null);
    expect(d.anchorKind).toBe("free");
  });

  it("pro owns next date after free→pro in 6 days", () => {
    const d = resolveUserPlanDates({
      plan: "pro",
      freeStartedAt: "2026-08-05T14:00:00.000Z",
      proStartedAt: "2026-08-11T18:00:00.000Z",
      asOf: "2026-08-11T20:00:00.000Z",
    });
    expect(d.freeYmd).toBe("2026-08-05");
    expect(d.proYmd).toBe("2026-08-11");
    expect(d.daysToPro).toBe(6);
    expect(d.nextYmd).toBe("2026-09-11");
    expect(d.anchorKind).toBe("pro");
  });

  it("downgraded back to free: next date follows free signup again", () => {
    const d = resolveUserPlanDates({
      plan: "free",
      freeStartedAt: "2026-08-05T14:00:00.000Z",
      proStartedAt: "2026-08-11T18:00:00.000Z",
      asOf: "2026-08-20T12:00:00.000Z",
    });
    expect(d.proYmd).toBe("2026-08-11");
    expect(d.nextYmd).toBe("2026-09-05");
    expect(d.anchorKind).toBe("free");
  });
});

describe("utcCalendarDaysBetween", () => {
  it("counts 6 days free → pro", () => {
    expect(
      utcCalendarDaysBetween("2026-08-05T23:00:00.000Z", "2026-08-11T01:00:00.000Z"),
    ).toBe(6);
  });
});
