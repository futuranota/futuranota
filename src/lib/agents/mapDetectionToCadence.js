import { campaignSignalFieldsFromDetection } from "../campaignSignalFields.js";
import { deriveAnnouncementDateIso } from "../launchCadenceMath.js";

/**
 * Maps campaign detection into object.cadence shape for Launch Radar.
 * @param {import("../fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @param {string} brandName
 * @param {object} [existingCadence]
 */
export function mapDetectionToCadence(detection, brandName, existingCadence = {}) {
  const fields = campaignSignalFieldsFromDetection(brandName, detection);
  const launchDate = fields.launchDate || existingCadence.launchDate || null;
  const announcementDate = fields.announcementDate
    || existingCadence.announcementDate
    || (launchDate ? deriveAnnouncementDateIso(launchDate) : null);

  return {
    ...existingCadence,
    launchDate,
    announcementDate,
    lastLaunchDate: fields.lastLaunchDate || existingCadence.lastLaunchDate || null,
    averageIntervalMonths: fields.averageIntervalMonths ?? existingCadence.averageIntervalMonths ?? null,
    overview: (fields.overview || existingCadence.overview || "").trim() || null,
    category: (fields.category || existingCadence.category || "").trim() || null,
    source: "agent-pipeline",
  };
}
