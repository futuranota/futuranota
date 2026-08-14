import { describe, expect, it } from "vitest";
import { parseUtcYmd, resolveMeterWindow } from "./quotaCatalog.js";

describe("resolveMeterWindow rolling Date (Start) / Date (Reset)", () => {
  it("asOf Aug 14 + seed Feb 20 → Start Jul 20, Reset Aug 20, 6 days left", () => {
    const asOf = parseUtcYmd("2026-08-14");
    const win = resolveMeterWindow(
      {
        resets: true,
        everyN: 1,
        everyUnit: "month",
        anchorAt: "2026-02-20",
      },
      asOf,
    );
    expect(win.dateStartYmd).toBe("2026-07-20");
    expect(win.windowStartYmd).toBe("2026-07-20");
    expect(win.resetAtYmd).toBe("2026-08-20");
    expect(win.daysRemaining).toBe(6);
  });

  it("on Reset day Aug 20 → Start becomes Aug 20, Reset Sep 20", () => {
    const asOf = parseUtcYmd("2026-08-20");
    const win = resolveMeterWindow(
      {
        resets: true,
        everyN: 1,
        everyUnit: "month",
        anchorAt: "2026-02-20",
      },
      asOf,
    );
    expect(win.dateStartYmd).toBe("2026-08-20");
    expect(win.resetAtYmd).toBe("2026-09-20");
    expect(win.daysRemaining).toBe(31);
  });

  it("every 1 day without seed: Start and Reset both empty (paired)", () => {
    const asOf = parseUtcYmd("2026-08-14");
    const win = resolveMeterWindow(
      {
        resets: true,
        everyN: 1,
        everyUnit: "day",
        anchorAt: null,
      },
      asOf,
    );
    expect(win.dateStartYmd).toBe(null);
    expect(win.resetAtYmd).toBe(null);
    expect(win.daysRemaining).toBe(null);
  });

  it("Start and Reset always pair when seed exists", () => {
    const asOf = parseUtcYmd("2026-08-14");
    const win = resolveMeterWindow(
      {
        resets: true,
        everyN: 1,
        everyUnit: "month",
        anchorAt: "2026-08-11",
      },
      asOf,
    );
    expect(win.dateStartYmd).toBeTruthy();
    expect(win.resetAtYmd).toBeTruthy();
    expect(win.dateStartYmd).toBe("2026-08-11");
    expect(win.resetAtYmd).toBe("2026-09-11");
  });
});
