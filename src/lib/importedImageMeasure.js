import {
  applyMeasureValueEdit,
  findMeasureStrokeHit,
  measureCurrentNumericValue,
  measureDisplayText,
} from "./measureStroke.js";

export const CANVAS_MEASURE_UNITS = [
  { id: "px", label: "px", factor: 1 },
  { id: "mm", label: "mm", factor: 0.264 },
  { id: "cm", label: "cm", factor: 0.0264 },
  { id: "in", label: "in", factor: 0.0104 },
];

/** @param {{ x: number, y: number }} p normalized 0–1 */
export function normPointToLocal(p, width, height) {
  return { x: p.x * width, y: p.y * height };
}

/** Normalized measure stroke → local pixel segment for distance / draw. */
export function normMeasureToLocalStroke(s, width, height) {
  return {
    ...s,
    kind: "measure",
    p1: normPointToLocal(s.p1, width, height),
    p2: normPointToLocal(s.p2, width, height),
  };
}

export function measureDisplayTextNorm(s, units, width, height) {
  return measureDisplayText(normMeasureToLocalStroke(s, width, height), units);
}

export function measureCurrentNumericValueNorm(s, units, width, height) {
  return measureCurrentNumericValue(normMeasureToLocalStroke(s, width, height), units);
}

export function findNormMeasureStrokeHit(normP, annotations, units, width, height, opts) {
  const localP = normPointToLocal(normP, width, height);
  const localStrokes = annotations.map((s) => normMeasureToLocalStroke(s, width, height));
  return findMeasureStrokeHit(localP, localStrokes, units, opts);
}

export function applyNormMeasureValueEdit(stroke, rawInput) {
  return applyMeasureValueEdit(stroke, rawInput);
}

export function localPointFromImagePointer(event, element) {
  const rect = element.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    local: { x, y },
    norm: {
      x: Math.min(1, Math.max(0, x / width)),
      y: Math.min(1, Math.max(0, y / height)),
    },
    width,
    height,
  };
}
