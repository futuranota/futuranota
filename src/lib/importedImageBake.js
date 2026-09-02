import {
  measureDisplayTextNorm,
  normMeasureToLocalStroke,
  normPointToLocal,
} from "./importedImageMeasure.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function drawMeasureCap(ctx, p, angle) {
  const perp = angle + Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(perp) * 5, p.y + Math.sin(perp) * 5);
  ctx.lineTo(p.x - Math.cos(perp) * 5, p.y - Math.sin(perp) * 5);
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx */
export function drawMeasureOnCtx(ctx, measureNorm, width, height, units) {
  const s = normMeasureToLocalStroke(measureNorm, width, height);
  ctx.save();
  ctx.strokeStyle = "#ffc56b";
  ctx.fillStyle = "#ffc56b";
  ctx.lineWidth = Math.max(1, width / 420);
  ctx.beginPath();
  ctx.moveTo(s.p1.x, s.p1.y);
  ctx.lineTo(s.p2.x, s.p2.y);
  ctx.stroke();
  const ang = Math.atan2(s.p2.y - s.p1.y, s.p2.x - s.p1.x);
  drawMeasureCap(ctx, s.p1, ang);
  drawMeasureCap(ctx, s.p2, ang);

  const mx = (s.p1.x + s.p2.x) / 2;
  const my = (s.p1.y + s.p2.y) / 2;
  const fontSize = Math.max(11, Math.round(width / 38));
  ctx.font = `500 ${fontSize}px "Geist Mono", "JetBrains Mono", monospace`;
  const txt = measureDisplayTextNorm(measureNorm, units, width, height);
  const m = ctx.measureText(txt);
  const padX = 6;
  const padY = 4;
  const bw = m.width + padX * 2;
  const bh = fontSize + padY * 2;
  ctx.fillStyle = "rgba(20,24,30,0.95)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(mx - bw / 2, my - bh / 2, bw, bh, 4);
  } else {
    ctx.rect(mx - bw / 2, my - bh / 2, bw, bh);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(255,197,107,0.5)";
  ctx.lineWidth = Math.max(1, width / 500);
  ctx.stroke();
  ctx.fillStyle = "#ffc56b";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(txt, mx, my);
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx preview segment in local px */
export function drawMeasurePreviewOnCtx(ctx, p1, p2, unit, units, width, height) {
  const measureNorm = {
    kind: "measure",
    p1: { x: p1.x / width, y: p1.y / height },
    p2: { x: p2.x / width, y: p2.y / height },
    unit,
  };
  drawMeasureOnCtx(ctx, measureNorm, width, height, units);
}

/**
 * Bake imported image bitmap + normalized measure annotations to PNG data URL.
 * @param {{ src: string, naturalWidth?: number, naturalHeight?: number, annotations?: object[] }} image
 */
export async function bakeImportedImageWithAnnotations(image, units) {
  const img = await loadImage(image.src);
  const width = image.naturalWidth || img.naturalWidth || 1;
  const height = image.naturalHeight || img.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  for (const ann of image.annotations || []) {
    if (ann.kind === "measure") {
      drawMeasureOnCtx(ctx, ann, width, height, units);
    }
  }
  return canvas.toDataURL("image/png");
}

/** Local px endpoints for SVG overlay. */
export function measureSvgGeometry(measureNorm, width, height) {
  const p1 = normPointToLocal(measureNorm.p1, width, height);
  const p2 = normPointToLocal(measureNorm.p2, width, height);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  return { p1, p2, mx, my };
}
