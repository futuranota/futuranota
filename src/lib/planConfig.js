/**
 * Plan limits & token costs — docs/planes-costos-propuesta.md
 */

/** @typedef {'free'|'pro'} PlanId */

import { CREDIT_TOKEN_UNIT } from "./intelModels.js";

export { CREDIT_TOKEN_UNIT };

/** User-facing credits per agent run. */
export const AGENT_RUN_CREDIT_COST = 3;

/** User-facing credits per Launch Radar panel scan (Pro). */
export const LAUNCH_RADAR_CREDIT_COST = 2;

/** @param {number} credits */
export function creditsToTokens(credits) {
  return Math.round(Number(credits) * CREDIT_TOKEN_UNIT);
}

/** @param {number} credits */
export function formatCreditAmount(credits) {
  const n = Number(credits);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

export const TOKEN_COSTS = {
  campaignLive: 10_000,
  cadenceLive: 1_000,
  /** Intel search + agent runs — 1 user credit each (10k internal tokens). */
  searchOverview: 10_000,
  agentOrchestrator: 10_000,
  agentAnalyst: 10_000,
  agentContentCreator: 10_000,
  agentPlanAgent: 10_000,
  aiChat: 500,
};

export const CALENDAR_LIMITS = {
  freeLifetime: 1,
  proPerMonth: 30,
};

export const PLAN_LIMITS = {
  free: {
    id: 'free',
    label: 'Starter',
    tokensCap: 10_000,
    tokensRenewable: false,
    maxObjects: 1,
    maxImportBytes: 5 * 1024 * 1024,
    stepsLibraryCrossObject: false,
    maxSearchesLifetime: 10,
    calendarUsesAllowed: CALENDAR_LIMITS.freeLifetime,
    calendarSearchesCap: CALENDAR_LIMITS.freeLifetime,
    weatherUsesAllowed: 1,
    weatherNodeActionsCap: 1,
    weatherCityChangesCap: 0,
    campaignLiveRuns: 1,
    storageLabel: '5 MB',
    storageBytes: 5 * 1024 * 1024,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    tokensCap: 2_000_000,
    tokensRenewable: true,
    maxObjects: Infinity,
    maxImportBytes: 5 * 1024 * 1024 * 1024,
    stepsLibraryCrossObject: true,
    maxLiveRunsPerMonth: 200,
    calendarUsesAllowed: Infinity,
    calendarSearchesCap: CALENDAR_LIMITS.proPerMonth,
    weatherUsesAllowed: Infinity,
    weatherNodeActionsCap: 50,
    weatherCityChangesCap: Infinity,
    storageLabel: '5 GB',
    storageBytes: 5 * 1024 * 1024 * 1024,
  },
};

export const FREE_LIMITS = {
  maxObjects: PLAN_LIMITS.free.maxObjects,
  maxImportBytes: PLAN_LIMITS.free.maxImportBytes,
  maxSearches: PLAN_LIMITS.free.maxSearchesLifetime,
  calendarUsesAllowed: PLAN_LIMITS.free.calendarUsesAllowed,
  weatherUsesAllowed: PLAN_LIMITS.free.weatherUsesAllowed,
};

/** User-facing Pro monthly credit pool (200 credits × 1 credit unit). */
export const PRO_MONTHLY_CREDITS = PLAN_LIMITS.pro.maxLiveRunsPerMonth;

/**
 * Free plan: Intel search panel disabled when lifetime credits are exhausted.
 * @param {{ plan?: string, searchCount?: number, tokensBalance?: number }} profile
 */
export function isIntelPanelLocked(profile) {
  if (profile?.plan === 'pro') return false;
  return getCreditsRemaining(profile) <= 0;
}

/** @param {PlanId|string} plan */
export function getWeatherCityChangeCap(plan) {
  return getPlanLimits(plan).weatherCityChangesCap;
}

/** @param {PlanId|string} plan */
export function getWeatherActionCap(plan) {
  return getPlanLimits(plan).weatherNodeActionsCap;
}

/** @param {PlanId|string} plan */
export function getPlanLimits(plan) {
  return plan === 'pro' ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

/** Admin / feature-usage: human bytes (B / KB / MB / GB). */
export function formatStorageBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb >= 10 ? Math.round(kb) : Number(kb.toFixed(1))} KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    const mb = n / (1024 * 1024);
    return `${mb >= 10 ? Number(mb.toFixed(1)) : Number(mb.toFixed(2))} MB`;
  }
  return `${Number((n / (1024 * 1024 * 1024)).toFixed(2))} GB`;
}

