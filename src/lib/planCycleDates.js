/**
 * User plan cycle dates for Management Users:
 * Date (free) = signup, Date (Pro) = first upgrade, Next Date = monthly anniversary.
 * Pro owns the reset day when the account is currently Pro.
 */

/**
 * @param {unknown} raw
 * @returns {Date|null}
 */
export function parseInstant(raw) {
  if (!raw) return null;
  const d = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} date
 * @returns {Date}
 */
export function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * @param {Date} date
 * @returns {string}
 */
export function formatUtcYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param {string|Date|null|undefined} iso
 * @returns {string|null}
 */
export function formatUtcYmdFromIso(iso) {
  const d = parseInstant(iso);
  return d ? formatUtcYmd(startOfUtcDay(d)) : null;
}

/**
 * Add months in UTC, clamping 31 → last day of shorter months (Jan 31 → Feb 28).
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
export function addUtcMonthsClamped(date, months) {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + Number(months);
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const day = date.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

/**
 * Next monthly data reset after the cycle start (UTC, same day-of-month).
 * First reset is +1 month from the anchor (signup or Pro upgrade), then every month.
 * If today is a later anniversary, returns today.
 * @param {string|Date} anchorIso
 * @param {Date|string} [asOf]
 * @returns {Date|null}
 */
export function nextMonthlyAnniversaryUtc(anchorIso, asOf = new Date()) {
  const anchor = parseInstant(anchorIso);
  const asOfDate = parseInstant(asOf);
  if (!anchor || !asOfDate) return null;
  const asOfDay = startOfUtcDay(asOfDate);
  const start = startOfUtcDay(anchor);
  let candidate = addUtcMonthsClamped(start, 1);
  for (let i = 0; i < 240 && candidate < asOfDay; i += 1) {
    candidate = addUtcMonthsClamped(candidate, 1);
  }
  return candidate;
}

/**
 * Whole UTC calendar days from → to (can be negative).
 * @param {string|Date} fromIso
 * @param {string|Date} toIso
 * @returns {number|null}
 */
export function utcCalendarDaysBetween(fromIso, toIso) {
  const a = parseInstant(fromIso);
  const b = parseInstant(toIso);
  if (!a || !b) return null;
  const start = startOfUtcDay(a);
  const end = startOfUtcDay(b);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * @param {{
 *   plan?: string,
 *   freeStartedAt?: string|Date|null,
 *   proStartedAt?: string|Date|null,
 *   asOf?: Date|string,
 * }} input
 */
export function resolveUserPlanDates({
  plan,
  freeStartedAt = null,
  proStartedAt = null,
  asOf = new Date(),
} = {}) {
  const freeAt = parseInstant(freeStartedAt);
  const proAt = parseInstant(proStartedAt);
  const isPro = plan === "pro";
  const anchor = isPro ? (proAt || freeAt) : freeAt;
  const nextAt = anchor ? nextMonthlyAnniversaryUtc(anchor, asOf) : null;
  const daysToPro = freeAt && proAt
    ? utcCalendarDaysBetween(freeAt, proAt)
    : null;

  return {
    freeYmd: freeAt ? formatUtcYmd(startOfUtcDay(freeAt)) : null,
    proYmd: proAt ? formatUtcYmd(startOfUtcDay(proAt)) : null,
    nextYmd: nextAt ? formatUtcYmd(nextAt) : null,
    daysToPro: daysToPro != null && Number.isFinite(daysToPro) ? daysToPro : null,
    anchorKind: !anchor ? null : (isPro && proAt ? "pro" : "free"),
  };
}
