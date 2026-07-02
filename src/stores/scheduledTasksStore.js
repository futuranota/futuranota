import { create } from "zustand";
import { devtools } from "zustand/middleware";

export const useScheduledTasksStore = create(
  devtools(
    (set, get) => ({
      /** When true, due wired macro tasks auto-run while the app is open. */
      autoRunEnabled: true,
      /** taskKeys already executed successfully. */
      completedTaskKeys: [],
      /** taskKey currently running (mutex). */
      runningTaskKey: null,

      setAutoRunEnabled: (enabled) => set({ autoRunEnabled: Boolean(enabled) }),

      markTaskCompleted: (taskKey) => {
        if (!taskKey) return;
        set((state) => {
          if (state.completedTaskKeys.includes(taskKey)) return state;
          return { completedTaskKeys: [...state.completedTaskKeys, taskKey] };
        });
      },

      clearCompletedTask: (taskKey) => {
        if (!taskKey) return;
        set((state) => ({
          completedTaskKeys: state.completedTaskKeys.filter((k) => k !== taskKey),
        }));
      },

      clearAllCompletedTasks: () => set({ completedTaskKeys: [] }),

      setRunningTaskKey: (taskKey) => set({ runningTaskKey: taskKey || null }),

      isTaskCompleted: (taskKey) => get().completedTaskKeys.includes(taskKey),
    }),
    { name: "ScheduledTasksStore" },
  ),
);
