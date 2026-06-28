import {
  computeLaunchCadenceProjection,
  formatReferenceMonthLabelEn,
  monthsBetween,
  parseIsoDate,
  toIsoDateString,
  addMonths,
  startOfCalendarMonth,
} from "./launchCadenceMath.js";

/** Fallback interval when no average can be inferred from signals or report. */
export const DEFAULT_HEURISTIC_INTERVAL_MONTHS = 12;

/**
 * Past launch dates from signal dateHints (YYYY-MM-DD), sorted ascending.
 * @param {Array<{ dateHint?: string|null }>} signals
 * @param {string} todayIso
 */
export function collectPastLaunchDates(signals, todayIso) {
  if (!todayIso || !Array.isArray(signals)) return [];

  const unique = new Set();
  for (const sig of signals) {
    const iso = typeof sig?.dateHint === "string" ? sig.dateHint.trim() : "";
    if (!iso || iso > todayIso) continue;
    if (parseIsoDate(iso)) unique.add(iso);
  }

  return [...unique].sort();
}

/**
 * Average months between consecutive past launch dates.
 * @param {string[]} sortedIsos ascending ISO dates
 */
export function inferAverageIntervalMonthsFromDates(sortedIsos) {
  if (!Array.isArray(sortedIsos) || sortedIsos.length < 2) return null;

  const gaps = [];
  for (let i = 1; i < sortedIsos.length; i += 1) {
    const a = new Date(`${sortedIsos[i - 1]}T12:00:00`);
    const b = new Date(`${sortedIsos[i]}T12:00:00`);
    const gap = monthsBetween(a, b);
    if (gap > 0 && gap <= 60) gaps.push(gap);
  }

  if (!gaps.length) return null;
  const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return Math.round(avg * 10) / 10;
}

/**
 * When no past launch is known, assume mid-cycle using the average interval.
 * @param {string} todayIso
 * @param {number} averageIntervalMonths
 */
export function synthesizeLastLaunchDate(todayIso, averageIntervalMonths) {
  const today = new Date(`${todayIso}T12:00:00`);
  const monthsSince = Math.max(1, Math.floor(averageIntervalMonths / 2));
  return toIsoDateString(startOfCalendarMonth(addMonths(today, -monthsSince)));
}

/**
 * @param {number|null|undefined} value
 */
function normalizeIntervalMonths(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 60) return null;
  return Math.round(n * 10) / 10;
}

/**
 * @param {"report"|"signals"|"default"|"synthetic"} source
 * @param {'en'|'es'} lang
 */
export function formatHeuristicIntervalSource(source, lang) {
  if (source === "report") {
    return lang === "es" ? "intervalo promedio del informe" : "average interval from the report";
  }
  if (source === "signals") {
    return lang === "es" ? "patrón inferido de lanzamientos previos" : "pattern inferred from past launches";
  }
  if (source === "synthetic") {
    return lang === "es" ? "intervalo promedio estimado (sin fecha histórica)" : "estimated average interval (no historical date)";
  }
  return lang === "es" ? "ciclo estándar de 12 meses" : "standard 12-month cycle";
}

/**
 * @param {Object} params
 * @param {string} params.brandName
 * @param {string} params.todayIso YYYY-MM-DD
 * @param {number} [params.rangeDays]
 * @param {object} [params.report]
 * @param {Array<{ dateHint?: string|null }>} [params.allLaunchSignals]
 * @param {'en'|'es'} [params.lang]
 */
