/**
 * Tests: wall-clock syntax + deterministic reply (no workspace pivot).
 */

import { describe, expect, it } from "vitest";
import {
  formatGinaWallClockMessage,
  parseWallClockIntent,
  wantsGinaWallClock,
} from "./ginaSyntaxClock.js";
import { runGinaQueryFamily } from "./ginaQueryFamily.js";

describe("ginaSyntaxClock", () => {
  it("matches day / date / time variants (ES + EN, typos ok via fold)", () => {
    expect(parseWallClockIntent("Qué día es hoy?")).toBe("day");
    expect(parseWallClockIntent("que dia es")).toBe("day");
    expect(parseWallClockIntent("What day is it?")).toBe("day");
    expect(parseWallClockIntent("Qué fecha es?")).toBe("date");
    expect(parseWallClockIntent("fecha de hoy")).toBe("date");
    expect(parseWallClockIntent("What's the date?")).toBe("date");
    expect(parseWallClockIntent("Qué hora es?")).toBe("time");
    expect(parseWallClockIntent("que hora es")).toBe("time");
    expect(parseWallClockIntent("What time is it?")).toBe("time");
    expect(parseWallClockIntent("dime la hora")).toBe("time");
  });

  it("does not steal schedule / sheet asks", () => {
    expect(wantsGinaWallClock("muéstrame los horarios de hoy")).toBe(false);
    expect(wantsGinaWallClock("horarios de hoy")).toBe(false);
    expect(wantsGinaWallClock("qué tenemos para hoy")).toBe(false);
    expect(wantsGinaWallClock("today's schedule")).toBe(false);
  });

  it("formats Spanish grounding line with weekday + date + a.m./p.m.", () => {
    // Wednesday Aug 12, 2026 00:46 local
    const now = new Date(2026, 7, 12, 0, 46, 0);
    const msg = formatGinaWallClockMessage(now, "es");
    expect(msg).toBe("Hoy es miércoles 12 de agosto del 2026, hora 12:46 a.m.");
  });

  it("formats English grounding line", () => {
    const now = new Date(2026, 7, 12, 14, 5, 0);
    const msg = formatGinaWallClockMessage(now, "en");
    expect(msg).toMatch(/^Today is Wednesday, August 12, 2026, 2:05 p\.m\.$/);
  });

  it("routes to wall_clock before free_chat / folder hijack", () => {
    const now = new Date(2026, 7, 12, 0, 46, 0);
    const routed = runGinaQueryFamily("Qué día es hoy?", {
      docs: {},
      nodes: {},
      departments: [],
      now,
    });
    expect(routed.family).toBe("wall_clock");
    expect(routed.toolContext?.mode).toBe("day");
    expect(formatGinaWallClockMessage(now, "es")).toBe(
      "Hoy es miércoles 12 de agosto del 2026, hora 12:46 a.m.",
    );
  });
});
