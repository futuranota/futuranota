import { useTimelineStore } from "../stores/timelineStore.js";

/**
 * Opening/selecting a company (Corpus workspace) sets timeline authority.
 * Guest folders from other companies can then inherit under this host.
 * Passing null clears authority and turns off inherit mode.
 *
 * @param {string|null|undefined} objectId
 */
export function setCorpusTimelineAuthority(objectId) {
  const id = objectId || null;
  const { setPrimaryTimelineObjectId, setInheritObjMode } = useTimelineStore.getState();
  setPrimaryTimelineObjectId(id);
  setInheritObjMode(Boolean(id));
}
