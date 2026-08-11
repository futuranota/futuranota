/**
 * Storage & Quotas — Tabla A: API free / calls meters.
 * Reset? yes → ventana recurrente (every N day|month).
 * Reset? no → paquete one-shot (welcome); no se repone.
 */

/** @typedef {'day'|'month'} QuotaEveryUnit */
/** @typedef {'calls'|'tokens'} QuotaMeterKind */
/** @typedef {'free'|'welcome'|'paid'} QuotaType */

/**
 * @typedef {{
 *   id: string,
 *   productName: string,
 *   provider: string|null,
 *   meterKind: QuotaMeterKind,
 *   included: number,
 *   unit: string,
 *   type: QuotaType,
 *   resets: boolean,
 *   everyN: number|null,
 *   everyUnit: QuotaEveryUnit|null,
 *   overageUsd: number|null,
 *   anchorAt: string|null,
 *   sortOrder: number,
 *   enabled: boolean,
 *   notes: string,
 * }} QuotaMeterDef
 */

/** Fallback when `admin_quota_meters` SQL not applied yet. */
/** @type {QuotaMeterDef[]} */
export const DEFAULT_API_QUOTA_METERS = [
  {
    id: "groq_requests",
    productName: "Groq (Gina) — requests",
    provider: "groq",
    meterKind: "calls",
    included: 5000,
    unit: "calls",
    type: "free",
    resets: true,
    everyN: 1,
    everyUnit: "month",
    overageUsd: null,
    anchorAt: null,
    sortOrder: 10,
    enabled: true,
    notes: "Free 5 000 requests / month UTC. Paid via tokens after free.",
  },
  {
    id: "groq_tokens",
    productName: "Groq (Gina) — tokens",
    provider: "groq",
    meterKind: "tokens",
    included: 250_000,
    unit: "tokens",
    type: "free",
    resets: true,
    everyN: 1,
    everyUnit: "month",
    overageUsd: ((1.05 + 2.1) / 2) / 1e6,
    anchorAt: null,
    sortOrder: 20,
    enabled: true,
    notes: "Free 250 000 tokens / month UTC.",
  },
  {
    id: "openweather",
    productName: "OpenWeather",
    provider: "openweather",
    meterKind: "calls",
    included: 1000,
    unit: "calls",
    type: "free",
    resets: true,
    everyN: 1,
    everyUnit: "day",
    overageUsd: null,
    anchorAt: null,
    sortOrder: 30,
    enabled: true,
    notes: "1 000 calls / day. Set overage $/call when you know the paid rate.",
  },
  {
    id: "calendarific",
    productName: "Calendarific",
    provider: "calendarific",
    meterKind: "calls",
    included: 100,
    unit: "calls",
    type: "free",
    resets: true,
    everyN: 1,
    everyUnit: "day",
    overageUsd: null,
    anchorAt: null,
    sortOrder: 40,
    enabled: true,
    notes: "Typical free daily allowance.",
  },
  {
    id: "resend",
    productName: "Resend",
    provider: "resend",
    meterKind: "calls",
    included: 100,
    unit: "calls",
    type: "free",
    resets: true,
    everyN: 1,
    everyUnit: "day",
    overageUsd: null,
    anchorAt: null,
    sortOrder: 50,
    enabled: true,
    notes: "Free-tier style daily cap placeholder.",
  },
];

/**
 * @param {string} [key]
 * @param {number} [fallback]
 */
