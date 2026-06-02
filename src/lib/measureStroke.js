export function measureDistPx(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/** @param {{ p1: {x:number,y:number}, p2: {x:number,y:number} }} segment world space */
export function autoMeasureValueFromWorld(p1, p2, unitId, units) {
  const distPx = measureDistPx(p1, p2);
  const uDef = units.find((x) => x.id === unitId) || units[0];
  const raw = distPx * uDef.factor;
  if (uDef.id === "px") return Math.round(raw);
  return Math.round(raw * 10) / 10;
}

export function formatMeasureValue(value, unitId, units) {
  const uDef = units.find((x) => x.id === unitId) || units[0];
  const v = Number(value);
  if (Number.isNaN(v)) return `0 ${uDef.label}`;
  const formatted = uDef.id === "px" ? String(Math.round(v)) : String(v);
  return `${formatted} ${uDef.label}`;
}

/** @param {object} s measure stroke in world space */
export function measureDisplayText(s, units) {
  const uDef = units.find((x) => x.id === s.unit) || units[0];
  if (s.valueManual && s.value != null && !Number.isNaN(Number(s.value))) {
    return formatMeasureValue(s.value, s.unit, units);
  }
  const distPx = measureDistPx(s.p1, s.p2);
  const distU = (distPx * uDef.factor).toFixed(uDef.id === "px" ? 0 : 1);
  return `${distU} ${uDef.label}`;
}

/** @param {object} s measure stroke in world space */
export function measureLabelBoundsWorld(s, units) {
  if (s.kind !== "measure") return null;
  const mx = (s.p1.x + s.p2.x) / 2;
  const my = (s.p1.y + s.p2.y) / 2;
  const txt = measureDisplayText(s, units);
  const bw = Math.max(40, txt.length * 6.5 + 12);
  const bh = 18;
  return {
    left: mx - bw / 2,
    top: my - bh / 2,
    right: mx + bw / 2,
    bottom: my + bh / 2,
  };
}

export function isPointInRect(p, rect) {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

export function parseMeasureInput(raw) {
  const n = parseFloat(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
