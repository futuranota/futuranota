import { describe, expect, it } from "vitest";
import {
  applyMeasureValueEdit,
  findMeasureStrokeHit,
  measureCurrentNumericValue,
  measureDisplayText,
  parseMeasureInput,
} from "./measureStroke.js";

const UNITS = [
  { id: "px", label: "px", factor: 1 },
  { id: "mm", label: "mm", factor: 0.264 },
];

describe("measureStroke value edit", () => {
  const stroke = {
    kind: "measure",
    p1: { x: 0, y: 0 },
    p2: { x: 100, y: 0 },
    unit: "px",
  };

  it("parses decimal commas and dots", () => {
    expect(parseMeasureInput("12,5")).toBe(12.5);
    expect(parseMeasureInput("12.5")).toBe(12.5);
    expect(parseMeasureInput("-1")).toBeNull();
  });

  it("stores manual value override", () => {
    const next = applyMeasureValueEdit(stroke, "42");
    expect(next.valueManual).toBe(true);
    expect(next.value).toBe(42);
    expect(measureDisplayText(next, UNITS)).toBe("42 px");
  });

  it("clears manual override on empty input", () => {
    const manual = applyMeasureValueEdit(stroke, "42");
    const cleared = applyMeasureValueEdit(manual, "");
    expect(cleared.valueManual).toBeUndefined();
    expect(cleared.value).toBeUndefined();
    expect(measureDisplayText(cleared, UNITS)).toBe("100 px");
  });

  it("reads current numeric value from segment when not manual", () => {
    expect(measureCurrentNumericValue(stroke, UNITS)).toBe(100);
  });

  it("hits label before line", () => {
    const strokes = [stroke];
    const labelCenter = { x: 50, y: 0 };
    const hit = findMeasureStrokeHit(labelCenter, strokes, UNITS);
    expect(hit).toEqual({ index: 0, part: "label" });
  });

  it("hits line away from label", () => {
    const strokes = [stroke];
    const hit = findMeasureStrokeHit({ x: 10, y: 0 }, strokes, UNITS);
    expect(hit).toEqual({ index: 0, part: "line" });
  });
});
