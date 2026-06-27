import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { supabase } from "../lib/supabaseClient.js";
import {
  CREDIT_TOKEN_UNIT,
  FREE_LIMITS,
  getCreditsCap,
  getCreditsUsed,
  getPlanLimits,
  getTokensCap,
  getWeatherActionCap,
  TOKEN_COSTS,
} from "../lib/planConfig.js";
import {
  persistLocalWeatherActionsUsed,
  readLocalWeatherActionsUsed,
  resetLocalWeatherUsage,
} from "../lib/weatherUsage.js";

export { FREE_LIMITS, TOKEN_COSTS } from "../lib/planConfig.js";

const DEFAULT_PROFILE = {
  plan: "free",
  calendarUsed: false,
  weatherUsed: false,
  weatherActionsCount: 0,
  searchCount: 0,
  tokensBalance: getTokensCap("free"),
  tokensPeriodStart: null,
  campaignLiveUsed: false,
};

function isSameUtcMonth(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function rowToProfile(row) {
  if (!row) return { ...DEFAULT_PROFILE };
  const plan = row.plan === "pro" ? "pro" : "free";
  const cap = getTokensCap(plan);
  let tokensBalance = row.tokens_balance ?? cap;
  const periodStart = row.tokens_period_start || row.created_at || null;

  if (plan === "pro" && periodStart) {
    const start = new Date(periodStart);
    if (!isSameUtcMonth(start, new Date())) {
      tokensBalance = cap;
    }
  }

  return {
    plan,
    calendarUsed: Boolean(row.calendar_used),
    weatherUsed: Boolean(row.weather_used),
    weatherActionsCount: (() => {
      const raw = row.weather_actions_count;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.floor(n);
      return row.weather_used ? 1 : 0;
    })(),
    searchCount: row.search_count ?? 0,
    tokensBalance,
    tokensPeriodStart: periodStart,
    campaignLiveUsed: Boolean(row.campaign_live_used),
  };
}

function toFiniteNumber(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isMissingProfilesTable(error) {
  const msg = String(error?.message || "");
  return error?.code === "PGRST205"
    || error?.code === "PGRST204"
    || msg.includes("public.profiles")
    || msg.includes('column "user_id"')
    || msg.includes("tokens_balance");
}

async function persistProfilePatch(userId, patch) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return error;
}

export const usePlanStore = create(
  devtools(
    (set, get) => ({
      profile: { ...DEFAULT_PROFILE },
      loading: true,
      loaded: false,

      isPro: () => get().profile.plan === "pro",

      getTokensCap: () => getTokensCap(get().profile.plan),

      getCreditsCap: () => getCreditsCap(get().profile.plan),

      getCreditsUsed: () => getCreditsUsed(get().profile),

      getTokensRemaining: () => get().profile.tokensBalance,

      getWeatherActionCap: () => getWeatherActionCap(get().profile.plan),

      getWeatherActionsUsed: () => {
        const { profile, loaded } = get();
        if (loaded && profile.weatherActionsCount != null) {
          return profile.weatherActionsCount;
        }
        return readLocalWeatherActionsUsed();
      },

      canUseWeatherAction: () => {
        const used = get().getWeatherActionsUsed();
        return used < get().getWeatherActionCap();
      },

      incrementWeatherAction: async () => {
        const { profile } = get();
        if (!get().canUseWeatherAction()) return false;

        const next = get().getWeatherActionsUsed() + 1;
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (!userId) {
          persistLocalWeatherActionsUsed(next);
          set((state) => ({
            profile: {
              ...state.profile,
              weatherActionsCount: next,
              weatherUsed: next >= 1,
            },
          }));
          return true;
        }

        const patch = {
          weather_actions_count: next,
          weather_used: next >= 1,
        };
        const error = await persistProfilePatch(userId, patch);
        if (error) {
          console.warn("planStore.incrementWeatherAction error", error);
          persistLocalWeatherActionsUsed(next);
          set((state) => ({
            profile: {
              ...state.profile,
              weatherActionsCount: next,
              weatherUsed: next >= 1,
            },
          }));
          return true;
        }

        set((state) => ({
          profile: {
            ...state.profile,
            weatherActionsCount: next,
            weatherUsed: next >= 1,
          },
        }));
        persistLocalWeatherActionsUsed(next);
        return true;
      },

      resetWeatherActions: async () => {
        resetLocalWeatherUsage();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (userId) {
          const error = await persistProfilePatch(userId, {
            weather_actions_count: 0,
            weather_used: false,
          });
          if (error) {
            console.warn("planStore.resetWeatherActions error", error);
          }
        }

        set((state) => ({
          profile: {
            ...state.profile,
            weatherActionsCount: 0,
            weatherUsed: false,
          },
        }));
        return true;
      },

      getTokensUsed: () => {
        const cap = get().getTokensCap();
        return Math.max(0, cap - get().getTokensRemaining());
      },

      canSpendTokens: (amount) => {
        if (amount <= 0) return true;
        return get().profile.tokensBalance >= amount;
      },

      canRunCampaignLive: () => {
        const { profile } = get();
        if (profile.plan === "free" && profile.campaignLiveUsed) return false;
        return get().canSpendTokens(TOKEN_COSTS.campaignLive);
      },

      fetchProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          set({
            profile: {
              ...DEFAULT_PROFILE,
              weatherActionsCount: readLocalWeatherActionsUsed(),
              weatherUsed: readLocalWeatherActionsUsed() >= 1,
            },
            loading: false,
            loaded: true,
          });
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          if (isMissingProfilesTable(error)) {
            console.info(
              "planStore: ejecutá supabase_plans.sql + supabase_plans_tokens.sql en Supabase.",
            );
          } else {
            console.warn("planStore.fetchProfile error", error);
          }
        }

        let profile = rowToProfile(data);
        persistLocalWeatherActionsUsed(profile.weatherActionsCount);
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const isAdminUser = !!adminEmail && session.user.email?.toLowerCase() === adminEmail.toLowerCase();
        if (isAdminUser) {
          profile = { ...profile, plan: "pro" };
        }

        if (data && profile.plan === "pro" && profile.tokensPeriodStart) {
          const start = new Date(profile.tokensPeriodStart);
          if (!isSameUtcMonth(start, new Date())) {
            const cap = getTokensCap("pro");
            const now = new Date().toISOString();
            const resetErr = await persistProfilePatch(userId, {
              tokens_balance: cap,
              tokens_period_start: now,
            });
            if (!resetErr) {
              profile = { ...profile, tokensBalance: cap, tokensPeriodStart: now };
            }
          }
        }

        set({ profile, loading: false, loaded: true });
      },

      setPlan: async (plan) => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        const cap = getTokensCap(plan);
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("profiles")
          .update({
            plan,
            tokens_balance: cap,
            tokens_period_start: now,
            updated_at: now,
          })
          .eq("user_id", userId);
        if (error) {
          console.warn("planStore.setPlan error", error);
          return;
        }
        set((state) => ({
          profile: {
            ...state.profile,
            plan,
            tokensBalance: cap,
            tokensPeriodStart: now,
            campaignLiveUsed: plan === "free" ? state.profile.campaignLiveUsed : false,
          },
        }));
      },

      applyServerTokenDebit: (tokensBalance, campaignLiveUsed) => {
        set((state) => ({
          profile: {
            ...state.profile,
            tokensBalance,
            campaignLiveUsed: campaignLiveUsed ?? state.profile.campaignLiveUsed,
          },
        }));
      },

      chargeIntelSearchCredit: ({ creditCost = 1, tokenCost = CREDIT_TOKEN_UNIT } = {}) => {
        const { profile } = get();
        const snapshot = {
          searchCount: profile.searchCount,
          tokensBalance: profile.tokensBalance,
        };
        get().applyServerIntelUsage({
          creditsDebited: creditCost,
          tokenCost,
        });
        return snapshot;
      },

      rollbackIntelSearchCredit: (snapshot) => {
        if (!snapshot) return;
        set((state) => ({
          profile: {
            ...state.profile,
            searchCount: snapshot.searchCount,
            tokensBalance: snapshot.tokensBalance,
          },
        }));
      },

      applyServerIntelUsage: ({ tokensBalance, searchCount, creditsDebited, tokenCost }) => {
        set((state) => {
          const profile = { ...state.profile };
          const debited = toFiniteNumber(creditsDebited, 0);
          const cost = toFiniteNumber(tokenCost, debited * CREDIT_TOKEN_UNIT);
          const parsedSearchCount = toFiniteNumber(searchCount);
          const parsedTokenBalance = toFiniteNumber(tokensBalance);

          if (parsedSearchCount != null) {
            profile.searchCount = parsedSearchCount;
          } else if (debited > 0 && profile.plan !== "pro") {
            profile.searchCount = (profile.searchCount ?? 0) + debited;
          }

          if (parsedTokenBalance != null) {
            profile.tokensBalance = parsedTokenBalance;
          } else if (cost > 0 && profile.plan === "pro") {
            const cap = getTokensCap("pro");
            const current = toFiniteNumber(profile.tokensBalance, cap);
            profile.tokensBalance = Math.max(0, current - cost);
          }

          return { profile };
        });
      },

      spendTokens: async (amount, opts = {}) => {
        const { profile } = get();
        if (amount <= 0) return true;
        if (opts.markCampaignLive && profile.plan === "free" && profile.campaignLiveUsed) {
          return false;
        }
        if (!get().canSpendTokens(amount)) return false;

        const nextBalance = profile.tokensBalance - amount;
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return false;

        const patch = { tokens_balance: nextBalance };
        if (opts.markCampaignLive && profile.plan === "free") {
          patch.campaign_live_used = true;
        }

        const error = await persistProfilePatch(userId, patch);
        if (error) {
          console.warn("planStore.spendTokens error", error);
          return false;
        }

        set((state) => ({
          profile: {
            ...state.profile,
            tokensBalance: nextBalance,
            campaignLiveUsed: opts.markCampaignLive && profile.plan === "free"
              ? true
              : state.profile.campaignLiveUsed,
          },
        }));
        return true;
      },

      markFeatureUsed: async (feature) => {
        const { profile } = get();
        if (profile.plan === "pro") return;
        const column = feature === "calendar" ? "calendar_used" : "weather_used";
        const stateKey = feature === "calendar" ? "calendarUsed" : "weatherUsed";
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        const error = await persistProfilePatch(userId, { [column]: true });
        if (error) {
          console.warn("planStore.markFeatureUsed error", error);
          return;
        }
        set((state) => ({ profile: { ...state.profile, [stateKey]: true } }));
      },

      incrementSearchCount: async () => {
        const { profile } = get();
        if (profile.plan === "pro") {
          return get().spendTokens(TOKEN_COSTS.searchOverview) ? -1 : profile.searchCount;
        }
        if (profile.searchCount >= getPlanLimits("free").maxSearchesLifetime) {
          return profile.searchCount;
        }
        const next = profile.searchCount + 1;
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return profile.searchCount;
        const error = await persistProfilePatch(userId, { search_count: next });
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
