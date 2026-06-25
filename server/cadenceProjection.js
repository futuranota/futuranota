import {
  computeLaunchCadenceProjection,
  formatReferenceMonthLabelEn,
  toIsoDateString,
} from "../src/lib/launchCadenceMath.js";

/** Months remaining at or below this → "watch" (mantener pendiente). */
export const DEFAULT_CADENCE_WATCH_MONTHS = 4;

/**
 * @param {Object} projection from computeLaunchCadenceProjection
 * @param {number} [rangeDays]
 * @returns {{ cadenceStatus: "watch"|"discard" }}
 */
export function classifyCadenceWindow(projection, rangeDays = 90) {
  const watchMonths = Math.max(
    DEFAULT_CADENCE_WATCH_MONTHS,
    Math.ceil(rangeDays / 30),
  );
  const { monthsRemaining, monthsSinceLast } = projection;

  if (monthsRemaining <= 0 && monthsSinceLast > 0) {
    return { cadenceStatus: "watch" };
  }

  if (monthsRemaining <= watchMonths) {
    return { cadenceStatus: "watch" };
  }

  return { cadenceStatus: "discard" };
}

/**
 * @param {Object} params
 * @param {string} params.brandName
 * @param {ReturnType<typeof computeLaunchCadenceProjection>} params.projection
 * @param {"watch"|"discard"} params.cadenceStatus
 * @param {Date} [params.today]
 */
export function buildCadenceStatusMessage({
  brandName,
  projection,
  cadenceStatus,
  today = new Date(),
}) {
  const ref = formatReferenceMonthLabelEn(today);
  const { monthsRemaining, estimatedMonthLabel, monthsSinceLast } = projection;

  if (monthsRemaining <= 0 && monthsSinceLast > 0) {
    return (
      `Sin campaña activa para ${brandName} (${ref}). `
      + `El ciclo estimado ya venció — revisar manualmente o re-escanear pronto.`
    );
  }

  if (cadenceStatus === "watch") {
    const mo = monthsRemaining === 1 ? "1 mes" : `~${monthsRemaining} meses`;
    return (
      `Sin campaña activa para ${brandName} (${ref}). `
      + `Cadencia histórica: estimación ${estimatedMonthLabel} (${mo} restantes). `
      + `Mantener pendiente.`
    );
  }

  const mo = monthsRemaining === 1 ? "1 mes" : `~${monthsRemaining} meses`;
  return (
    `Sin campaña activa para ${brandName} (${ref}). `
    + `Próximo ciclo estimado: ${estimatedMonthLabel} (${mo}). `
    + `Ventana larga — podés descartar por ahora.`
  );
}

/**
 * Adds deterministic cadence projection fields to a cadence_only hit.
 * @param {Object} hit
 * @param {string} todayIso YYYY-MM-DD
 * @param {number} rangeDays
 */
export function enrichCadenceHit(hit, todayIso, rangeDays) {
  const today = new Date(`${todayIso}T12:00:00`);
  const projection = computeLaunchCadenceProjection({
    today,
    averageIntervalMonths: hit.averageIntervalMonths,
    lastLaunchDate: hit.lastLaunchDate,
  });
  const { cadenceStatus } = classifyCadenceWindow(projection, rangeDays);
  const cadenceMessage = buildCadenceStatusMessage({
    brandName: hit.brandName,
    projection,
    cadenceStatus,
    today,
  });

  return {
    ...hit,
    monthsRemaining: projection.monthsRemaining,
    estimatedLaunchDate: toIsoDateString(projection.estimatedLaunchDate),
    cadenceStatus,
    cadenceMessage,
    overview: hit.overview?.trim() || cadenceMessage,
  };
}
