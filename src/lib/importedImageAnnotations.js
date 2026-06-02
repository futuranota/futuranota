/** @typedef {{ x: number, y: number }} NormPoint Normalized 0–1 coords within imported image bounds */

export function worldToImageNorm(p, img) {
  return {
    x: (p.x - img.x) / img.width,
    y: (p.y - img.y) / img.height,
  };
}

export function imageNormToWorld(p, img) {
  return {
    x: img.x + p.x * img.width,
    y: img.y + p.y * img.height,
  };
}

export function isWorldPointInImage(p, img, pad = 0) {
  return (
    p.x >= img.x - pad
    && p.x <= img.x + img.width + pad
    && p.y >= img.y - pad
    && p.y <= img.y + img.height + pad
  );
}

/** @param {object} s stroke in normalized image space */
export function strokeNormToWorld(s, img) {
  if (s.kind === "path") {
    return {
      ...s,
      points: s.points.map((pt) => imageNormToWorld(pt, img)),
    };
  }
  if (s.kind === "measure") {
    return {
      ...s,
      p1: imageNormToWorld(s.p1, img),
      p2: imageNormToWorld(s.p2, img),
    };
  }
  if (s.kind === "text") {
    const w = imageNormToWorld({ x: s.x, y: s.y }, img);
    return { ...s, x: w.x, y: w.y };
  }
  return s;
}

/** @param {object} s stroke in world space */
export function strokeWorldToNorm(s, img) {
  if (s.kind === "path") {
    return {
      ...s,
      points: s.points.map((pt) => worldToImageNorm(pt, img)),
    };
  }
  if (s.kind === "measure") {
    return {
      ...s,
      p1: worldToImageNorm(s.p1, img),
      p2: worldToImageNorm(s.p2, img),
    };
  }
  if (s.kind === "text") {
    const n = worldToImageNorm({ x: s.x, y: s.y }, img);
    return { ...s, x: n.x, y: n.y };
  }
  return s;
}

export function normStrokeBounds(s, width, height) {
  const toPx = (p) => ({ x: p.x * width, y: p.y * height });
  if (s.kind === "path" && s.points?.length) {
    const pts = s.points.map(toPx);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      left: Math.min(...xs) - 6,
      top: Math.min(...ys) - 6,
      right: Math.max(...xs) + 6,
      bottom: Math.max(...ys) + 6,
    };
  }
  if (s.kind === "measure") {
    const p1 = toPx(s.p1);
    const p2 = toPx(s.p2);
    return {
      left: Math.min(p1.x, p2.x) - 8,
      top: Math.min(p1.y, p2.y) - 8,
      right: Math.max(p1.x, p2.x) + 8,
      bottom: Math.max(p1.y, p2.y) + 8,
    };
  }
  if (s.kind === "text") {
    const p = toPx({ x: s.x, y: s.y });
    const w = Math.max(18, String(s.text || "").length * 7);
    return {
      left: p.x - 2,
      top: p.y - 2,
      right: p.x + w + 2,
      bottom: p.y + 18,
    };
  }
  return null;
}

/** Remap normalized annotations after bitmap crop in original pixel space. */
export function remapAnnotationsAfterCrop(annotations, crop, origW, origH) {
  if (!annotations?.length) return [];
  const mapPoint = (p) => ({
    x: (p.x * origW - crop.x) / crop.width,
    y: (p.y * origH - crop.y) / crop.height,
  });
  const inBounds = (p) => p.x >= -0.05 && p.x <= 1.05 && p.y >= -0.05 && p.y <= 1.05;

  return annotations
    .map((s) => {
      if (s.kind === "path") {
        return { ...s, points: s.points.map(mapPoint) };
      }
      if (s.kind === "measure") {
        return { ...s, p1: mapPoint(s.p1), p2: mapPoint(s.p2) };
      }
      if (s.kind === "text") {
        const p = mapPoint({ x: s.x, y: s.y });
        return { ...s, x: p.x, y: p.y };
      }
      return s;
    })
    .filter((s) => {
      if (s.kind === "path" && s.points?.length) {
        return s.points.some(inBounds);
      }
      if (s.kind === "measure") return inBounds(s.p1) || inBounds(s.p2);
      if (s.kind === "text") return inBounds({ x: s.x, y: s.y });
      return true;
    });
}
