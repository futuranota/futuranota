import { useDocsStore } from "../../stores/docsStore.js";
import { useUIStateStore } from "../../stores/uiStateStore.js";
import { translate } from "../../i18n/useI18n.js";
import {
  AGENT_CAMPAIGN_ANALYST,
  AGENT_CONTENT_CREATOR,
  AGENT_MARKETING_GUIDE,
  AGENT_SOCIAL_HYPE_ANALYST,
  getAgentById,
  isAgentEnabled,
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
  const agentId = agentNode.agentId || AGENT_CAMPAIGN_ANALYST;
  const agentDef = getAgentById(agentId);

  if (!isAgentEnabled(agentId)) {
    patchCanvasNode(canvasNodeId, {
      agentStatus: "error",
      agentError: translate("agents.orchestrator.disabled", locale),
    });
    if (!silentToast) {
      setToast({ message: translate("agents.orchestrator.disabled", locale), kind: "warm" });
    }
    return { ok: false };
  }

  if (agentId !== AGENT_CAMPAIGN_ANALYST
    && agentId !== AGENT_MARKETING_GUIDE
    && agentId !== AGENT_SOCIAL_HYPE_ANALYST
    && agentId !== AGENT_CONTENT_CREATOR) {
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
      return { ok: false, result: { status: "error", code: "schedule_not_due", message } };
    }
  }

  patchCanvasNode(canvasNodeId, { agentStatus: "running", agentError: "" });

  const minUxMs = agentDef?.runUxMinMs ?? 0;
  const runAgent = () => (agentId === AGENT_MARKETING_GUIDE
    ? runMarketingGuideAgent({
      agentCanvasNodeId: canvasNodeId,
      canvasNodes,
      connections: canvasConns,
      docsById: useDocsStore.getState().docs,
      objectsById: objects,
      selectedObjectId,
      locale,
    })
    : agentId === AGENT_SOCIAL_HYPE_ANALYST
      ? runSocialHypeAnalystAgent({
        agentCanvasNodeId: canvasNodeId,
        canvasNodes,
        connections: canvasConns,
        docsById: useDocsStore.getState().docs,
        objectsById: objects,
        selectedObjectId,
        locale,
      })
      : agentId === AGENT_CONTENT_CREATOR
        ? runContentCreatorAgent({
          agentCanvasNodeId: canvasNodeId,
          canvasNodes,
          connections: canvasConns,
          docsById: useDocsStore.getState().docs,
          objectsById: objects,
          nodeEntitiesById: nodeEntities,
          selectedObjectId,
          preferredMacroEntityId,
          locale,
        })
        : runCampaignAnalyst({
          agentCanvasNodeId: canvasNodeId,
          canvasNodes,
          connections: canvasConns,
          docsById: useDocsStore.getState().docs,
          objectsById: objects,
          nodeEntitiesById: nodeEntities,
          selectedObjectId,
          locale,
        }));

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