export function readEnvUsage(key, fallback = 0) {
  if (!key) return fallback;
  const raw = (process.env[key] || "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * @param {number} used
 * @param {number} included
 * @param {number|null} overageUsd
 */
export function estimateOverageUsd(used, included, overageUsd) {
  if (overageUsd == null || !Number.isFinite(overageUsd)) return 0;
  const extra = Math.max(0, Number(used) - Number(included));
  return Math.round(extra * overageUsd * 1e6) / 1e6;
}

/**
 * @param {Date} [date]
 */
export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * @param {Date} [date]
 */
export function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * @param {Date} date
 * @param {number} days
 */
export function addUtcDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * @param {Date} date
 */
export function formatUtcYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse YYYY-MM-DD as UTC noon → date; invalid → null.
 * @param {string|null|undefined} raw
 */
export function parseUtcYmd(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * End of as-of day (exclusive upper bound = next midnight UTC).
 * @param {Date} asOf
 */
export function endOfUtcDayExclusive(asOf) {
  return addUtcDays(startOfUtcDay(asOf), 1);
}

/**
 * Resolve the free window that contains `asOf` for a meter.
 * @param {Pick<QuotaMeterDef, 'resets'|'everyN'|'everyUnit'|'anchorAt'>} meter
 * @param {Date} asOf
 */
export function resolveMeterWindow(meter, asOf) {
  const asOfDay = startOfUtcDay(asOf);
  const asOfEnd = endOfUtcDayExclusive(asOf);
  const asOfYmd = formatUtcYmd(asOfDay);

  if (!meter.resets) {
    const anchor = parseUtcYmd(meter.anchorAt) || asOfDay;
    const windowStart = startOfUtcDay(anchor);
    return {
      resets: false,
      windowStart,
      windowEnd: null,
      windowStartYmd: formatUtcYmd(windowStart),
      windowEndYmd: null,
      resetAtYmd: null,
      asOfYmd,
      /** For one-shot: no calendar reset — UI shows "until depleted" */
      timeLeftLabel: "until depleted",
      daysRemaining: null,
      periodLabel: "one-shot (no reset)",
      queryStart: windowStart,
      queryEndExclusive: asOfEnd,
    };
  }

  const everyN = Math.max(1, Number(meter.everyN) || 1);
  const everyUnit = meter.everyUnit === "month" ? "month" : "day";
  const anchor = parseUtcYmd(meter.anchorAt);

  if (everyUnit === "month" && everyN === 1 && !anchor) {
    const windowStart = startOfUtcMonth(asOfDay);
    const windowEnd = new Date(Date.UTC(asOfDay.getUTCFullYear(), asOfDay.getUTCMonth() + 1, 1));
    const daysRemaining = Math.max(
      0,
      Math.ceil((windowEnd.getTime() - asOfDay.getTime()) / 86_400_000) - 1,
    );
    return {
      resets: true,
      windowStart,
      windowEnd,
      windowStartYmd: formatUtcYmd(windowStart),
      windowEndYmd: formatUtcYmd(windowEnd),
      resetAtYmd: formatUtcYmd(windowEnd),
      asOfYmd,
      timeLeftLabel: daysRemaining === 0 ? "resets tomorrow (UTC)" : `${daysRemaining}d`,
      daysRemaining,
      periodLabel: "every 1 month",
      queryStart: windowStart,
      queryEndExclusive: asOfEnd < windowEnd ? asOfEnd : windowEnd,
    };
  }

  if (everyUnit === "day" && everyN === 1 && !anchor) {
    const windowStart = asOfDay;
    const windowEnd = addUtcDays(asOfDay, 1);
    return {
      resets: true,
      windowStart,
      windowEnd,
      windowStartYmd: formatUtcYmd(windowStart),
      windowEndYmd: formatUtcYmd(windowEnd),
      resetAtYmd: formatUtcYmd(windowEnd),
      asOfYmd,
      timeLeftLabel: "0d (resets next UTC day)",
      daysRemaining: 0,
      periodLabel: "every 1 day",
      queryStart: windowStart,
      queryEndExclusive: asOfEnd,
    };
  }

  // Custom cycle: every N days|months from anchor (default: epoch UTC day 0 aligned… use asOf month start or a fixed anchor)
  const cycleAnchor = anchor
    ? startOfUtcDay(anchor)
    : everyUnit === "month"
      ? startOfUtcMonth(asOfDay)
      : asOfDay;

  if (everyUnit === "month") {
    const monthsSince =
      (asOfDay.getUTCFullYear() - cycleAnchor.getUTCFullYear()) * 12
      + (asOfDay.getUTCMonth() - cycleAnchor.getUTCMonth());
    const k = Math.floor(monthsSince / everyN);
    const windowStart = new Date(Date.UTC(
      cycleAnchor.getUTCFullYear(),
      cycleAnchor.getUTCMonth() + k * everyN,
      cycleAnchor.getUTCDate(),
    ));
    const windowEnd = new Date(Date.UTC(
      cycleAnchor.getUTCFullYear(),
      cycleAnchor.getUTCMonth() + (k + 1) * everyN,
      cycleAnchor.getUTCDate(),
    ));
    const daysRemaining = Math.max(
      0,
      Math.ceil((windowEnd.getTime() - asOfDay.getTime()) / 86_400_000) - 1,
    );
    return {
      resets: true,
      windowStart,
      windowEnd,
      windowStartYmd: formatUtcYmd(windowStart),
      windowEndYmd: formatUtcYmd(windowEnd),
      resetAtYmd: formatUtcYmd(windowEnd),
      asOfYmd,
      timeLeftLabel: `${daysRemaining}d`,
      daysRemaining,
      periodLabel: `every ${everyN} month(s)`,
      queryStart: windowStart,
      queryEndExclusive: asOfEnd < windowEnd ? asOfEnd : windowEnd,
    };
  }

  // every N days from anchor
  const ms = asOfDay.getTime() - cycleAnchor.getTime();
  const dayIndex = Math.floor(ms / 86_400_000);
  const k = Math.floor(dayIndex / everyN);
  const windowStart = addUtcDays(cycleAnchor, k * everyN);
  const windowEnd = addUtcDays(windowStart, everyN);
  const daysRemaining = Math.max(
    0,
    Math.ceil((windowEnd.getTime() - asOfDay.getTime()) / 86_400_000) - 1,
  );
  return {
    resets: true,
    windowStart,
    windowEnd,
    windowStartYmd: formatUtcYmd(windowStart),
    windowEndYmd: formatUtcYmd(windowEnd),
    resetAtYmd: formatUtcYmd(windowEnd),
    asOfYmd,
    timeLeftLabel: daysRemaining === 0 ? "resets next window" : `${daysRemaining}d`,
    daysRemaining,
    periodLabel: `every ${everyN} day(s)`,
    queryStart: windowStart,
    queryEndExclusive: asOfEnd < windowEnd ? asOfEnd : windowEnd,
  };
}

/**
 * Map DB row → QuotaMeterDef
 * @param {Record<string, unknown>} row
 * @returns {QuotaMeterDef}
 */
export function mapQuotaMeterRow(row) {
  const everyUnit = row.every_unit === "month" ? "month" : row.every_unit === "day" ? "day" : null;
  return {
    id: String(row.id),
    productName: String(row.product_name || ""),
    provider: row.provider != null && String(row.provider).trim() ? String(row.provider).trim() : null,
    meterKind: row.meter_kind === "tokens" ? "tokens" : "calls",
    included: Number(row.included) || 0,
    unit: String(row.unit || (row.meter_kind === "tokens" ? "tokens" : "calls")),
    type: row.type === "welcome" || row.type === "paid" ? row.type : "free",
    resets: Boolean(row.resets),
    everyN: row.every_n != null ? Number(row.every_n) : null,
    everyUnit,
    overageUsd: row.overage_usd != null && row.overage_usd !== ""
      ? Number(row.overage_usd)
      : null,
    anchorAt: row.anchor_at ? String(row.anchor_at).slice(0, 10) : null,
    sortOrder: Number(row.sort_order) || 0,
    enabled: row.enabled !== false,
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}
