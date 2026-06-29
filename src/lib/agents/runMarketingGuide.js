import { useAuthStore } from "../../stores/authStore.js";
import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { createDocBlock } from "../docBlocks.js";
import {
  buildMarketingGuidePlaybookBodyAsync,
  MARKETING_GUIDE_AGENT_NAME,
  MARKETING_GUIDE_REPORT_PRESENTATION,
  playbookDocTitle,
  resolvePlaybookAccountName,
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

  const user = useAuthStore.getState().user;
  const bodyText = await buildMarketingGuidePlaybookBodyAsync(brand, "es", bundle, {
    accountName: resolvePlaybookAccountName(user, lang),
    agentName: MARKETING_GUIDE_AGENT_NAME,
  });
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
      ? "Marketing Guide listo"
      : "Marketing Guide ready",
  };
}
