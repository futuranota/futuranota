import {
  computeLaunchCadenceProjection,
  formatReferenceMonthLabelEn,
} from "./launchCadenceMath.js";

/**
 * Builds the same Today → months left → Est. launch narrative shown in
 * Launch Radar (LaunchPredictor.jsx), so the Signal overview reads identically.
 * @param {Object} params
 * @param {string} params.brandName
 * @param {boolean} params.campaignActive
 * @param {number} params.averageIntervalMonths
 * @param {string} params.lastLaunchDate ISO YYYY-MM-DD
 * @param {Date} [params.today]
 */
export function buildCampaignOverview({
  brandName,
  campaignActive,
  averageIntervalMonths,
  lastLaunchDate,
  today = new Date(),
}) {
  if (!averageIntervalMonths || !lastLaunchDate) {
    return campaignActive
      ? `${brandName} tiene una campaña activa detectada.`
      : `${brandName} no muestra señales de campaña activa por ahora.`;
  }

  const projection = computeLaunchCadenceProjection({
    today,
    averageIntervalMonths,
    lastLaunchDate,
  });

  const intervalLabel = Number.isInteger(averageIntervalMonths)
    ? averageIntervalMonths
    : averageIntervalMonths.toFixed(1);

  const status = campaignActive
    ? `${brandName} tiene una campaña de lanzamiento activa ahora.`
    : `${brandName} no tiene una campaña activa detectada en este momento.`;

  return (
    `${status} `
    + `Today ${formatReferenceMonthLabelEn(today)}. `
    + `${projection.monthsRemaining} month${projection.monthsRemaining === 1 ? "" : "s"} left. `
    + `Est. launch ${projection.estimatedMonthLabel}. `
    + `This company typically launches products every ${intervalLabel} months. `
    + "They will likely launch their next product within the next "
    + `${projection.monthsRemaining} month${projection.monthsRemaining === 1 ? "" : "s"}. `
    + "Announcements usually begin about three months before."
  );
}
