import { describe, expect, it } from "vitest";
import {
  applyMeasureValueEdit,
  findMeasureStrokeHit,
  measureCurrentNumericValue,
  measureDisplayText,
} from "./measureStroke.js";
import {
  findNormMeasureStrokeHit,
  measureCurrentNumericValueNorm,
  measureDisplayTextNorm,
} from "./importedImageMeasure.js";

const UNITS = [
  { id: "px", label: "px", factor: 1 },
  { id: "mm", label: "mm", factor: 0.264 },
];

describe("measureStroke", () => {
  const stroke = {
    kind: "measure",
    p1: { x: 0, y: 0 },
    p2: { x: 100, y: 0 },
    unit: "px",
  };

  it("stores manual value override", () => {
    const next = applyMeasureValueEdit(stroke, "42");
    expect(measureDisplayText(next, UNITS)).toBe("42 px");
  });

  it("hits label center", () => {
    const hit = findMeasureStrokeHit({ x: 50, y: 0 }, [stroke], UNITS);
    expect(hit).toEqual({ index: 0, part: "label" });
  });
});

describe("importedImageMeasure", () => {
  const normStroke = {
    kind: "measure",
    p1: { x: 0, y: 0.5 },
    p2: { x: 1, y: 0.5 },
    unit: "px",
  };

  it("converts norm segment to display distance", () => {
    expect(measureDisplayTextNorm(normStroke, UNITS, 200, 100)).toBe("200 px");
    expect(measureCurrentNumericValueNorm(normStroke, UNITS, 200, 100)).toBe(200);
  });

  it("hits normalized label", () => {
    const hit = findNormMeasureStrokeHit({ x: 0.5, y: 0.5 }, [normStroke], UNITS, 200, 100);
    expect(hit).toEqual({ index: 0, part: "label" });
  });
});
