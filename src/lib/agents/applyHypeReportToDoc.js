import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { useObjectsStore } from "../../stores/objectsStore.js";
import { createDocBlock } from "../docBlocks.js";
import {
  buildHypeReportBody,
  SOCIAL_HYPE_REPORT_PRESENTATION,
  socialHypeDocTitle,
} from "./buildHypeReportBody.js";

/**
 * @param {string|null|undefined} objectId
 * @param {object|null|undefined} hypeDistribution
 */
function writeHypeSnapshotToObject(objectId, hypeDistribution) {
  if (!objectId || !hypeDistribution) return;
  const { objects, updateObject } = useObjectsStore.getState();
  const object = objects[objectId];
  if (!object) return;

  updateObject(objectId, {
    cadence: {
      ...(object.cadence || {}),
      hypeSnapshot: hypeDistribution,
      hypeSnapshotAt: hypeDistribution.collectedAt || new Date().toISOString(),
    },
  });
}

/**
 * @param {object} params
 * @param {import("../fetchSocialHypeAnalyst.js").HypeDistributionV1} params.hypeDistribution
 * @param {import("../fetchSocialHypeAnalyst.js").SocialHypeAnalystSections} params.analystSections
 * @param {string|null} [params.parentObjectId]
 * @param {'en'|'es'} [params.locale]
 */
export function applyHypeReportToDoc({
  hypeDistribution,
  analystSections,
  parentObjectId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";
  const brand = hypeDistribution?.brandName?.trim();
  if (!brand) return null;

  const bodyText = buildHypeReportBody(hypeDistribution, analystSections, lang);
  if (!bodyText.trim()) return null;

  const docId = useDocsStore.getState().addDoc(
    socialHypeDocTitle(brand, lang),
    parentObjectId,
    [
      {
        key: "hypeSnapshot",
        value: JSON.stringify(hypeDistribution),
      },
    ],
    ["social-hype", "intel"],
    bodyText,
    null,
    [createDocBlock("text", { text: bodyText })],
    {
      docKind: "content",
      campaignActive: Boolean(hypeDistribution.campaignActive),
      reportPresentation: { ...SOCIAL_HYPE_REPORT_PRESENTATION },
    },
  );

  useUIStateStore.getState().clearDocEditorDraft(docId);
  if (parentObjectId) writeHypeSnapshotToObject(parentObjectId, hypeDistribution);

  return docId;
}

/**
 * @param {string} docId
 * @param {object} params
 */
export function applyHypeReportToExistingDoc(docId, params) {
  const store = useDocsStore.getState();
  const doc = store.getDoc(docId);
  if (!doc) return false;

  const lang = params.locale === "es" ? "es" : "en";
  const bodyText = buildHypeReportBody(params.hypeDistribution, params.analystSections, lang);
  if (!bodyText.trim()) return false;

  store.updateDoc(docId, {
    blocks: [createDocBlock("text", { text: bodyText })],
    campaignActive: Boolean(params.hypeDistribution?.campaignActive),
    reportPresentation: { ...SOCIAL_HYPE_REPORT_PRESENTATION },
    dataProperties: [
      ...(doc.dataProperties || []).filter((entry) => entry?.key !== "hypeSnapshot"),
      {
        key: "hypeSnapshot",
        value: JSON.stringify(params.hypeDistribution),
      },
    ],
  });

  useUIStateStore.getState().clearDocEditorDraft(docId);
  if (params.parentObjectId) {
    writeHypeSnapshotToObject(params.parentObjectId, params.hypeDistribution);
  }

  return true;
}
