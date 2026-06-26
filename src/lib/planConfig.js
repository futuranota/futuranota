/**
 * Plan limits & token costs — docs/planes-costos-propuesta.md
 */

/** @typedef {'free'|'pro'} PlanId */

export const TOKEN_COSTS = {
  campaignLive: 10_000,
  cadenceLive: 1_000,
  searchOverview: 1_000,
  aiChat: 500,
};

export const PLAN_LIMITS = {
  free: {
    id: 'free',
    label: 'Starter',
    tokensCap: 10_000,
    tokensRenewable: false,
    maxObjects: 1,
    maxImportBytes: 54 * 1024 * 1024,
    maxSearchesLifetime: 10,
    calendarUsesAllowed: 1,
    weatherUsesAllowed: 1,
    campaignLiveRuns: 1,
    storageLabel: '54 MB',
    storageBytes: 54 * 1024 * 1024,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    tokensCap: 1_500_000,
    tokensRenewable: true,
    maxObjects: Infinity,
    maxImportBytes: 5 * 1024 * 1024 * 1024,
    maxLiveRunsPerMonth: 150,
    calendarUsesAllowed: Infinity,
    weatherUsesAllowed: Infinity,
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

/** @param {PlanId|string} plan */
export function getPlanLimits(plan) {
  return plan === 'pro' ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

/** @param {PlanId|string} plan */
export function getTokensCap(plan) {
  return getPlanLimits(plan).tokensCap;
}

/** @param {number} n */
export function formatTokenCount(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

/** @param {PlanId|string} plan */
export function getPlanFeatureRows(plan) {
  const isPro = plan === 'pro';
  const f = getPlanLimits(plan);
  return [
    { key: 'tokens', label: 'Tokens', value: isPro ? `${formatTokenCount(f.tokensCap)}/mo` : `${formatTokenCount(f.tokensCap)} welcome` },
    { key: 'objects', label: 'Objects', value: isPro ? 'Unlimited' : String(f.maxObjects) },
    { key: 'storage', label: 'Storage', value: f.storageLabel },
    { key: 'searches', label: 'AI searches', value: isPro ? `${f.maxLiveRunsPerMonth} live/mo` : `${f.maxSearchesLifetime} lifetime` },
    { key: 'calendar', label: 'Calendar', value: isPro ? 'Advanced' : `${f.calendarUsesAllowed} use` },
    { key: 'weather', label: 'Forecast', value: isPro ? 'Unlimited' : `${f.weatherUsesAllowed} use` },
    { key: 'campaign', label: 'Campaign study', value: isPro ? `${f.maxLiveRunsPerMonth} live/mo` : `${f.campaignLiveRuns} live (frozen)` },
    { key: 'library', label: 'Library switch', value: '0 tokens' },
  ];
}
