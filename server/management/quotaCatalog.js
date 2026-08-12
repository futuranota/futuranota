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
    anchorAt: "2026-02-20",
    sortOrder: 10,
    enabled: true,
    notes: "Free 5 000 requests / month. Resets on the 20th (account anniversary).",
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
    anchorAt: "2026-02-20",
    sortOrder: 20,
    enabled: true,
    notes: "Free 250 000 tokens / month. Resets on the 20th (account anniversary).",
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
 * @param {Date} date
 * @param {number} months
 */
export function addUtcMonths(date, months) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    date.getUTCDate(),
  ));
}

/**
 * Days from asOfDay until reset date (windowEnd). Aug 11 → Aug 20 = 9.
 * @param {Date} asOfDay
 * @param {Date} windowEnd
 */
function daysRemainingUntil(asOfDay, windowEnd) {
  return Math.max(
    0,
    Math.round((windowEnd.getTime() - asOfDay.getTime()) / 86_400_000),
  );
}

/**
 * Resolve the free window that contains `asOf` for a meter.
 * Month + Anchor = anniversary cycle (e.g. 20th→20th). If windowStart would be
 * after asOf (day-of-month before anniversary), step back one period.
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

  // Calendar month (1st → 1st) when no anniversary anchor
  if (everyUnit === "month" && everyN === 1 && !anchor) {
    const windowStart = startOfUtcMonth(asOfDay);
    const windowEnd = new Date(Date.UTC(asOfDay.getUTCFullYear(), asOfDay.getUTCMonth() + 1, 1));
    const daysRemaining = daysRemainingUntil(asOfDay, windowEnd);
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
      periodLabel: "every 1 month (calendar)",
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
      timeLeftLabel: "0",
      daysRemaining: 0,
      periodLabel: "every 1 day",
      queryStart: windowStart,
      queryEndExclusive: asOfEnd,
    };
  }

  const cycleAnchor = anchor
    ? startOfUtcDay(anchor)
    : everyUnit === "month"
      ? startOfUtcMonth(asOfDay)
      : asOfDay;

  if (everyUnit === "month") {
    // If asOf is before first anchor, still open the first window starting at anchor
    if (asOfDay < cycleAnchor) {
      const windowStart = cycleAnchor;
      const windowEnd = addUtcMonths(windowStart, everyN);
      const daysRemaining = daysRemainingUntil(asOfDay, windowEnd);
      return {
        resets: true,
        windowStart,
        windowEnd,
        windowStartYmd: formatUtcYmd(windowStart),
        windowEndYmd: formatUtcYmd(windowEnd),
        resetAtYmd: formatUtcYmd(windowEnd),
        asOfYmd,
        timeLeftLabel: String(daysRemaining),
        daysRemaining,
        periodLabel: `every ${everyN} month(s) from ${formatUtcYmd(cycleAnchor)}`,
        queryStart: windowStart,
        queryEndExclusive: asOfEnd < windowEnd ? asOfEnd : windowEnd,
      };
    }

    const monthsSince =
      (asOfDay.getUTCFullYear() - cycleAnchor.getUTCFullYear()) * 12
      + (asOfDay.getUTCMonth() - cycleAnchor.getUTCMonth());
    let k = Math.floor(monthsSince / everyN);
    let windowStart = addUtcMonths(cycleAnchor, k * everyN);
    // Anniversary not reached yet this period (e.g. today 11th, reset on 20th)
    if (windowStart > asOfDay) {
      k -= 1;
      windowStart = addUtcMonths(cycleAnchor, k * everyN);
    }
    const windowEnd = addUtcMonths(windowStart, everyN);
    const daysRemaining = daysRemainingUntil(asOfDay, windowEnd);
    return {
      resets: true,
      windowStart,
      windowEnd,
      windowStartYmd: formatUtcYmd(windowStart),
      windowEndYmd: formatUtcYmd(windowEnd),
      resetAtYmd: formatUtcYmd(windowEnd),
      asOfYmd,
      timeLeftLabel: String(daysRemaining),
      daysRemaining,
      periodLabel: `every ${everyN} month(s) from ${formatUtcYmd(cycleAnchor)}`,
      queryStart: windowStart,
      queryEndExclusive: asOfEnd < windowEnd ? asOfEnd : windowEnd,
    };
  }

  // every N days from anchor
  if (asOfDay < cycleAnchor) {
    const windowStart = cycleAnchor;
    const windowEnd = addUtcDays(windowStart, everyN);
    const daysRemaining = daysRemainingUntil(asOfDay, windowEnd);
    return {
      resets: true,
      windowStart,
      windowEnd,
      windowStartYmd: formatUtcYmd(windowStart),
      windowEndYmd: formatUtcYmd(windowEnd),
      resetAtYmd: formatUtcYmd(windowEnd),
      asOfYmd,
      timeLeftLabel: String(daysRemaining),
      daysRemaining,
      periodLabel: `every ${everyN} day(s)`,
      queryStart: windowStart,
      queryEndExclusive: asOfEnd < windowEnd ? asOfEnd : windowEnd,
    };
  }

  const ms = asOfDay.getTime() - cycleAnchor.getTime();
  const dayIndex = Math.floor(ms / 86_400_000);
  let k = Math.floor(dayIndex / everyN);
  let windowStart = addUtcDays(cycleAnchor, k * everyN);
  if (windowStart > asOfDay) {
    k -= 1;
    windowStart = addUtcDays(cycleAnchor, k * everyN);
  }
  const windowEnd = addUtcDays(windowStart, everyN);
  const daysRemaining = daysRemainingUntil(asOfDay, windowEnd);
  return {
    resets: true,
    windowStart,
    windowEnd,
    windowStartYmd: formatUtcYmd(windowStart),
    windowEndYmd: formatUtcYmd(windowEnd),
    resetAtYmd: formatUtcYmd(windowEnd),
    asOfYmd,
    timeLeftLabel: String(daysRemaining),
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

/**
 * Convert byte allotment into the meter display unit (GB / MB / bytes).
 * @param {number} bytes
 * @param {string} unit
 */
