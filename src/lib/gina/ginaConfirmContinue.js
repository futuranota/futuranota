/**
 * Deterministic «sí» / confirm_continue — consume pending offers or infer from chat history.
 */

import { foldGinaText } from "./ginaTimeScope.js";
import { matchDepartmentInText } from "./ginaTools.js";
import { getPendingGinaOffer } from "./ginaPendingOffer.js";

/**
 * @typedef {{
 *   action: "list_department_docs",
 *   departmentName: string,
 *   departmentId?: string | null,
 *   fromPending?: boolean,
 * } | null} GinaConfirmContinueAction
 */

/**
 * Infer what the user confirmed from pending offer or prior assistant turn.
 * @param {object} ctx
 * @param {Array<{ role?: string, content?: string }>} [recentMessages]
 * @returns {GinaConfirmContinueAction}
 */
export function inferConfirmContinueAction(ctx, recentMessages = []) {
  const pending = getPendingGinaOffer();
  if (pending?.type === "list_department_docs" && pending.departmentName) {
    return {
      action: "list_department_docs",
      departmentName: String(pending.departmentName),
      departmentId: pending.departmentId || null,
      fromPending: true,
    };
  }

  const messages = Array.isArray(recentMessages) ? recentMessages : [];
  let lastAssistant = "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === "assistant" && String(m.content || "").trim()) {
      lastAssistant = String(m.content);
      break;
    }
  }

  const offerCue = /\b(quieres ver todos los documentos|want to see all the documents|ver todos los documentos de)\b/i.test(lastAssistant);
  if (!offerCue) return null;

  const fromAssistant = matchDepartmentInText(ctx, lastAssistant);
  if (fromAssistant?.name) {
    return {
      action: "list_department_docs",
      departmentName: fromAssistant.name,
      departmentId: fromAssistant.id || null,
    };
  }

  const prior = ctx?.priorDepartment || ctx?.lastTurn?.department || null;
  if (prior) {
    const fromPrior = matchDepartmentInText(ctx, String(prior));
    if (fromPrior?.name) {
      return {
        action: "list_department_docs",
        departmentName: fromPrior.name,
        departmentId: fromPrior.id || null,
      };
    }
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const hit = matchDepartmentInText(ctx, String(m.content || ""));
    if (hit?.name) {
      return {
        action: "list_department_docs",
        departmentName: hit.name,
        departmentId: hit.id || null,
      };
    }
  }

  return null;
}

/**
 * @param {string} text folded assistant or user text mentioning department folders offer
 */
export function isDepartmentDocsOfferMessage(text) {
  const q = foldGinaText(text);
  if (!q) return false;
  return /\b(quieres ver todos los documentos|want to see all the documents)\b/.test(q);
}
