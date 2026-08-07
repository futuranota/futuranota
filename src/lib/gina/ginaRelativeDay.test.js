import { describe, it, expect } from "vitest";
import {
  calendarDayDelta,
  formatGinaRelativeDay,
  formatGinaShortDate,
  formatGinaAbsoluteTooltip,
  buildGinaTimeDisplay,
} from "./ginaRelativeDay.js";

const NOW = new Date("2026-08-07T15:00:00");

function atDay(offset, hours = 9, minutes = 0) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

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

describe("buildGinaTimeDisplay", () => {
  it("Flexible without anchor", () => {
    expect(buildGinaTimeDisplay({}, NOW).timeLabel).toBe("Flexible");
  });

  it("hybrid relative · clock", () => {
    const out = buildGinaTimeDisplay(
      { anchorAt: atDay(0, 9), timeRange: "9:00 a. m. – 10:00 a. m." },
      NOW,
    );
    expect(out.relativeDay).toBe("Hoy");
    expect(out.timeLabel).toBe("Hoy · 9:00 a. m. – 10:00 a. m.");
    expect(out.absoluteDate).toMatch(/7 ago 2026/);
  });

  it("Mañana without clock", () => {
    const out = buildGinaTimeDisplay({ anchorAt: atDay(1) }, NOW);
    expect(out.timeLabel).toBe("Mañana");
  });
});

describe("formatGinaAbsoluteTooltip", () => {
  it("includes date and time", () => {
    expect(formatGinaAbsoluteTooltip(atDay(0, 9))).toMatch(/7 ago 2026, 09:00/);
  });
});
