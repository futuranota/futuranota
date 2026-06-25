import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { supabase } from "../lib/supabaseClient.js";

const DEFAULT_PROFILE = {
  plan: "free",
  calendarUsed: false,
  weatherUsed: false,
  searchCount: 0,
};

export const FREE_LIMITS = {
  maxObjects: 1,
  maxImportBytes: 54 * 1024 * 1024,
  maxSearches: 10,
  calendarUsesAllowed: 1,
  weatherUsesAllowed: 1,
};

function rowToProfile(row) {
  if (!row) return { ...DEFAULT_PROFILE };
  return {
    plan: row.plan === "pro" ? "pro" : "free",
    calendarUsed: Boolean(row.calendar_used),
    weatherUsed: Boolean(row.weather_used),
    searchCount: row.search_count ?? 0,
  };
}

export const usePlanStore = create(
  devtools(
    (set, get) => ({
      profile: { ...DEFAULT_PROFILE },
      loading: true,
      loaded: false,

      isPro: () => get().profile.plan === "pro",

      fetchProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          set({ profile: { ...DEFAULT_PROFILE }, loading: false, loaded: true });
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) {
          console.warn("planStore.fetchProfile error", error);
        }
        const profile = rowToProfile(data);
        // Admin account always tests as Pro — no Stripe/credits flow exists yet.
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const isAdminUser = !!adminEmail && session.user.email?.toLowerCase() === adminEmail.toLowerCase();
        if (isAdminUser) profile.plan = "pro";
        set({ profile, loading: false, loaded: true });
      },

      setPlan: async (plan) => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        const { error } = await supabase
          .from("profiles")
          .update({ plan, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (error) {
          console.warn("planStore.setPlan error", error);
          return;
        }
        set((state) => ({ profile: { ...state.profile, plan } }));
      },

      /** Marks a one-shot lifetime feature as used (calendar | weather). No-op on pro. */
      markFeatureUsed: async (feature) => {
        const { profile } = get();
        if (profile.plan === "pro") return;
        const column = feature === "calendar" ? "calendar_used" : "weather_used";
        const stateKey = feature === "calendar" ? "calendarUsed" : "weatherUsed";
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        const { error } = await supabase
          .from("profiles")
          .update({ [column]: true, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (error) {
          console.warn("planStore.markFeatureUsed error", error);
          return;
        }
        set((state) => ({ profile: { ...state.profile, [stateKey]: true } }));
      },

      /** Increments lifetime search_count by 1, returns the new count. No-op on pro (returns -1). */
      incrementSearchCount: async () => {
        const { profile } = get();
        if (profile.plan === "pro") return -1;
        const next = profile.searchCount + 1;
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return profile.searchCount;
        const { error } = await supabase
          .from("profiles")
          .update({ search_count: next, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (error) {
          console.warn("planStore.incrementSearchCount error", error);
          return profile.searchCount;
        }
        set((state) => ({ profile: { ...state.profile, searchCount: next } }));
        return next;
      },
    }),
    { name: "PlanStore" },
  ),
);
