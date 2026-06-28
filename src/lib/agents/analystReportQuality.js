/**
 * @param {string} value
 */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * True when the report has enough prose + citations to charge the user a credit.
 * @param {object} report
 * @param {object} detection
 */
export function isDeliverableAnalystReport(report, detection) {
  const citations = Array.isArray(detection?.citations) ? detection.citations.length : 0;
  if (citations < 1) return false;

  const prose = [
    report?.openingBrief,
    report?.whatsNew,
    report?.whatsComing,
    report?.launchCadence,
  ].map((s) => asString(s)).join(" ").trim();

  return prose.length >= 120;
}

/**
 * @param {object} detection
 */
export function slimDetectionForAnalyst(detection) {
  if (!detection || typeof detection !== "object") return {};
  const {
    searchCorpus,
    retrievalSnippets,
    ...rest
  } = detection;
  return rest;
}
