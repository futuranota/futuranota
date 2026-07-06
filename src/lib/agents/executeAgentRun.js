import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { translate } from "../../i18n/useI18n.js";
import {
  AGENT_CAMPAIGN_ANALYST,
  AGENT_CONTENT_CREATOR,
  AGENT_DEEP_RESEARCHER,
  AGENT_MARKETING_GUIDE,
  AGENT_SALES_AGENT,
  AGENT_SOCIAL_HYPE_ANALYST,
  getAgentById,
  isAgentEnabledForUser,
} from "./registry.js";
import {
  formatScheduleAtLabel,
  isScheduleNotDue,
  resolveMacroScheduleAnchorAt,
} from "./agentScheduleGate.js";
import { runCampaignAnalyst } from "./runCampaignAnalyst.js";
import { runMarketingGuideAgent } from "./runMarketingGuideAgent.js";
import { runSocialHypeAnalystAgent } from "./runSocialHypeAnalystAgent.js";
import { runContentCreatorAgent } from "./runContentCreatorAgent.js";
import { runSalesAgentAgent } from "./runSalesAgentAgent.js";
import { runDeepResearcherAgent } from "./runDeepResearcherAgent.js";
import { useAuthStore } from "../../stores/authStore.js";

/**
 * Run a canvas agent node (manual or scheduled).
 * @param {object} params
 * @param {string} params.canvasNodeId
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.canvasConns
 * @param {Record<string, object>} params.nodeEntities
 * @param {Record<string, object>} params.objects
 * @param {Record<string, object>} params.docs
 * @param {string} params.locale
 * @param {(id: string, patch: object) => void} params.patchCanvasNode
 * @param {(toast: { message: string, kind: string }) => void} [params.setToast]
 * @param {(id: string | null) => void} [params.setExpandedDocId]
 * @param {(id: string | null) => void} [params.setExpandedNodeId]
 * @param {(focus: boolean) => void} [params.setExpandedNodeContentFocus]
 * @param {(fn: (n: number) => number) => void} [params.setDocViewGeneration]
 * @param {string | null} [params.preferredMacroEntityId]
 * @param {boolean} [params.skipScheduleGate]
 * @param {boolean} [params.silentToast]
 * @returns {Promise<{ ok: boolean, result?: object }>}
 */
