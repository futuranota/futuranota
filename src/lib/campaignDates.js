import { isoFromAnchorFields } from "./nodeAnchor.js";
import { isoFromDateInput } from "./docDates.js";

/**
 * Campaign Activate At / Target Launch ordering.
 * Either date may be empty (draft allowed). When both exist, activate must be <= launch.
 *
 * @param {string} activateDate YYYY-MM-DD
 * @param {string} activateTime HH:mm
 * @param {string} launchDate YYYY-MM-DD
 * @param {string} launchTime HH:mm
 * @returns {{ ok: true } | { ok: false, code: "invalid" | "activateAfterLaunch" }}
 */
export function validateCampaignDatetimes(
  activateDate = "",
  activateTime = "",
  launchDate = "",
  launchTime = "",
) {
  const aDate = String(activateDate || "").trim();
  const lDate = String(launchDate || "").trim();
  if (!aDate && !lDate) return { ok: true };

  const activateAt = aDate ? isoFromAnchorFields(aDate, activateTime) : null;
  const launchAt = lDate ? isoFromAnchorFields(lDate, launchTime) : null;

  if (aDate && !activateAt) return { ok: false, code: "invalid" };
  if (lDate && !launchAt) return { ok: false, code: "invalid" };
  if (activateAt && launchAt && new Date(activateAt).getTime() > new Date(launchAt).getTime()) {
    return { ok: false, code: "activateAfterLaunch" };
  }
  return { ok: true };
}

/**
 * @param {string|null|undefined} activateAt
 * @param {string|null|undefined} launchAt
 */
export function validateCampaignIsoOrder(activateAt, launchAt) {
  if (!activateAt || !launchAt) return { ok: true };
  const a = new Date(activateAt).getTime();
  const l = new Date(launchAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(l)) return { ok: false, code: "invalid" };
  if (a > l) return { ok: false, code: "activateAfterLaunch" };
  return { ok: true };
}

/**
 * Persist Date start + Launch + product category on a campaign child document.
 * Empty dates are allowed. Does not copy Created or launch into Date start.
 *
 * @param {{
 *   announceDate?: string,
 *   launchDate?: string,
 *   launchTime?: string,
 *   subcategory?: string,
 * }} fields
 * @returns {{
 *   ok: true,
 *   windowStartAt: string|null,
 *   launchAt: string|null,
 *   windowEndAt: string|null,
 *   subcategory: string,
 * } | { ok: false, code: "invalid" | "activateAfterLaunch" }}
 */
export function buildCampaignChildScheduleFields({
  announceDate = "",
  launchDate = "",
  launchTime = "",
  subcategory = "",
} = {}) {
  const start = String(announceDate || "").trim();
  const launch = String(launchDate || "").trim();
  const time = String(launchTime || "").trim();
  const check = validateCampaignDatetimes(start, "", launch, time);
  if (!check.ok) return check;
  const launchAt = launch ? isoFromAnchorFields(launch, time) : null;
  return {
    ok: true,
    windowStartAt: start ? isoFromDateInput(start) : null,
    launchAt,
    windowEndAt: launchAt,
    subcategory: String(subcategory || "").trim(),
  };
}
