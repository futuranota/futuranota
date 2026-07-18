import { useEffect, useRef } from "react";
import { discoverScheduledAgentTasks } from "../lib/agents/discoverScheduledAgentTasks.js";
import { isScheduleNotDue, formatScheduleAtLabel } from "../lib/agents/agentScheduleGate.js";
import { translate } from "../i18n/useI18n.js";
import { useScheduledTasksStore } from "../stores/scheduledTasksStore.js";
import { useTimelineStore } from "../stores/timelineStore.js";

const POLL_MS = 15_000;

/**
 * @param {object} agentSet
 * @param {object[]} canvasNodes
 */
function canRunTimelineAgentSet(agentSet, canvasNodes) {
  if (!agentSet?.agentCanvasNodeId) return false;
  const agentNode = canvasNodes.find((n) => n.id === agentSet.agentCanvasNodeId);
  if (!agentNode || agentNode.hidden) return false;
  if (agentNode.agentStatus === "running") return false;
  return true;
}

/**
 * Poll timeline agent sets + canvas wiring; auto-run when schedule is due (app open).
 * Pauses while the tab is hidden (Page Visibility API).
 * @param {object} params
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
      if (typeof document !== "undefined" && document.hidden) return;
      if (runningRef.current) return;
      const scheduledStore = useScheduledTasksStore.getState();
      if (scheduledStore.runningTaskKey) return;

      const timelineStore = useTimelineStore.getState();
      const timelineSets = timelineStore.timelineAgentSets || [];

      const dueTimelineSet = timelineSets.find((set) => {
        if (set.status !== "pending") return false;
        if (scheduledStore.completedTaskKeys.includes(set.setKey)) return false;
        if (isScheduleNotDue(set.triggerAt)) return false;
        return canRunTimelineAgentSet(set, canvasNodes);
      });

      if (dueTimelineSet) {
        runningRef.current = true;
        scheduledStore.setRunningTaskKey(dueTimelineSet.setKey);
        timelineStore.updateTimelineAgentSetStatus(dueTimelineSet.id, "running");

        try {
          const { ok } = await executeAgentRun({
            canvasNodeId: dueTimelineSet.agentCanvasNodeId,
            preferredMacroEntityId: dueTimelineSet.macroEntityId,
            skipScheduleGate: true,
            silentToast: true,
          });

          if (ok) {
            useScheduledTasksStore.getState().markTaskCompleted(dueTimelineSet.setKey);
            useTimelineStore.getState().updateTimelineAgentSetStatus(dueTimelineSet.id, "ready");
            setToast?.({
              message: translate("timeline.agentSetReadyToast", locale, {
                title: dueTimelineSet.title,
              }),
              kind: "ok",
            });
          } else {
            useTimelineStore.getState().updateTimelineAgentSetStatus(
              dueTimelineSet.id,
              "failed",
              "Run failed",
            );
          }
        } finally {
          useScheduledTasksStore.getState().setRunningTaskKey(null);
          runningRef.current = false;
        }
        return;
      }

      const tasks = discoverScheduledAgentTasks({
        canvasNodes,
        connections: canvasConns,
        nodeEntitiesById: nodeEntities,
      });

      const pinnedKeys = new Set(timelineSets.map((set) => set.setKey));

      const dueTask = tasks.find((task) => {
        if (pinnedKeys.has(task.taskKey)) return false;
        if (scheduledStore.completedTaskKeys.includes(task.taskKey)) return false;
        if (isScheduleNotDue(task.runAt)) return false;
        const agentNode = canvasNodes.find((n) => n.id === task.agentCanvasNodeId);
        if (!agentNode || agentNode.hidden) return false;
        if (agentNode.agentStatus === "running") return false;
        return true;
      });

      if (!dueTask) return;

      runningRef.current = true;
      scheduledStore.setRunningTaskKey(dueTask.taskKey);

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

    let intervalId = null;

    const startPolling = () => {
      if (intervalId != null) return;
      tick();
      intervalId = window.setInterval(tick, POLL_MS);
    };

    const stopPolling = () => {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      startPolling();
    };

    if (typeof document !== "undefined" && document.hidden) {
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
        stopPolling();
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }

    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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
} = {}) {
  return discoverScheduledAgentTasks({
    canvasNodes,
    connections: canvasConns,
    nodeEntitiesById: nodeEntities,
  });
}

export { formatScheduleAtLabel };
