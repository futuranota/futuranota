import {
  computeLaunchCadenceProjection,
  formatReferenceMonthLabelEn,
} from "./launchCadenceMath.js";

/**
 * Overview for cadence-only hits (no active announcement detected).
 * @param {Object} params
 * @param {string} params.brandName
 * @param {number} params.averageIntervalMonths
 * @param {string} params.lastLaunchDate
 * @param {Date} [params.today]
 */
export function buildCadenceOnlyOverview({
  brandName,
  averageIntervalMonths,
  lastLaunchDate,
  today = new Date(),
}) {
  const projection = computeLaunchCadenceProjection({
    today,
    averageIntervalMonths,
    lastLaunchDate,
  });

  const intervalLabel = Number.isInteger(averageIntervalMonths)
    ? averageIntervalMonths
    : averageIntervalMonths.toFixed(1);

  return (
    `No se detectó anuncio activo para ${brandName}. `
    + `Análisis de cadencia histórica (${formatReferenceMonthLabelEn(today)}): `
    + `último lanzamiento ${lastLaunchDate}, ciclo promedio cada ${intervalLabel} meses. `
    + `Estimación: ${projection.estimatedMonthLabel} (~${projection.monthsRemaining} meses). `
    + `Sin evidencia de campaña confirmada en fuentes web.`
  );
}

/** @deprecated Do not use for Horizon Scan — overwrites real extracted overviews. */
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

  return buildCadenceOnlyOverview({
    brandName,
    averageIntervalMonths,
    lastLaunchDate,
    today,
  });
}