/**
 * Sum of mixed allotments (e.g. 5 GB + 5 GB + 5 MB) without rounding away MB.
 * → "10 GB + 5 MB"
 */
export function formatStorageBytesParts(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n <= 0) return "0 B";
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  const gb = Math.floor(n / GB);
  let rest = n - gb * GB;
  const mbExact = rest / MB;
  const mb = mbExact >= 10 ? Math.round(mbExact) : Number(mbExact.toFixed(1));
  rest = Math.max(0, rest - mb * MB);
  const parts = [];
  if (gb > 0) parts.push(`${gb} GB`);
  if (mb > 0) parts.push(`${mb} MB`);
  if (!parts.length) return formatStorageBytes(n);
  if (rest >= 1024 && gb === 0 && mb === 0) return formatStorageBytes(n);
  return parts.join(" + ");
}

/** @param {PlanId|string} plan */
export function getTokensCap(plan) {
  return getPlanLimits(plan).tokensCap;
}

/** User-facing credit cap (UI only — internal ledger stays in tokens). */
/** @param {PlanId|string} plan */
export function getCreditsCap(plan) {
  const limits = getPlanLimits(plan);
  return plan === 'pro' ? limits.maxLiveRunsPerMonth : limits.maxSearchesLifetime;
}

/**
 * Credits used for display (used/cap). Free = Intel searches; Pro = tokens spent ÷ 10k.
 * @param {{ plan?: string, searchCount?: number, tokensBalance?: number }} profile
 */
function toFiniteNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getCreditsUsed(profile) {
  const plan = profile?.plan === 'pro' ? 'pro' : 'free';
  if (plan === 'free') {
    return Math.min(
      getCreditsCap('free'),
      Math.max(0, toFiniteNumber(profile?.searchCount, 0)),
    );
  }
  const cap = getTokensCap('pro');
  const balance = toFiniteNumber(profile?.tokensBalance, cap);
  const spent = Math.max(0, cap - balance);
  return Math.min(getCreditsCap('pro'), spent / CREDIT_TOKEN_UNIT);
}

/** User-facing credits left (supports fractional, e.g. 147.5). */
export function getCreditsRemaining(profile) {
  const plan = profile?.plan === 'pro' ? 'pro' : 'free';
  const cap = getCreditsCap(plan);
  const mainRemaining = cap - getCreditsUsed(profile);
  const referral = Math.max(0, toFiniteNumber(profile?.referralCreditsBalance, 0));
  const remaining = mainRemaining + referral;
  return Math.max(0, Math.round(remaining * 10) / 10);
}

/**
 * Single counter for UI: remaining / cap (Free 10→0, Pro 200→0).
 * @param {{ plan?: string, searchCount?: number, tokensBalance?: number }} profile
 */
export function getCreditsDisplay(profile) {
  const plan = profile?.plan === 'pro' ? 'pro' : 'free';
  const cap = getCreditsCap(plan);
  const remaining = getCreditsRemaining(profile);
  const counter = Number.isInteger(remaining) ? remaining : remaining.toFixed(1).replace(/\.0$/, "");
  return {
    cap,
    remaining,
    counter,
    used: Math.round((cap - remaining) * 10) / 10,
  };
}

/** @param {{ plan?: string, searchCount?: number, tokensBalance?: number }} profile */
export function canSpendCredits(profile, amount = 1) {
  const cost = Math.max(0.01, Number(amount) || 1);
  return getCreditsRemaining(profile) >= cost;
}

