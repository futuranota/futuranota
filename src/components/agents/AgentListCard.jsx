import { setCanvasDragData } from "../../lib/canvasDrag.js";
import { useI18n } from "../../i18n/useI18n.js";
import { AgentIcon } from "./AgentIcon.jsx";

/**
 * @param {{ agent: import("../../lib/agents/registry.js").AgentDefinition, onInsert: (agentId: string) => void }} props
 */
export function AgentListCard({ agent, onInsert }) {
  const { t } = useI18n();
  const enabled = agent.enabled !== false;
  const disabledHint = agent.disabledReasonKey ? t(agent.disabledReasonKey) : t("agents.comingSoon");

  return (
    <div className={"lp-agent-card fn-card" + (enabled ? "" : " lp-agent-card--disabled")}>
      <div className="lp-agent-card__icon" aria-hidden>
        <AgentIcon variant={agent.icon || agent.id} className="lp-agent-card__icon-svg" />
      </div>
      <div className="lp-agent-card__body">
        <p className="lp-agent-card__title">{t(agent.labelKey)}</p>
        <p className="lp-agent-card__desc dim">{t(agent.descriptionKey)}</p>
        {!enabled ? (
          <p className="lp-agent-card__disabled dim">{disabledHint}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="btn sm primary lp-agent-card__insert"
        disabled={!enabled}
        draggable={enabled}
        onDragStart={(e) => {
          if (!enabled) {
            e.preventDefault();
            return;
          }
          e.stopPropagation();
          setCanvasDragData(e.dataTransfer, { kind: "agent", agentId: agent.id });
        }}
        onClick={() => {
          if (enabled) onInsert(agent.id);
        }}
      >
        {enabled ? t("agents.insertToCanvas") : t("agents.comingSoon")}
      </button>
    </div>
  );
}
