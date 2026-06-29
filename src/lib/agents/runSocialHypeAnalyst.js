import { fetchSocialHypeAnalyst } from "../fetchSocialHypeAnalyst.js";
import { checkIntelCreditGate } from "../intelPlanGate.js";
import { debitIntelCredit } from "../debitIntelCredit.js";
import { translate } from "../../i18n/useI18n.js";
import { getAgentRunCost } from "./agentCreditCosts.js";
import { AGENT_SOCIAL_HYPE_ANALYST } from "./registry.js";
import { applyHypeReportToDoc, applyHypeReportToExistingDoc } from "./applyHypeReportToDoc.js";

/**
 * @param {object} params
 * @param {string} params.brandName
 * @param {string} [params.keyword]
 * @param {string|null} [params.parentObjectId]
 * @param {string|null} [params.targetDocId]
 * @param {'en'|'es'} [params.locale]
 */
export async function runSocialHypeAnalyst({
  brandName,
  keyword,
  parentObjectId = null,
  targetDocId = null,
  locale = "en",
}) {
  const lang = locale === "es" ? "es" : "en";
  const brand = (brandName || "").trim();

  if (!brand) {
    return {
      status: "error",
      code: "no_brand",
      message: translate("agents.errors.no_brand", lang),
    };
  }

  const { creditCost, routeLabel, endpoint } = getAgentRunCost(AGENT_SOCIAL_HYPE_ANALYST);
  const gate = await checkIntelCreditGate({ creditCost });
  if (!gate.ok) {
    return {
      status: "error",
      code: gate.code || "gate_tokens",
      message: gate.message || translate("agents.errors.gate_tokens", lang),
    };
  }

  let payload;
  try {
    payload = await fetchSocialHypeAnalyst({
      brandName: brand,
      keyword: keyword || brand,
      locale: lang,
    });
  } catch (err) {
    return {
      status: "error",
      code: "api",
      message: err instanceof Error ? err.message : translate("agents.errors.api", lang),
    };
  }

  const debit = await debitIntelCredit({
    creditCost,
    routeLabel,
    endpoint,
    meta: { brandName: brand, keyword: keyword || brand, agent: AGENT_SOCIAL_HYPE_ANALYST },
  });
  if (!debit.ok) {
    return {
      status: "error",
      code: "gate_tokens",
      message: translate("agents.errors.gate_tokens", lang),
    };
  }

  let docId = targetDocId;
  if (targetDocId) {
    const applied = applyHypeReportToExistingDoc(targetDocId, {
      hypeDistribution: payload.hypeDistribution,
      analystSections: payload.analystSections,
      parentObjectId,
      locale: lang,
    });
    if (!applied) {
      docId = applyHypeReportToDoc({
        hypeDistribution: payload.hypeDistribution,
        analystSections: payload.analystSections,
        parentObjectId,
        locale: lang,
      });
    }
  } else {
    docId = applyHypeReportToDoc({
      hypeDistribution: payload.hypeDistribution,
      analystSections: payload.analystSections,
      parentObjectId,
      locale: lang,
    });
  }

  return {
    status: "success",
    docId,
    brandName: brand,
    hypeDistribution: payload.hypeDistribution,
    analystSections: payload.analystSections,
    userFacingMessage: lang === "es"
      ? `Social Hype listo · ${brand} · mi lectura: ${payload.analystSections?.preferredChannel || "—"}`
      : `Social Hype ready · ${brand} · my read: ${payload.analystSections?.preferredChannel || "—"}`,
  };
}
