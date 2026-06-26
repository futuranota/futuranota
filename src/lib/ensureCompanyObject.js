import { findObjectIdByName } from "./storeSanitize.js";
import { deriveAnnouncementDateIso } from "./launchCadenceMath.js";
import { initStores } from "../stores/initStores.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import { useUIStateStore } from "../stores/uiStateStore.js";

/**
 * Ensures a business object exists for a company target selection and injects
 * campaign intel (dates, overview, cached study) for Launch Radar.
 * @param {{ name?: string, sector?: string, launchDate?: string|null, announcementDate?: string|null, lastLaunchDate?: string|null, averageIntervalMonths?: number|null, overview?: string|null, campaignStudy?: object|null }} company
 * @returns {string} object id
 */
export function ensureCompanyObject(company) {
  if (!company?.name?.trim()) return "";

  initStores();

  const name = company.name.trim();
  const description = company.sector?.trim() || "";
  const { objects, addObject, updateObject } = useObjectsStore.getState();

  let objectId = findObjectIdByName(objects, name);
  if (!objectId) {
    objectId = addObject(name, description, undefined, name);
  }

  const study = company.campaignStudy || null;
  const launchDate = company.launchDate || null;
  const hasCadence = launchDate
    || company.announcementDate
    || company.lastLaunchDate
    || company.averageIntervalMonths != null
    || company.overview
    || study?.overview;

  if (hasCadence) {
    updateObject(objectId, {
      cadence: {
        launchDate,
        announcementDate: company.announcementDate || (launchDate ? deriveAnnouncementDateIso(launchDate) : null),
        lastLaunchDate: company.lastLaunchDate || null,
        averageIntervalMonths: company.averageIntervalMonths ?? null,
        overview: (study?.overview || company.overview)?.trim() || null,
        category: company.sector?.trim() || null,
        source: study ? "campaign_study_cache" : "hero_signal",
        campaignStudy: study ? {
          status: study.status,
          note: study.note,
          peopleAlsoAsk: study.peopleAlsoAsk,
          socialHype: study.socialHype,
          searchIntent: study.searchIntent,
          fromCache: study.fromCache,
        } : null,
      },
    });
  }

  const { setSelectedObjectId, setFilterObjectId } = useUIStateStore.getState();
  setSelectedObjectId(objectId);
  setFilterObjectId(objectId);

  return objectId;
}
