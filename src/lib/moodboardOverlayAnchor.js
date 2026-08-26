/**
 * Moodboard overlay anchors — positions relative to an image's painted
 * object-fit content box (not the board). Survives expand cover→contain.
 */

/**
 * Parse CSS object-position into 0..1 fractions (x, y).
 * @param {string} value
 * @returns {{ x: number, y: number }}
 */
export function parseObjectPosition(value) {
  const raw = String(value || "50% 50%").trim();
  const parts = raw.split(/\s+/);
  const axis = (token, fallback) => {
    if (!token) return fallback;
    if (token === "left" || token === "top") return 0;
    if (token === "right" || token === "bottom") return 1;
    if (token === "center") return 0.5;
    if (token.endsWith("%")) {
      const n = Number.parseFloat(token);
      return Number.isFinite(n) ? n / 100 : fallback;
    }
    return fallback;
  };
  if (parts.length === 1) {
    return { x: axis(parts[0], 0.5), y: 0.5 };
  }
  return { x: axis(parts[0], 0.5), y: axis(parts[1], 0.5) };
}

/**
 * Painted image rectangle in viewport coords (accounts for object-fit).
 * @param {HTMLImageElement} img
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function getObjectFitContentRect(img) {
  const elRect = img.getBoundingClientRect();
  const nw = img.naturalWidth || 0;
  const nh = img.naturalHeight || 0;
  if (!(elRect.width > 0) || !(elRect.height > 0)) {
    return { left: elRect.left, top: elRect.top, width: 0, height: 0 };
  }
  if (!(nw > 0) || !(nh > 0)) {
    return {
      left: elRect.left,
      top: elRect.top,
      width: elRect.width,
      height: elRect.height,
    };
  }

  const fit = (typeof getComputedStyle === "function"
    ? getComputedStyle(img).objectFit
    : "") || "fill";
  const pos = parseObjectPosition(
    typeof getComputedStyle === "function"
      ? getComputedStyle(img).objectPosition
      : "50% 50%",
  );

  let scale;
  if (fit === "cover") {
    scale = Math.max(elRect.width / nw, elRect.height / nh);
  } else if (fit === "contain" || fit === "scale-down") {
    scale = Math.min(elRect.width / nw, elRect.height / nh);
    if (fit === "scale-down") scale = Math.min(1, scale);
  } else if (fit === "none") {
    scale = 1;
  } else {
    // fill / default — stretch to element box
    return {
      left: elRect.left,
      top: elRect.top,
      width: elRect.width,
      height: elRect.height,
    };
  }

  const width = nw * scale;
  const height = nh * scale;
  const left = elRect.left + (elRect.width - width) * pos.x;
  const top = elRect.top + (elRect.height - height) * pos.y;
  return { left, top, width, height };
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} boardRect
 * @param {{ left: number, top: number, width: number, height: number }} contentRect
 * @returns {{ leftPct: number, topPct: number, widthPct: number, heightPct: number } | null}
 */
export function contentRectToBoardPct(boardRect, contentRect) {
  if (!(boardRect.width > 0) || !(boardRect.height > 0)) return null;
  if (!(contentRect.width > 0) || !(contentRect.height > 0)) return null;
  return {
    leftPct: ((contentRect.left - boardRect.left) / boardRect.width) * 100,
    topPct: ((contentRect.top - boardRect.top) / boardRect.height) * 100,
    widthPct: (contentRect.width / boardRect.width) * 100,
    heightPct: (contentRect.height / boardRect.height) * 100,
  };
}

/**
 * Image-local % → board %.
 * @param {{ leftPct: number, topPct: number, widthPct: number, heightPct: number }} imageRect
 * @param {number} xPct
 * @param {number} yPct
 */
export function projectImagePctToBoardPct(imageRect, xPct, yPct) {
  return {
    xPct: imageRect.leftPct + (Number(xPct) / 100) * imageRect.widthPct,
    yPct: imageRect.topPct + (Number(yPct) / 100) * imageRect.heightPct,
  };
}

