import { describe, expect, it } from "vitest";
import {
  buildGinaStatusRail,
  compareDocsByStatusThenTime,
  statusRailColor,
  statusRailSortKey,
} from "./ginaStatusColors.js";

describe("ginaStatusColors", () => {
  it("sort key puts past_due before in_progress before completed", () => {
    expect(statusRailSortKey({ status: "past_due" }))
      .toBeLessThan(statusRailSortKey({ status: "in_progress" }));
    expect(statusRailSortKey({ status: "in_progress" }))
      .toBeLessThan(statusRailSortKey({ status: "not_started" }));
    expect(statusRailSortKey({ status: "not_started" }))
      .toBeLessThan(statusRailSortKey({ status: "completed" }));
    expect(statusRailSortKey({ status: null }))
      .toBeLessThan(statusRailSortKey({ status: "completed" }));
  });

  it("buildGinaStatusRail only includes present statuses in order", () => {
    const rail = buildGinaStatusRail([
      { status: "completed", title: "c" },
      { status: "past_due", title: "a" },
      { status: "past_due", title: "b" },
      { status: "in_progress", title: "d" },
    ], "es");
    expect(rail.map((s) => s.id)).toEqual(["past_due", "in_progress", "completed"]);
    expect(rail[0].count).toBe(2);
    expect(rail[0].color).toBe(statusRailColor("past_due"));
    expect(rail[0].name).toMatch(/vencido/i);
  });

  it("compareDocsByStatusThenTime sorts by status then anchorAt", () => {
    const docs = [
      { status: "completed", anchorAt: "2026-08-05T09:00:00", title: "done" },
      { status: "past_due", anchorAt: "2026-08-06T10:00:00", title: "late2" },
      { status: "past_due", anchorAt: "2026-08-04T10:00:00", title: "late1" },
      { status: "in_progress", anchorAt: "2026-08-07T09:00:00", title: "now" },
    ];
    docs.sort(compareDocsByStatusThenTime);
    expect(docs.map((d) => d.title)).toEqual(["late1", "late2", "now", "done"]);
  });
});
