import { campaignSignalFieldsFromDetection } from "../campaignSignalFields.js";
import { deriveAnnouncementDateIso } from "../launchCadenceMath.js";
import { buildHeuristicCadenceFromDetection } from "../heuristicCadence.js";

/**
 * Maps campaign detection into object.cadence shape for Launch Radar.
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {object} [existingCadence]
 */
export function mapDetectionToCadence(detection, brandName, existingCadence = {}) {
  const fields = campaignSignalFieldsFromDetection(brandName, detection);
  const detectionMode = detection?.detectionMode || fields.detectionMode || "";

  if (detectionMode === "confirmed_campaign" && fields.launchDate) {
    const launchDate = fields.launchDate;
    return {
      ...existingCadence,
      launchDate,
      announcementDate: fields.announcementDate
        || deriveAnnouncementDateIso(launchDate),
      lastLaunchDate: fields.lastLaunchDate || existingCadence.lastLaunchDate || null,
      averageIntervalMonths: fields.averageIntervalMonths === ""
        ? existingCadence.averageIntervalMonths ?? null
        : (Number(fields.averageIntervalMonths) || existingCadence.averageIntervalMonths) ?? null,
      overview: (fields.overview || existingCadence.overview || "").trim() || null,
      category: (fields.category || existingCadence.category || "").trim() || null,
      detectionMode: "confirmed_campaign",
      launchConfidence: "verified",
      estimatedLaunchDate: null,
      monthsRemaining: null,
      cadenceMessage: null,
      cadenceStatus: null,
      source: "agent-pipeline",
    };
  }

  if (
    detectionMode === "cadence_only"
    && fields.lastLaunchDate
    && fields.averageIntervalMonths !== ""
  ) {
    return {
      ...existingCadence,
      launchDate: null,
      announcementDate: null,
      lastLaunchDate: fields.lastLaunchDate,
      averageIntervalMonths: Number(fields.averageIntervalMonths),
      estimatedLaunchDate: fields.estimatedLaunchDate || null,
      monthsRemaining: fields.monthsRemaining === ""
        ? null
        : Number(fields.monthsRemaining),
      overview: (fields.cadenceMessage || fields.overview || existingCadence.overview || "").trim() || null,
      cadenceMessage: fields.cadenceMessage || null,
      cadenceStatus: fields.cadenceStatus || null,
      category: (fields.category || existingCadence.category || "").trim() || null,
      detectionMode: "cadence_only",
      launchConfidence: "estimated",
      source: "agent-pipeline",
    };
  }

  if (
    detectionMode === "heuristic_estimate"
    && fields.lastLaunchDate
    && fields.averageIntervalMonths !== ""
  ) {
    return {
      ...existingCadence,
      launchDate: null,
      announcementDate: null,
      lastLaunchDate: fields.lastLaunchDate,
      averageIntervalMonths: Number(fields.averageIntervalMonths),
      estimatedLaunchDate: fields.estimatedLaunchDate || null,
      monthsRemaining: fields.monthsRemaining === ""
        ? null
        : Number(fields.monthsRemaining),
      overview: (fields.cadenceMessage || fields.overview || existingCadence.overview || "").trim() || null,
      cadenceMessage: fields.cadenceMessage || null,
      cadenceStatus: fields.cadenceStatus || "watch",
      category: (fields.category || existingCadence.category || "").trim() || null,
      detectionMode: "heuristic_estimate",
      launchConfidence: "speculative",
      heuristicIntervalSource: detection?.heuristicIntervalSource || existingCadence.heuristicIntervalSource || null,
      source: "agent-pipeline",
    };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const heuristic = buildHeuristicCadenceFromDetection({
    brandName,
    todayIso,
    report: detection || {},
    allLaunchSignals: detection?.allLaunchSignals || detection?.launchSignals || [],
  });

  if (heuristic) {
    return {
      ...existingCadence,
      launchDate: null,
      announcementDate: null,
      lastLaunchDate: heuristic.lastLaunchDate,
      averageIntervalMonths: heuristic.averageIntervalMonths,
      estimatedLaunchDate: heuristic.estimatedLaunchDate,
      monthsRemaining: heuristic.monthsRemaining,
      overview: (heuristic.overview || existingCadence.overview || "").trim() || null,
      cadenceMessage: heuristic.cadenceMessage || null,
      cadenceStatus: heuristic.cadenceStatus || "watch",
      category: (heuristic.category || existingCadence.category || "").trim() || null,
      detectionMode: "heuristic_estimate",
      launchConfidence: "speculative",
      heuristicIntervalSource: heuristic.heuristicIntervalSource || null,
      source: "agent-pipeline",
    };
  }

  const launchDate = fields.launchDate || existingCadence.launchDate || null;
  const announcementDate = fields.announcementDate
    || existingCadence.announcementDate
    || (launchDate ? deriveAnnouncementDateIso(launchDate) : null);

  return {
    ...existingCadence,
    launchDate,
    announcementDate,
    lastLaunchDate: fields.lastLaunchDate || existingCadence.lastLaunchDate || null,
    averageIntervalMonths: fields.averageIntervalMonths === ""
      ? existingCadence.averageIntervalMonths ?? null
      : (Number(fields.averageIntervalMonths) || existingCadence.averageIntervalMonths) ?? null,
    overview: (fields.overview || existingCadence.overview || "").trim() || null,
    category: (fields.category || existingCadence.category || "").trim() || null,
    detectionMode: detectionMode || existingCadence.detectionMode || null,
    launchConfidence: existingCadence.launchConfidence || null,
    source: "agent-pipeline",
  };
}

/**
 * @param {object|null|undefined} cadence
 */
export function cadenceHasLaunchRadarData(cadence) {
  if (!cadence) return false;
  if (cadence.detectionMode === "confirmed_campaign" && cadence.launchDate) return true;
  if (
    cadence.detectionMode === "cadence_only"
    && cadence.lastLaunchDate
    && cadence.averageIntervalMonths != null
  ) {
    return true;
  }
  if (
    cadence.detectionMode === "heuristic_estimate"
    && cadence.lastLaunchDate
    && cadence.averageIntervalMonths != null
  ) {
    return true;
  }
  return false;
}