export function buildHeuristicCadenceFromDetection({
  brandName,
  todayIso,
  rangeDays = 90,
  report = {},
  allLaunchSignals = [],
  lang = "es",
}) {
  const name = (brandName || report.brandName || "").trim();
  if (!name || !todayIso) return null;

  const pastDates = collectPastLaunchDates(allLaunchSignals, todayIso);
  const lastFromSignals = pastDates.length ? pastDates[pastDates.length - 1] : null;

  let intervalSource = "default";
  let averageIntervalMonths = normalizeIntervalMonths(report.averageIntervalMonths);
  if (averageIntervalMonths != null) {
    intervalSource = "report";
  } else {
    averageIntervalMonths = inferAverageIntervalMonthsFromDates(pastDates);
    if (averageIntervalMonths != null) {
      intervalSource = "signals";
    } else {
      averageIntervalMonths = DEFAULT_HEURISTIC_INTERVAL_MONTHS;
    }
  }

  let lastLaunchDate = parseIsoDate(report.lastLaunchDate)
    ? String(report.lastLaunchDate).trim()
    : lastFromSignals;
  let lastLaunchSynthetic = false;

  if (!lastLaunchDate) {
    lastLaunchDate = synthesizeLastLaunchDate(todayIso, averageIntervalMonths);
    lastLaunchSynthetic = true;
    if (intervalSource === "default") {
      intervalSource = "synthetic";
    }
  }

  const today = new Date(`${todayIso}T12:00:00`);
  const projection = computeLaunchCadenceProjection({
    today,
    averageIntervalMonths,
    lastLaunchDate,
  });

  const ref = formatReferenceMonthLabelEn(today);
  const mo = projection.monthsRemaining === 1
    ? (lang === "es" ? "1 mes" : "1 month")
    : (lang === "es" ? `~${projection.monthsRemaining} meses` : `~${projection.monthsRemaining} months`);
  const intervalLabel = Number.isInteger(averageIntervalMonths)
    ? averageIntervalMonths
    : averageIntervalMonths.toFixed(1);
  const sourceLabel = formatHeuristicIntervalSource(intervalSource, lang);

  const cadenceMessage = lang === "es"
    ? (
      `Sin campaña confirmada para ${name} (${ref}). `
      + `Estimación por ${sourceLabel}: último lanzamiento ${lastLaunchDate}, ciclo cada ${intervalLabel} meses. `
      + `Posible próximo lanzamiento ${projection.estimatedMonthLabel} (${mo} restantes). `
      + `Mantener pendiente durante esta ventana.`
    )
    : (
      `No confirmed campaign for ${name} (${ref}). `
      + `Estimate from ${sourceLabel}: last launch ${lastLaunchDate}, cycle every ${intervalLabel} months. `
      + `Possible next launch ${projection.estimatedMonthLabel} (${mo} remaining). `
      + `Stay pending during this window.`
    );

  return {
    detectionMode: "heuristic_estimate",
    campaignActive: false,
    launchDate: null,
    announcementDate: null,
    lastLaunchDate,
    averageIntervalMonths,
    monthsRemaining: projection.monthsRemaining,
    estimatedLaunchDate: toIsoDateString(projection.estimatedLaunchDate),
    cadenceStatus: "watch",
    cadenceMessage,
    overview: cadenceMessage,
    category: report.category || null,
    launchConfidence: "speculative",
    heuristicIntervalSource: intervalSource,
    lastLaunchSynthetic,
    confidence: null,
    evidenceUrl: report.evidenceUrl || null,
  };
}

/**
 * Maps a soft Pass B hit (unverified web cadence) into heuristic_estimate shape.
 * @param {object} softHit enriched cadence hit from Pass B
 * @param {string} todayIso
 * @param {'en'|'es'} [lang]
 */
export function mapSoftCadenceToHeuristic(softHit, todayIso, lang = "es") {
  if (!softHit?.lastLaunchDate || softHit.averageIntervalMonths == null) return null;

  return buildHeuristicCadenceFromDetection({
    brandName: softHit.brandName,
    todayIso,
    report: {
      brandName: softHit.brandName,
      lastLaunchDate: softHit.lastLaunchDate,
      averageIntervalMonths: softHit.averageIntervalMonths,
      category: softHit.category,
      evidenceUrl: softHit.evidenceUrl,
    },
    allLaunchSignals: [],
    lang,
  });
}
