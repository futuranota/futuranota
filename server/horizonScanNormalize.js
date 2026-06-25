import { isWithinFourMonthWindow } from "../src/lib/campaignWindow.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} hit
 * @returns {object|null}
 */
export function normalizeHorizonHit(hit) {
  const brandName = typeof hit?.brandName === "string" ? hit.brandName.trim() : "";
  if (!brandName) return null;

  const avg = Number(hit?.averageIntervalMonths);
  const last = typeof hit?.lastLaunchDate === "string" ? hit.lastLaunchDate.trim() : "";
  if (!Number.isFinite(avg) || avg <= 0 || avg > 60) return null;
  if (!ISO_DATE.test(last) || Number.isNaN(new Date(`${last}T12:00:00`).getTime())) return null;

  const campaignActive = Boolean(hit?.campaignActive);
  let launchDate = null;
  if (campaignActive) {
    const candidate = typeof hit?.launchDate === "string" ? hit.launchDate.trim() : "";
    if (!ISO_DATE.test(candidate) || Number.isNaN(new Date(`${candidate}T12:00:00`).getTime())) return null;
    launchDate = candidate;
  }

  return {
    brandName,
    category: typeof hit?.category === "string" ? hit.category.trim() : "",
    campaignActive,
    launchDate,
    overview: typeof hit?.overview === "string" ? hit.overview.trim() : "",
    averageIntervalMonths: Math.round(avg * 10) / 10,
    lastLaunchDate: last,
  };
}

/**
 * Drops hits whose dates fall outside the scan window logic (Groq hallucinations).
 * @param {ReturnType<typeof normalizeHorizonHit>} hit
 * @param {number} rangeDays
 * @param {Date} [today]
 */
export function isHorizonHitInRange(hit, rangeDays, today = new Date()) {
  if (!hit) return false;
  return isWithinFourMonthWindow(
    {
      launchDate: hit.launchDate,
      lastLaunchDate: hit.lastLaunchDate,
      averageIntervalMonths: hit.averageIntervalMonths,
    },
    rangeDays,
    today,
  );
}

/**
 * @param {unknown[]} rawList
 * @param {number} rangeDays
 * @param {number} maxResults
 */
export function normalizeHorizonResults(rawList, rangeDays, maxResults = 8) {
  const today = new Date();
  return rawList
    .map(normalizeHorizonHit)
    .filter((hit) => hit && isHorizonHitInRange(hit, rangeDays, today))
    .slice(0, maxResults);
}
