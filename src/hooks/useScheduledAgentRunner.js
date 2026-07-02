import { useEffect, useRef } from "react";
import { discoverScheduledAgentTasks } from "../lib/agents/discoverScheduledAgentTasks.js";
import { isScheduleNotDue } from "../lib/agents/agentScheduleGate.js";
import { formatScheduleAtLabel } from "../lib/agents/agentScheduleGate.js";
import { useScheduledTasksStore } from "../stores/scheduledTasksStore.js";
import { translate } from "../i18n/useI18n.js";

const POLL_MS = 15_000;

/**
 * Poll canvas wiring and auto-run agent tasks when schedule is due (app open).
 * @param {object} params
 * @param {boolean} params.enabled
 * @param {object[]} params.canvasNodes
 * @param {object[]} params.canvasConns
 * @param {Record<string, object>} params.nodeEntities
 * @param {(opts: object) => Promise<{ ok: boolean }>} params.executeAgentRun
 * @param {(toast: { message: string, kind: string }) => void} [params.setToast]
 * @param {string} params.locale
 */
export function useScheduledAgentRunner({
  enabled,
  canvasNodes,
  canvasConns,
  nodeEntities,
  executeAgentRun,
  setToast,
  locale,
}) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = async () => {
      if (runningRef.current) return;
      const store = useScheduledTasksStore.getState();
      if (store.runningTaskKey) return;

      const tasks = discoverScheduledAgentTasks({
        canvasNodes,
        connections: canvasConns,
        nodeEntitiesById: nodeEntities,
      });

      const dueTask = tasks.find((task) => {
        if (store.completedTaskKeys.includes(task.taskKey)) return false;
        if (isScheduleNotDue(task.runAt)) return false;
        const agentNode = canvasNodes.find((n) => n.id === task.agentCanvasNodeId);
        if (!agentNode || agentNode.hidden) return false;
        if (agentNode.agentStatus === "running") return false;
        return true;
      });

      if (!dueTask) return;

      runningRef.current = true;
      store.setRunningTaskKey(dueTask.taskKey);

      try {
        const { ok } = await executeAgentRun({
          canvasNodeId: dueTask.agentCanvasNodeId,
          preferredMacroEntityId: dueTask.macroEntityId,
          skipScheduleGate: true,
          silentToast: true,
        });

        if (ok) {
          useScheduledTasksStore.getState().markTaskCompleted(dueTask.taskKey);
          setToast?.({
            message: translate("agents.scheduledTaskComplete", locale, { title: dueTask.title }),
            kind: "ok",
          });
        }
      } finally {
        useScheduledTasksStore.getState().setRunningTaskKey(null);
        runningRef.current = false;
      }
    };

    tick();
    const intervalId = setInterval(tick, POLL_MS);
    return () => clearInterval(intervalId);
  }, [
    enabled,
    canvasNodes,
    canvasConns,
    nodeEntities,
    executeAgentRun,
    setToast,
    locale,
  ]);
}

/**
 * @param {object} params
 * @returns {import('../lib/agents/scheduledAgentTaskTypes.js').ScheduledAgentTask[]}
 */
export function listUpcomingScheduledTasks({
  canvasNodes = [],
  canvasConns = [],
  nodeEntities = {},
  completedTaskKeys = [],
} = {}) {
  const tasks = discoverScheduledAgentTasks({
    canvasNodes,
    connections: canvasConns,
    nodeEntitiesById: nodeEntities,
  });
  return tasks.filter((task) => !completedTaskKeys.includes(task.taskKey));
}

export { formatScheduleAtLabel };
