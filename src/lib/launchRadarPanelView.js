/**
 * Maps persisted cadence records to Launch Radar panel view shape.
 * @param {object|null|undefined} storedCadence
 */
export function cadenceRecordToPanelView(storedCadence) {
  if (!storedCadence) return null;

  const hasVerifiedLaunch = Boolean(
    storedCadence.launchDate
    && (
      storedCadence.detectionMode === "confirmed_campaign"
      || (
        storedCadence.launchConfidence !== "estimated"
        && storedCadence.detectionMode !== "cadence_only"
      )
    ),
  );

  if (hasVerifiedLaunch) {
    return {
      mode: "campaign",
      launchDate: storedCadence.launchDate,
      announcementDate: storedCadence.announcementDate || null,
      lastLaunchDate: storedCadence.lastLaunchDate || null,
      averageIntervalMonths: storedCadence.averageIntervalMonths ?? null,
      overview: storedCadence.overview || "",
      category: storedCadence.category || "",
      source: storedCadence.source || "hero_signal",
    };
  }

  const hasCadenceEstimate = Boolean(
    storedCadence.lastLaunchDate
    && storedCadence.averageIntervalMonths != null
    && (
      storedCadence.detectionMode === "cadence_only"
      || storedCadence.detectionMode === "heuristic_estimate"
      || storedCadence.launchConfidence === "estimated"
      || storedCadence.launchConfidence === "speculative"
      || !storedCadence.launchDate
    ),
  );

  if (hasCadenceEstimate) {
    return {
      mode: storedCadence.detectionMode === "heuristic_estimate" ? "heuristic" : "cadence",
      averageIntervalMonths: Number(storedCadence.averageIntervalMonths),
      lastLaunchDate: storedCadence.lastLaunchDate,
      overview: storedCadence.overview || storedCadence.cadenceMessage || "",
      category: storedCadence.category || "",
      source: storedCadence.source || "hero_signal",
      detectionMode: storedCadence.detectionMode || "cadence_only",
      launchConfidence: storedCadence.launchConfidence || null,
    };
  }

  return null;
}