export function bytesToQuotaUnit(bytes, unit) {
  const n = Math.max(0, Number(bytes) || 0);
  const u = String(unit || "").toLowerCase();
  if (/\btb\b|tib/.test(u)) return Math.round((n / (1024 ** 4)) * 1e4) / 1e4;
  if (/\bgb\b|gib/.test(u)) return Math.round((n / (1024 ** 3)) * 1e4) / 1e4;
  if (/\bmb\b|mib/.test(u)) return Math.round((n / (1024 ** 2)) * 1e4) / 1e4;
  if (/\bkb\b|kib/.test(u)) return Math.round((n / 1024) * 1e4) / 1e4;
  return Math.round(n);
}

/**
 * Which Supabase project pool a meter tracks.
 * 100 GB-class → bucket; 8 GB-class → Postgres. Name/notes can override.
 * @param {{ productName?: string, notes?: string, provider?: string, included?: number, unit?: string }} meter
 * @returns {"bucket"|"postgres"}
 */
export function resolveSupabaseStorageMeterKind(meter) {
  const label = `${meter?.productName || ""} ${meter?.notes || ""} ${meter?.provider || ""}`.toLowerCase();
  if (/\bpostgres\b|\bpostgr\b|\bdatabase\b|\bdb\b/.test(label)) return "postgres";
  if (/\bbucket\b|\bfiles\b|\bdoc-images\b|\bstorage\b/.test(label)) return "bucket";
  const included = Number(meter?.included) || 0;
  const unit = String(meter?.unit || "").toLowerCase();
  let gb = included;
  if (/\btb\b|tib/.test(unit)) gb = included * 1024;
  else if (/\bmb\b|mib/.test(unit)) gb = included / 1024;
  else if (/\bkb\b|kib/.test(unit)) gb = included / (1024 * 1024);
  else if (!/\bgb\b|gib/.test(unit) && included > 1024) gb = included / (1024 ** 3);
  return gb >= 20 ? "bucket" : "postgres";
}
