import { describe, it, expect } from "vitest";
import {
  calendarDayDelta,
  isGinaDayBeforeToday,
  formatGinaRelativeDay,
  formatGinaShortDate,
  formatGinaDayBadge,
  formatGinaAbsoluteTooltip,
  buildGinaTimeDisplay,
  toGinaDayOnlyRow,
} from "./ginaRelativeDay.js";

const NOW = new Date("2026-08-07T15:00:00");

function atDay(offset, hours = 9, minutes = 0) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

describe("isGinaDayBeforeToday", () => {
  it("today and later are not before today", () => {
    expect(isGinaDayBeforeToday(atDay(0, 9), NOW)).toBe(false);
    expect(isGinaDayBeforeToday(atDay(1), NOW)).toBe(false);
  });
  it("yesterday is before today", () => {
    expect(isGinaDayBeforeToday(atDay(-1), NOW)).toBe(true);
  });
});

describe("calendarDayDelta", () => {
  it("same calendar day is 0", () => {
    expect(calendarDayDelta(NOW, atDay(0, 23))).toBe(0);
  });
  it("tomorrow is 1", () => {
    expect(calendarDayDelta(NOW, atDay(1))).toBe(1);
  });
  it("yesterday is -1", () => {
    expect(calendarDayDelta(NOW, atDay(-1))).toBe(-1);
  });
});

describe("formatGinaRelativeDay", () => {
  it("Hoy / Mañana / Ayer", () => {
    expect(formatGinaRelativeDay(atDay(0), NOW)).toBe("Hoy");
    expect(formatGinaRelativeDay(atDay(1), NOW)).toBe("Mañana");
    expect(formatGinaRelativeDay(atDay(-1), NOW)).toBe("Ayer");
  });

  it("En N días within 2–6", () => {
    expect(formatGinaRelativeDay(atDay(2), NOW)).toBe("En 2 días");
    expect(formatGinaRelativeDay(atDay(6), NOW)).toBe("En 6 días");
  });

  it("Hace N días within 2–6 past", () => {
    expect(formatGinaRelativeDay(atDay(-3), NOW)).toBe("Hace 3 días");
    expect(formatGinaRelativeDay(atDay(-6), NOW)).toBe("Hace 6 días");
  });

  it("≥7 days uses short date", () => {
    expect(formatGinaRelativeDay(atDay(7), NOW)).toBe(formatGinaShortDate(atDay(7)));
    expect(formatGinaRelativeDay(atDay(-10), NOW)).toBe(formatGinaShortDate(atDay(-10)));
  });

  it("null without date", () => {
    expect(formatGinaRelativeDay(null, NOW)).toBe(null);
  });
});

describe("formatGinaDayBadge", () => {
  it("ES absolute day badge", () => {
    expect(formatGinaDayBadge(atDay(0), "es")).toBe("07 Ago");
  });
});

describe("buildGinaTimeDisplay", () => {
  it("Flexible without anchor", () => {
    expect(buildGinaTimeDisplay({}, NOW).timeLabel).toBe("Flexible");
  });

  it("absolute badge · clock (not relative Hoy)", () => {
    const out = buildGinaTimeDisplay(
      { anchorAt: atDay(0, 9), timeRange: "9:00 a. m. – 10:00 a. m." },
      NOW,
      "es",
    );
    expect(out.relativeDay).toBe("Hoy");
    expect(out.dayBadge).toBe("07 Ago");
    expect(out.timeLabel).toBe("07 Ago · 9:00 a. m. – 10:00 a. m.");
    expect(out.absoluteDate).toMatch(/7 ago 2026/);
  });

  it("day badge without clock (not Mañana as primary)", () => {
    const out = buildGinaTimeDisplay({ anchorAt: atDay(1) }, NOW, "es");
    expect(out.relativeDay).toBe("Mañana");
    expect(out.dayBadge).toBe("08 Ago");
    expect(out.timeLabel).toBe("08 Ago");
  });
});

describe("toGinaDayOnlyRow", () => {
  it("drops clock hours and keeps the day badge", () => {
    const row = toGinaDayOnlyRow({
      dayBadge: "07 Ago",
      timeClock: "9:00 a. m. – 10:00 a. m.",
      timeLabel: "07 Ago · 9:00 a. m. – 10:00 a. m.",
      time: "07 Ago · 9:00 a. m. – 10:00 a. m.",
    });
    expect(row.timeClock).toBeNull();
    expect(row.timeLabel).toBe("07 Ago");
    expect(row.time).toBe("07 Ago");
  });
});

describe("formatGinaAbsoluteTooltip", () => {
  it("includes date and time", () => {
    expect(formatGinaAbsoluteTooltip(atDay(0, 9))).toMatch(/7 ago 2026, 09:00/);
  });
});