export async function executeAgentRun({
  canvasNodeId,
  canvasNodes,
  canvasConns,
  nodeEntities,
  objects,
  docs,
  locale,
  patchCanvasNode,
  setToast = () => {},
  setExpandedDocId = () => {},
  setExpandedNodeId = () => {},
  setExpandedNodeContentFocus = () => {},
  setDocViewGeneration = () => {},
  preferredMacroEntityId = null,
  skipScheduleGate = false,
  silentToast = false,
}) {
  const agentNode = canvasNodes.find((n) => n.id === canvasNodeId);
  if (!agentNode || (agentNode.canvasKind !== "agent" && agentNode.dataType !== "agent")) {
    return { ok: false };
  }
  if (agentNode.agentStatus === "running") {
    return { ok: false };
  }

  const selectedObjectId = useUIStateStore.getState().selectedObjectId;
  const userEmail = useAuthStore.getState().user?.email;
  const agentId = agentNode.agentId || AGENT_CAMPAIGN_ANALYST;
  const agentDef = getAgentById(agentId);

  if (!isAgentEnabledForUser(agentId, userEmail)) {
    const message = translate("agents.errors.agent_forbidden", locale);
    patchCanvasNode(canvasNodeId, {
      agentStatus: "error",
      agentError: message,
    });
    if (!silentToast) {
      setToast({ message, kind: "warm" });
    }
    return { ok: false };
  }

  const runnableIds = new Set([
    AGENT_CAMPAIGN_ANALYST,
    AGENT_MARKETING_GUIDE,
    AGENT_SOCIAL_HYPE_ANALYST,
    AGENT_CONTENT_CREATOR,
    AGENT_SALES_AGENT,
    AGENT_DEEP_RESEARCHER,
  ]);

  if (!runnableIds.has(agentId)) {
    patchCanvasNode(canvasNodeId, {
      agentStatus: "error",
      agentError: translate("agents.errors.generic", locale),
    });
    if (!silentToast) {
      setToast({ message: translate("agents.errors.generic", locale), kind: "warm" });
    }
    return { ok: false };
  }

  if (!skipScheduleGate && agentId === AGENT_CONTENT_CREATOR) {
    const scheduleAnchorAt = resolveMacroScheduleAnchorAt({
      agentCanvasNodeId: canvasNodeId,
      canvasNodes,
      connections: canvasConns,
      nodeEntitiesById: nodeEntities,
      preferredMacroEntityId,
    });
    if (isScheduleNotDue(scheduleAnchorAt)) {
      const message = translate("agents.errors.schedule_not_due", locale, {
        schedule: formatScheduleAtLabel(scheduleAnchorAt),
      });
      if (!silentToast) {
        setToast({ message, kind: "warm" });
      }
      patchCanvasNode(canvasNodeId, {
        agentStatus: "error",
        agentError: message,
      });
      return { ok: false, result: { status: "error", code: "schedule_not_due", message } };
    }
  }

  patchCanvasNode(canvasNodeId, { agentStatus: "running", agentError: "" });

  const minUxMs = agentDef?.runUxMinMs ?? 0;
  const runAgent = () => {
    const base = {
      agentCanvasNodeId: canvasNodeId,
      canvasNodes,
      connections: canvasConns,
      docsById: useDocsStore.getState().docs,
      objectsById: objects,
      selectedObjectId,
      locale,
    };

    if (agentId === AGENT_MARKETING_GUIDE) return runMarketingGuideAgent(base);
    if (agentId === AGENT_SOCIAL_HYPE_ANALYST) return runSocialHypeAnalystAgent(base);
    if (agentId === AGENT_CONTENT_CREATOR) {
      return runContentCreatorAgent({
        ...base,
        nodeEntitiesById: nodeEntities,
        preferredMacroEntityId,
      });
    }
    if (agentId === AGENT_SALES_AGENT) {
      return runSalesAgentAgent({ ...base, nodeEntitiesById: nodeEntities });
    }
    if (agentId === AGENT_DEEP_RESEARCHER) {
      return runDeepResearcherAgent({ ...base, nodeEntitiesById: nodeEntities });
    }
    return runCampaignAnalyst({
      ...base,
      nodeEntitiesById: nodeEntities,
    });
  };

  const [result] = await Promise.all([
    runAgent(),
    minUxMs > 0
      ? new Promise((resolve) => { setTimeout(resolve, minUxMs); })
      : Promise.resolve(),
  ]);

  if (result.status === "success") {
    patchCanvasNode(canvasNodeId, {
      agentStatus: "done",
      agentError: "",
    });
    const openDocId = result.docId;
    if (result.wireOutputDocCanvasNodeId && openDocId) {
      const savedDoc = useDocsStore.getState().getDoc(openDocId);
      patchCanvasNode(result.wireOutputDocCanvasNodeId, {
        docId: openDocId,
        noteId: openDocId,
        content: savedDoc?.body || savedDoc?.content || "",
      });
    } else if (openDocId) {
      const savedDoc = useDocsStore.getState().getDoc(openDocId);
      const docCanvasNode = canvasNodes.find(
        (n) => (n.docId === openDocId || n.noteId === openDocId)
          && (n.canvasKind === "document" || n.dataType === "document"),
      );
      if (docCanvasNode && savedDoc) {
        patchCanvasNode(docCanvasNode.id, {
          content: savedDoc.body || savedDoc.content || "",
        });
      }
    }
    if (openDocId) {
      setDocViewGeneration((n) => n + 1);
      setExpandedDocId(openDocId);
    }
    if (result.mode === "macro_blog" && result.targetNodeEntityId) {
      setExpandedNodeContentFocus(true);
      setExpandedNodeId(result.targetNodeEntityId);
    }
    if (!silentToast) {
      setToast({
        message: result.userFacingMessage
          || (agentId === AGENT_MARKETING_GUIDE
            ? translate("agents.playbookSuccess", locale, { brand: result.brandName })
            : agentId === AGENT_SOCIAL_HYPE_ANALYST
              ? translate("agents.socialHypeSuccess", locale, { brand: result.brandName })
              : agentId === AGENT_CONTENT_CREATOR
                ? (result.userFacingMessage
                  || (result.mode === "macro_blog"
                    ? translate("agents.contentCreatorBlogSuccess", locale, {
                      title: result.plan?.writtenContent?.headline || result.macroTitle || "",
                    })
                    : translate("agents.contentCreatorSuccess", locale, {
                      brand: result.brandName,
                      count: String(result.plan?.items?.length || 0),
                    })))
                : agentId === AGENT_SALES_AGENT
                  ? result.userFacingMessage
                  : agentId === AGENT_DEEP_RESEARCHER
                    ? result.userFacingMessage
                    : translate("agents.runSuccess", locale, { brand: result.brandName })),
        kind: "ok",
      });
    }
    return { ok: true, result };
  }

  patchCanvasNode(canvasNodeId, {
    agentStatus: "error",
    agentError: result.message,
  });
  if (!silentToast) {
    setToast({ message: result.message, kind: "warm" });
  }
  return { ok: false, result };
}
