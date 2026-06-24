import { create } from "zustand";

export const useUpgradeModalStore = create((set) => ({
  open: false,
  reason: "generic",
  show: (reason = "generic") => set({ open: true, reason }),
  hide: () => set({ open: false }),
}));
