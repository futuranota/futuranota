import { resolveCurrentCorpus, resolveIntelCampaignBrand } from "./currentCorpus.js";
import { fetchCampaignDetection } from "./fetchCampaignDetection.js";
import { buildCampaignDocFromDetection } from "./campaignDocFromDetection.js";
import { useDocsStore } from "../stores/docsStore.js";
import { checkIntelCreditGate } from "./intelPlanGate.js";
import { debitIntelCredit } from "./debitIntelCredit.js";
import { DEFAULT_RANGE_DAYS } from "./campaignWindow.js";

/**
 * @typedef {Object} CampaignScanResult
 * @property {"success"} status
 * @property {string} docId
 * @property {import("./fetchCampaignDetection.js").CampaignDetectionResponse} detection
 * @property {string} brandName
 */

/**
 * @typedef {Object} CampaignScanError
 * @property {"error"} status
 * @property {string} message
 * @property {"no_brand"|"gate"|"api"} [code]
 */

/**
 * Runs deep campaign scan for the active corpus brand and creates a Content doc.
 * @param {Object} params
 * @param {Record<string, { id: string, name?: string, brand?: string, role?: string }>} params.objectsById
 * @param {string|null} params.selectedObjectId
 * @param {string} [params.userQuery]
 * @param {number} [params.rangeDays]
 * @returns {Promise<CampaignScanResult|CampaignScanError>}
 */
export async function runCampaignScanForCorpus({
  objectsById = {},
  selectedObjectId = null,
  userQuery = "",
  rangeDays = DEFAULT_RANGE_DAYS,
}) {
  const { currentCorpus, brandName } = resolveCurrentCorpus(objectsById, selectedObjectId);
  const scanBrand = brandName || resolveIntelCampaignBrand(objectsById, selectedObjectId);

  if (!scanBrand) {
    return {
      status: "error",
      code: "no_brand",
      message: "Definí la marca en el objeto corpus del sidebar.",
    };
  }

  const planGate = await checkIntelCreditGate();
  if (!planGate.ok) {
    return {
      status: "error",
      code: "gate",
      message: planGate.code === "gate_search"
        ? "Search limit reached."
        : "Insufficient credits.",
    };
  }

  try {
    const detection = await fetchCampaignDetection({
      brandName: scanBrand,
      rangeDays,
      mode: "deep",
      userQuery: userQuery.trim(),
    });

    const hasReport = Boolean(
      detection.deepReport?.trim()
      || detection.overview?.trim()
      || (detection.citations?.length > 0),
    );

    if (detection.error && detection.noData && !hasReport) {
      return {
        status: "error",
        code: "api",
        message: detection.error || detection.overview || "Campaign scan failed.",
      };
    }

    const payload = buildCampaignDocFromDetection(
      detection,
      scanBrand,
      currentCorpus?.id ?? null,
    );

    const addDoc = useDocsStore.getState().addDoc;
    const docId = addDoc(
      payload.title,
      payload.parentObjectId,
      [],
      [],
      "",
      null,
      payload.blocks,
      payload.campaignMeta,
    );

    if (!docId) {
      return { status: "error", code: "api", message: "Could not create document." };
    }

    const debit = await debitIntelCredit({
      routeLabel: "Campaign Scan",
      endpoint: "analytics/campaign-detect",
      meta: { brandName: scanBrand, docId },
    });
    if (!debit.ok) {
      return {
        status: "error",
        code: "gate",
        message: "Insufficient credits.",
      };
    }

    return {
      status: "success",
      docId,
      detection,
      brandName: scanBrand,
    };
  } catch (err) {
    return {
      status: "error",
      code: "api",
      message: err instanceof Error ? err.message : "Campaign scan failed.",
    };
  }
}

/** Visual query seed for Campaign tab — delegates to campaign-search-starters.json */
export { getDefaultCampaignSearchQuery as campaignScanQuerySeed } from "./campaignSearchStarters.js";