/**
 * Board % → image-local % (may fall outside 0..100).
 * @param {{ leftPct: number, topPct: number, widthPct: number, heightPct: number }} imageRect
 * @param {number} boardXPct
 * @param {number} boardYPct
 */
export function projectBoardPctToImagePct(imageRect, boardXPct, boardYPct) {
  if (!(imageRect.widthPct > 0) || !(imageRect.heightPct > 0)) {
    return { xPct: 50, yPct: 50 };
  }
  return {
    xPct: ((Number(boardXPct) - imageRect.leftPct) / imageRect.widthPct) * 100,
    yPct: ((Number(boardYPct) - imageRect.topPct) / imageRect.heightPct) * 100,
  };
}

/**
 * Find the moodboard slot image under a client point (or null).
 * @param {HTMLElement | null} boardEl
 * @param {number} clientX
 * @param {number} clientY
 * @returns {HTMLImageElement | null}
 */
export function findMoodboardAnchorImg(boardEl, clientX, clientY) {
  if (!boardEl || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  const imgs = boardEl.querySelectorAll("img[data-mb-slot-img]");
  let hit = null;
  for (const node of imgs) {
    if (!(node instanceof HTMLImageElement)) continue;
    if (node.classList.contains("doc-moodboard__img--file")) continue;
    // Hit the visible element box (cover crops; content rect can extend outside).
    const elRect = node.getBoundingClientRect();
    if (
      clientX < elRect.left
      || clientX > elRect.left + elRect.width
      || clientY < elRect.top
      || clientY > elRect.top + elRect.height
    ) {
      continue;
    }
    hit = node;
    break;
  }
  return hit;
}

/**
 * Measure all slot image content rects as board %.
 * @param {HTMLElement | null} boardEl
 * @returns {Record<string, { leftPct: number, topPct: number, widthPct: number, heightPct: number }>}
 */
export function measureMoodboardSlotAnchorRects(boardEl) {
  /** @type {Record<string, { leftPct: number, topPct: number, widthPct: number, heightPct: number }>} */
  const out = {};
  if (!boardEl) return out;
  const boardRect = boardEl.getBoundingClientRect();
  if (!(boardRect.width > 0) || !(boardRect.height > 0)) return out;
  const imgs = boardEl.querySelectorAll("img[data-mb-slot-img]");
  for (const node of imgs) {
    if (!(node instanceof HTMLImageElement)) continue;
    if (node.classList.contains("doc-moodboard__img--file")) continue;
    const slotId = node.getAttribute("data-mb-slot-img");
    if (!slotId) continue;
    const content = getObjectFitContentRect(node);
    const pct = contentRectToBoardPct(boardRect, content);
    if (pct) out[slotId] = pct;
  }
  return out;
}

/**
 * Resolve overlay board % from stored coords (+ optional image anchor).
 * @param {{
 *   xPct: number,
 *   yPct: number,
 *   endXPct?: number,
 *   endYPct?: number,
 *   anchorSlotId?: string | null,
 * }} overlay
 * @param {Record<string, { leftPct: number, topPct: number, widthPct: number, heightPct: number }>} slotRects
 */
export function resolveOverlayBoardPosition(overlay, slotRects) {
  const anchorId = overlay?.anchorSlotId ? String(overlay.anchorSlotId) : "";
  const imageRect = anchorId && slotRects ? slotRects[anchorId] : null;
  if (!imageRect) {
    return {
      xPct: overlay.xPct,
      yPct: overlay.yPct,
      endXPct: overlay.endXPct ?? overlay.xPct,
      endYPct: overlay.endYPct ?? overlay.yPct,
      anchored: false,
    };
  }
  const origin = projectImagePctToBoardPct(imageRect, overlay.xPct, overlay.yPct);
  const tip = projectImagePctToBoardPct(
    imageRect,
    overlay.endXPct ?? overlay.xPct,
    overlay.endYPct ?? overlay.yPct,
  );
  return {
    xPct: origin.xPct,
    yPct: origin.yPct,
    endXPct: tip.xPct,
    endYPct: tip.yPct,
    anchored: true,
  };
}
