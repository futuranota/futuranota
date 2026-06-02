/**
 * Product isolation for catalog shots on light backgrounds.
 * Chroma-key from corners, keep foreground connected to user seed, then crop.
 */

function sampleBackgroundRgb(data, width, height) {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const n = corners.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function applyChromaKey(data, width, height, tolerance, soften) {
  const [bgR, bgG, bgB] = sampleBackgroundRgb(data, width, height);
  const hardT2 = tolerance * tolerance;
  const softT2 = (tolerance + soften) * (tolerance + soften);
  const alpha = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dist = colorDistanceSq(r, g, b, bgR, bgG, bgB);
      let a = 255;
      if (dist <= hardT2) {
        a = 0;
      } else if (dist <= softT2) {
        const fade = Math.round(((softT2 - dist) / (softT2 - hardT2)) * 255);
        a = Math.max(0, 255 - fade);
      }
      data[i + 3] = a;
      alpha[y * width + x] = a;
    }
  }
  return alpha;
}

function findSeedPixel(alpha, width, height, seedX, seedY, minAlpha = 48) {
  const sx = Math.max(0, Math.min(width - 1, Math.round(seedX * (width - 1))));
  const sy = Math.max(0, Math.min(height - 1, Math.round(seedY * (height - 1))));
  if (alpha[sy * width + sx] >= minAlpha) return { x: sx, y: sy };

  const maxR = Math.max(width, height);
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (alpha[y * width + x] >= minAlpha) return { x, y };
      }
    }
  }
  return null;
}

function keepConnectedComponent(alpha, width, height, seed) {
  const keep = new Uint8Array(width * height);
  const queue = [seed];
  keep[seed.y * width + seed.x] = 1;

  while (queue.length) {
    const { x, y } = queue.pop();
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = ny * width + nx;
      if (keep[idx] || alpha[idx] < 48) continue;
      keep[idx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return keep;
}

function trimBounds(keep, width, height, padding = 4) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!keep[y * width + x]) continue;
      found = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!found) return null;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function loadImageData(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) {
        reject(new Error("Invalid image dimensions"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({
        width,
        height,
        imageData: ctx.getImageData(0, 0, width, height),
        ctx,
        canvas,
      });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

/**
 * @param {string} dataUrl
 * @param {{ tolerance?: number, soften?: number }} options
 * @returns {Promise<string>} PNG data URL with transparency
 */
export function removeImageBackground(dataUrl, options = {}) {
  const tolerance = options.tolerance ?? 40;
  const soften = options.soften ?? 18;

  return loadImageData(dataUrl).then(({ width, height, imageData, ctx, canvas }) => {
    const data = imageData.data;
    applyChromaKey(data, width, height, tolerance, soften);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  });
}

/**
 * Isolate product: chroma-key, keep seed-connected foreground, crop to bounds.
 * @param {string} dataUrl
 * @param {{ seedX: number, seedY: number, tolerance?: number, soften?: number, padding?: number }} options seed 0–1
 * @returns {Promise<{ dataUrl: string, crop: { x: number, y: number, width: number, height: number }, origWidth: number, origHeight: number }>}
 */
export function isolateProductImage(dataUrl, options) {
  const tolerance = options.tolerance ?? 40;
  const soften = options.soften ?? 18;
  const padding = options.padding ?? 6;
  const seedX = options.seedX;
  const seedY = options.seedY;

  if (seedX == null || seedY == null) {
    return Promise.reject(new Error("Product seed required"));
  }

  return loadImageData(dataUrl).then(({ width, height, imageData, ctx }) => {
    const data = imageData.data;
    const alpha = applyChromaKey(data, width, height, tolerance, soften);
    const seed = findSeedPixel(alpha, width, height, seedX, seedY);
    if (!seed) {
      throw new Error("Could not find product at the marked point. Click on the product, not the background.");
    }

    const keep = keepConnectedComponent(alpha, width, height, seed);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (!keep[y * width + x]) data[idx + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const crop = trimBounds(keep, width, height, padding);
    if (!crop || crop.width < 2 || crop.height < 2) {
      throw new Error("Could not crop product bounds");
    }

    const out = document.createElement("canvas");
    out.width = crop.width;
    out.height = crop.height;
    const outCtx = out.getContext("2d");
    outCtx.drawImage(ctx.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

    return {
      dataUrl: out.toDataURL("image/png"),
      crop,
      origWidth: width,
      origHeight: height,
    };
  });
}
