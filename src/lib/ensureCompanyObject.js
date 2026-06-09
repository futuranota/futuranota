import { findObjectIdByName } from "./storeSanitize.js";
import { initStores } from "../stores/initStores.js";
import { useObjectsStore } from "../stores/objectsStore.js";
import { useUIStateStore } from "../stores/uiStateStore.js";

/**
 * Ensures a business object exists for a company target selection.
 * @param {{ name?: string, sector?: string }} company
 * @returns {string} object id
 */
export function ensureCompanyObject(company) {
  if (!company?.name?.trim()) return "";

  initStores();

  const name = company.name.trim();
  const description = company.sector?.trim() || "";
  const { objects, addObject } = useObjectsStore.getState();

  let objectId = findObjectIdByName(objects, name);
  if (!objectId) {
    objectId = addObject(name, description, undefined, name);
  }

  const { setSelectedObjectId, setFilterObjectId } = useUIStateStore.getState();
  setSelectedObjectId(objectId);
  setFilterObjectId(objectId);

  return objectId;
}