/** @param {number} n */
export function formatTokenCount(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

/** @param {PlanId|string} plan */
export function getCalendarSearchesCap(plan) {
  return getPlanLimits(plan).calendarSearchesCap;
}

/** @param {{ plan?: string, calendarUsed?: boolean, calendarSearchesCount?: number }} profile */
export function getCalendarSearchesUsed(profile) {
  const plan = profile?.plan === 'pro' ? 'pro' : 'free';
  if (plan === 'free') {
    return profile?.calendarUsed ? 1 : 0;
  }
  return Math.max(0, profile?.calendarSearchesCount ?? 0);
}

/** @param {{ plan?: string, calendarUsed?: boolean, calendarSearchesCount?: number }} profile */
export function canUseCalendarSearch(profile) {
  const plan = profile?.plan === 'pro' ? 'pro' : 'free';
  const cap = getCalendarSearchesCap(plan);
  return getCalendarSearchesUsed(profile) < cap;
}

/** @param {PlanId|string} plan */
export function getPlanFeatureRows(plan) {
  const isPro = plan === 'pro';
  const f = getPlanLimits(plan);
  return [
    { key: 'credits', label: 'AI credits', value: isPro ? `${f.maxLiveRunsPerMonth}/mo` : `${f.maxSearchesLifetime} lifetime` },
    { key: 'objects', label: 'Objects', value: isPro ? 'Unlimited' : String(f.maxObjects) },
    { key: 'storage', label: 'Storage', value: f.storageLabel },
    { key: 'agents', label: 'Agents', value: '3 credits/call' },
    { key: 'calendar', label: 'Calendar', value: isPro ? `${f.calendarSearchesCap}/mo` : `${f.calendarSearchesCap} use` },
    { key: 'weather', label: 'Forecast', value: isPro ? 'Unlimited · 50 inserts' : '1 city · 1 insert' },
    { key: 'launchRadar', label: 'Launch Radar', value: isPro ? '2 credits/scan' : 'Demo' },
    { key: 'marketHype', label: 'Market Hype', value: isPro ? 'Social Hype agent' : 'Pro only' },
    { key: 'youtube', label: 'YouTube notes', value: isPro ? 'Included' : '1 credit/embed' },
  ];
}

/**
 * Management catalog: Feature | Free (Starter) | Pro — from PLAN_LIMITS.
 * @returns {Array<{ key: string, label: string, free: string, pro: string }>}
 */
export function getPlanFeatureMatrix() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;
  return [
    {
      key: 'credits',
      label: 'Credits / month (or lifetime free)',
      free: `${free.maxSearchesLifetime} lifetime`,
      pro: `${pro.maxLiveRunsPerMonth}/mo`,
    },
    {
      key: 'tokens',
      label: 'Tokens',
      free: formatTokenCount(free.tokensCap),
      pro: `${formatTokenCount(pro.tokensCap)}/mo`,
    },
    {
      key: 'objects',
      label: 'Objects / companies',
      free: String(free.maxObjects),
      pro: 'Unlimited',
    },
    {
      key: 'storage',
      label: 'Storage',
      free: free.storageLabel,
      pro: pro.storageLabel,
    },
    {
      key: 'intel',
      label: 'Intel searches',
      free: `${free.maxSearchesLifetime} lifetime`,
      pro: 'Via credits',
    },
    {
      key: 'calendar',
      label: 'Calendar uses',
      free: `${free.calendarSearchesCap} use`,
      pro: `${pro.calendarSearchesCap}/mo`,
    },
    {
      key: 'weather',
      label: 'Weather',
      free: '1 city · 1 insert',
      pro: 'Unlimited · 50 inserts',
    },
    {
      key: 'campaignLive',
      label: 'Campaign live runs',
      free: String(free.campaignLiveRuns),
      pro: `${pro.maxLiveRunsPerMonth}/mo (credits)`,
    },
    {
      key: 'launchRadar',
      label: 'Launch Radar / agents',
      free: 'Demo · 3 credits/call',
      pro: '2 credits/scan · 3 credits/call',
    },
    {
      key: 'stepsLibrary',
      label: 'Steps library cross-object',
      free: free.stepsLibraryCrossObject ? 'Yes' : 'No',
      pro: pro.stepsLibraryCrossObject ? 'Yes' : 'No',
    },
  ];
}
