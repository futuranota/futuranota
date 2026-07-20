/** Optional schedule anchor on text/checkbox nodes (wires + canvas display). */

export function normalizeAnchorFields(blockOrNode) {
  const anchorDate = blockOrNode?.anchorDate || "";
  const anchorTime = blockOrNode?.anchorTime || "";
  return { anchorDate, anchorTime };
}

export function isoFromAnchorFields(anchorDate, anchorTime = "") {
  const date = String(anchorDate ?? "").trim();
  if (!date) return null;
  const time = String(anchorTime ?? "").trim() || "12:00";
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const d = new Date(`${date}T${normalizedTime}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function anchorFieldsFromIso(iso) {
  if (!iso) return { anchorDate: "", anchorTime: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { anchorDate: "", anchorTime: "" };
  // Local calendar — matches docDates (avoids UTC day shift from toISOString).
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return {
    anchorDate: `${y}-${m}-${day}`,
    anchorTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function anchorAtFromBlock(block) {
  const { anchorDate, anchorTime } = normalizeAnchorFields(block);
  return isoFromAnchorFields(anchorDate, anchorTime);
}

/** Effective anchor: explicit Schedule on the block wins; Created is fallback only. */
export function resolveBlockAnchorFields(block, docCreatedDate = "", options = {}) {
  const { noNodeLink = false } = options;
  const explicit = normalizeAnchorFields(block);
  if (explicit.anchorDate) {
    return explicit;
  }
  if (!block?.queryEnabled || noNodeLink) {
    const date = String(docCreatedDate ?? "").trim();
    return { anchorDate: date, anchorTime: "" };
  }
  if (!block.anchorFromNode) {
    const date = String(docCreatedDate ?? "").trim();
    return { anchorDate: date, anchorTime: "" };
  }
  return explicit;
}

export function resolveBlockAnchor(block, docCreatedDate = "") {
  const { anchorDate, anchorTime } = resolveBlockAnchorFields(block, docCreatedDate);
  return isoFromAnchorFields(anchorDate, anchorTime);
}

export function hasAnchorFields(blockOrNode) {
  const { anchorDate } = normalizeAnchorFields(blockOrNode);
  return Boolean(anchorDate);
}

/** Display: schedule: mm/dd/yyyy | h:mm AM/PM */
export function formatScheduleLabel(anchorDate, anchorTime = "") {
  const date = String(anchorDate ?? "").trim();
  if (!date) return "";

  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";

  const datePart = `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;

  const timeStr = String(anchorTime ?? "").trim();
  if (!timeStr) return `schedule: ${datePart}`;

  const [hh, mm] = timeStr.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return `schedule: ${datePart}`;

  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  const timePart = `${h12}:${String(mm).padStart(2, "0")} ${period}`;

  return `schedule: ${datePart} | ${timePart}`;
}

export function formatScheduleLabelFromIso(iso) {
  const { anchorDate, anchorTime } = anchorFieldsFromIso(iso);
  return formatScheduleLabel(anchorDate, anchorTime);
}
