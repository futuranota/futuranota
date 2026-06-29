import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { createDocBlock } from "../docBlocks.js";
import {
  buildMarketingGuidePlaybookBodyAsync,
  MARKETING_GUIDE_REPORT_PRESENTATION,
  playbookDocTitle,
} from "./marketingGuidePlaybook.js";
import { buildMarketContextBundle } from "./marketContextBundle.js";

/**
 * @param {object} params
 * @param {string} params.brandName
 * @param {object} [params.detection]
 * @param {object} [params.analystReport]
 * @param {import("./marketContextBundle.js").MarketContextBundle} [params.marketContextBundle]
 * @param {string|null} [params.parentObjectId]
 * @param {'en' | 'es'} [params.locale]
 */
export async function runMarketingGuide({
  brandName,
  detection,
  analystReport,
  marketContextBundle,
  parentObjectId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";
  const brand = (brandName || "").trim();

  if (!brand) {
    return {
      status: "error",
      code: "api",
      message: lang === "es" ? "Marca requerida para el Playbook." : "Brand required for Playbook.",
    };
  }

  const bundle = marketContextBundle
    || buildMarketContextBundle(analystReport, detection, brand);

  const bodyText = await buildMarketingGuidePlaybookBodyAsync(brand, lang, bundle);
  if (!bodyText.trim()) {
    return {
      status: "error",
      code: "api",
      message: lang === "es"
        ? "No se pudo generar el Playbook."
        : "Could not generate Playbook.",
    };
  }

  const title = playbookDocTitle(brand, lang);
  const docId = useDocsStore.getState().addDoc(
    title,
    parentObjectId,
    [],
    ["playbook", "marketing-guide"],
    bodyText,
    null,
    [createDocBlock("text", { text: bodyText })],
    {
      docKind: "content",
      reportPresentation: { ...MARKETING_GUIDE_REPORT_PRESENTATION },
    },
  );

  useUIStateStore.getState().clearDocEditorDraft(docId);

  return {
    status: "success",
    docId,
    brandName: brand,
    userFacingMessage: lang === "es"
      ? `Playbook listo · ${brand}`
      : `Playbook ready · ${brand}`,
  };
}
