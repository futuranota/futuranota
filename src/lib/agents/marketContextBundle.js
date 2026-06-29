/**
 * Market context extracted from Analyst + detection — passed to Marketing Guide.
 * Orchestrator / pipeline uses this bundle; Marketing Guide works with or without it.
 */

/**
 * @typedef {Object} MarketAnalysis
 * @property {string} [customerLocations]
 * @property {string} [salesMetrics]
 * @property {string} [priorYearInterestPeak]
 * @property {string[]} [topInterestRegions]
 * @property {string} [evidenceSummary]
 */

/**
 * @typedef {Object} MarketContextBundle
 * @property {string} brandName
 * @property {string} customerMarkets
 * @property {string} marketContext
 * @property {MarketAnalysis} marketAnalysis
 * @property {object|null} marketInterest
 * @property {boolean} hasVerifiedData
 */

/**
 * @param {unknown} raw
 * @returns {MarketAnalysis}
 */
export function normalizeMarketAnalysis(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      customerLocations: "",
      salesMetrics: "",
      priorYearInterestPeak: "",
      topInterestRegions: [],
      evidenceSummary: "",
    };
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const regions = Array.isArray(obj.topInterestRegions)
    ? obj.topInterestRegions.filter((r) => typeof r === "string" && r.trim()).map((r) => r.trim())
    : [];
  return {
    customerLocations: typeof obj.customerLocations === "string" ? obj.customerLocations.trim() : "",
    salesMetrics: typeof obj.salesMetrics === "string" ? obj.salesMetrics.trim() : "",
    priorYearInterestPeak: typeof obj.priorYearInterestPeak === "string" ? obj.priorYearInterestPeak.trim() : "",
    topInterestRegions: regions,
    evidenceSummary: typeof obj.evidenceSummary === "string" ? obj.evidenceSummary.trim() : "",
  };
}

/**
 * @param {object} [analystReport]
 * @param {object} [detection]
 * @param {string} [brandName]
 * @returns {MarketContextBundle}
 */
export function buildMarketContextBundle(analystReport = {}, detection = {}, brandName = "") {
  const marketAnalysis = normalizeMarketAnalysis(analystReport?.marketAnalysis);
  const customerMarkets = (analystReport?.customerMarkets || "").trim();
  const marketContext = (analystReport?.marketContext || "").trim();
  const marketInterest = detection?.marketInterest && typeof detection.marketInterest === "object"
    ? detection.marketInterest
    : null;

  const hasVerifiedData = Boolean(
    customerMarkets
    || marketContext
    || marketAnalysis.customerLocations
    || marketAnalysis.salesMetrics
    || marketAnalysis.priorYearInterestPeak
    || marketAnalysis.evidenceSummary
    || (marketAnalysis.topInterestRegions?.length > 0)
    || (marketInterest?.source === "dataforseo" && (
      marketInterest.interestChangePercent != null
      || (marketInterest.topRegions?.length > 0)
    )),
  );

  return {
    brandName: (brandName || "").trim(),
    customerMarkets,
    marketContext,
    marketAnalysis,
    marketInterest,
    hasVerifiedData,
  };
}

/**
 * Primary region label for Marketing Guide contextual hook.
 * @param {MarketContextBundle} bundle
 */
export function pickPrimaryInterestRegion(bundle) {
  const fromAnalysis = bundle.marketAnalysis?.topInterestRegions?.[0];
  if (fromAnalysis) return fromAnalysis;

  const fromTrends = bundle.marketInterest?.topRegions?.[0];
  if (fromTrends) return fromTrends;

  const loc = bundle.marketAnalysis?.customerLocations || bundle.customerMarkets || "";
  const match = loc.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Za-z ]+)/);
  return match ? match[1].trim() : "";
}
