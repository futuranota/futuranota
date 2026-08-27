/** Default category when a row uses affiliate tracking. */
export const AFFILIATE_CATEGORY = "affiliado";

/** @typedef {'pending' | 'active' | 'expired'} AffiliateStatus */

export const AFFILIATE_STATUSES = /** @type {const} */ (["pending", "active", "expired"]);

export const AFFILIATE_CURRENCY_PRESETS = /** @type {const} */ ([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "MXN",
  "BRL",
  "INR",
  "CNY",
  "KRW",
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toNonNegNumber(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * @param {unknown} value
 * @returns {AffiliateStatus|''}
 */
export function normalizeAffiliateStatus(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "pending" || raw === "active" || raw === "expired") return raw;
  return "";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAffiliateCurrency(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return raw || "USD";
}

/**
 * @param {string|null|undefined} activatedAt
 * @returns {string}
 */
export function toAffiliateDateInputValue(activatedAt) {
  if (!activatedAt) return "";
  const date = new Date(activatedAt);
  if (!Number.isFinite(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} value YYYY-MM-DD
 * @returns {string|null}
 */
export function fromAffiliateDateInputValue(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * Affiliate / cookie tracking fields on a URL table row.
 * @param {Record<string, unknown>} [patch]
 */
export function createAffiliateFields(patch = {}) {
  const commissionRate = toNonNegNumber(patch.commissionRate);
  const productPrice = toNonNegNumber(patch.productPrice);
  const cookieDaysRaw = toNonNegNumber(patch.cookieDays);
  const cookieDays = cookieDaysRaw == null ? null : Math.floor(cookieDaysRaw);
  const clientsRaw = toNonNegNumber(patch.clientsWon);
  const clientsWon = clientsRaw == null ? 0 : Math.floor(clientsRaw);
  const affiliateStatus = normalizeAffiliateStatus(patch.affiliateStatus);
  const activatedAt = patch.activatedAt
    ? String(patch.activatedAt)
    : null;
  const currency = normalizeAffiliateCurrency(patch.currency);

  return {
    commissionRate,
    productPrice,
    cookieDays,
    affiliateStatus,
    activatedAt,
    currency,
    clientsWon,
  };
}

/**
 * Calendar-day distance from activatedAt to now (floor).
 * @param {string|null|undefined} activatedAt
 * @param {Date} [now]
 */
export function daysElapsedSince(activatedAt, now = new Date()) {
  if (!activatedAt) return null;
  const start = new Date(activatedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const elapsed = Math.floor((now.getTime() - start) / MS_PER_DAY);
  return Math.max(0, elapsed);
}

/**
 * Days left on the cookie window. Null if not countable yet.
 * @param {{ cookieDays?: number|null, activatedAt?: string|null, affiliateStatus?: string }} entry
 * @param {Date} [now]
 */
export function cookieDaysRemaining(entry, now = new Date()) {
  const total = toNonNegNumber(entry?.cookieDays);
  if (total == null) return null;
  const status = normalizeAffiliateStatus(entry?.affiliateStatus);
  if (status !== "active" && status !== "expired") return null;
  const elapsed = daysElapsedSince(entry?.activatedAt, now);
  if (elapsed == null) return null;
  return Math.max(0, Math.floor(total) - elapsed);
}

/**
 * Resolve status + days from stored fields (auto-expire when countdown hits 0).
 * @param {Record<string, unknown>} entry
 * @param {Date} [now]
 * @returns {{
 *   affiliateStatus: AffiliateStatus|'',
 *   daysRemaining: number|null,
 *   activatedAt: string|null,
 *   didExpire: boolean,
 * }}
 */
export function resolveAffiliateLifecycle(entry, now = new Date()) {
  const fields = createAffiliateFields(entry || {});
  let status = fields.affiliateStatus;
  let activatedAt = fields.activatedAt;
  let didExpire = false;

  if (status === "active") {
    const remaining = cookieDaysRemaining(
      { ...fields, affiliateStatus: "active", activatedAt },
      now,
    );
    if (remaining != null && remaining <= 0) {
      status = "expired";
      didExpire = true;
    }
    return {
      affiliateStatus: status,
      daysRemaining: remaining,
      activatedAt,
      didExpire,
    };
  }

  if (status === "expired") {
    return {
      affiliateStatus: "expired",
      daysRemaining: 0,
      activatedAt,
      didExpire: false,
    };
  }

  if (status === "pending") {
    return {
      affiliateStatus: "pending",
      daysRemaining: fields.cookieDays,
      activatedAt: null,
      didExpire: false,
    };
  }

  return {
    affiliateStatus: "",
    daysRemaining: null,
    activatedAt: null,
    didExpire: false,
  };
}

/**
 * Apply a user status change. pending → active starts the cookie clock.
 * @param {Record<string, unknown>} entry
 * @param {AffiliateStatus|''} nextStatus
 * @param {Date} [now]
 */
export function applyAffiliateStatusChange(entry, nextStatus, now = new Date()) {
  const current = createAffiliateFields(entry || {});
  const next = normalizeAffiliateStatus(nextStatus);
  const iso = now.toISOString();

  if (!next) {
    return {
      ...current,
      affiliateStatus: "",
      activatedAt: null,
    };
  }

  if (next === "pending") {
    return {
      ...current,
      affiliateStatus: "pending",
      activatedAt: null,
    };
  }

  if (next === "active") {
    const wasActive = current.affiliateStatus === "active" && current.activatedAt;
    const planned = entry?.activatedAt ? String(entry.activatedAt) : null;
    return {
      ...current,
      affiliateStatus: "active",
      activatedAt: wasActive ? current.activatedAt : (planned || iso),
    };
  }

  // expired
  return {
    ...current,
    affiliateStatus: "expired",
    activatedAt: current.activatedAt || iso,
  };
}

/**
 * Earnings = clientsWon × productPrice × (commissionRate / 100).
 * @param {{ clientsWon?: number|null, productPrice?: number|null, commissionRate?: number|null }} entry
 */
export function computeAffiliateEarnings(entry) {
  const clients = toNonNegNumber(entry?.clientsWon) ?? 0;
  const price = toNonNegNumber(entry?.productPrice) ?? 0;
  const rate = toNonNegNumber(entry?.commissionRate) ?? 0;
  return clients * price * (rate / 100);
}

/**
 * Per-sale commission cut (before multiplying by clients).
 * @param {{ productPrice?: number|null, commissionRate?: number|null }} entry
 */
export function computeAffiliatePerSale(entry) {
  const price = toNonNegNumber(entry?.productPrice) ?? 0;
  const rate = toNonNegNumber(entry?.commissionRate) ?? 0;
  return price * (rate / 100);
}

/**
 * Merge resolved lifecycle onto an entry (persists auto-expire).
 * @param {Record<string, unknown>} entry
 * @param {Date} [now]
 */
export function withResolvedAffiliateLifecycle(entry, now = new Date()) {
  const resolved = resolveAffiliateLifecycle(entry, now);
  if (!resolved.didExpire) return entry;
  return {
    ...entry,
    affiliateStatus: "expired",
    activatedAt: resolved.activatedAt,
  };
}

/**
 * @param {number|null|undefined} value
 * @param {Intl.NumberFormatOptions & { currency?: string }} [options]
 */
export function formatAffiliateMoney(value, options = {}) {
  const n = toNonNegNumber(value) ?? 0;
  const { currency: currencyOpt, ...rest } = options;
  const code = normalizeAffiliateCurrency(currencyOpt);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      ...rest,
    }).format(n);
  } catch {
    const digits = rest.maximumFractionDigits ?? 2;
    return `${code} ${n.toFixed(digits)}`;
  }
}

/**
 * True when the row has any affiliate tracking data filled in.
 * @param {Record<string, unknown>|null|undefined} entry
 */
export function hasAffiliateData(entry) {
  if (!entry) return false;
  const fields = createAffiliateFields(entry);
  return Boolean(
    fields.affiliateStatus
    || fields.commissionRate != null
    || fields.productPrice != null
    || fields.cookieDays != null
    || fields.clientsWon > 0
  );
}

/**
 * Compact gray meta for the affiliates grid Status cell.
 * @param {Record<string, unknown>} entry
 * @param {Date} [now]
 * @returns {{
 *   affiliateStatus: AffiliateStatus|'',
 *   daysRemaining: number|null,
 *   parts: string[],
 * }}
 */
export function formatAffiliateRowMeta(entry, now = new Date()) {
  const fields = createAffiliateFields(entry || {});
  const resolved = resolveAffiliateLifecycle({ ...entry, ...fields }, now);
  const parts = [];

  if (fields.commissionRate != null) {
    parts.push(`${trimNumber(fields.commissionRate)}%`);
  }
  if (fields.productPrice != null) {
    parts.push(formatAffiliateMoney(fields.productPrice, {
      currency: fields.currency,
      maximumFractionDigits: fields.productPrice % 1 === 0 ? 0 : 2,
    }));
  }

  if (resolved.affiliateStatus === "active" && resolved.daysRemaining != null) {
    parts.push(`${resolved.daysRemaining}d`);
  } else if (resolved.affiliateStatus === "expired") {
    parts.push("0d");
  } else if (fields.cookieDays != null) {
    parts.push(`${fields.cookieDays}d`);
  }

  if (fields.clientsWon > 0) {
    parts.push(`${fields.clientsWon}`);
  }

  return {
    affiliateStatus: resolved.affiliateStatus || fields.affiliateStatus || "",
    daysRemaining: resolved.daysRemaining,
    parts,
  };
}

/** @param {number} n */
function trimNumber(n) {
  return Number.isInteger(n) ? String(n) : String(n);
}
