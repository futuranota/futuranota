/**
 * Plan limits & token costs — docs/planes-costos-propuesta.md
 */

/** @typedef {'free'|'pro'} PlanId */

import { CREDIT_TOKEN_UNIT } from "./intelModels.js";

export { CREDIT_TOKEN_UNIT };

export const TOKEN_COSTS = {
  campaignLive: 10_000,
  cadenceLive: 1_000,
  /** Legacy flat cost — Intel search uses per-model tokenCost in intelModels.js */
  searchOverview: 10_000,
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
    weatherNodeActionsCap: 2,
    weatherCityChangesCap: 5,
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
    weatherNodeActionsCap: 50,
    weatherCityChangesCap: 50,
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
  return Math.min(getCreditsCap('pro'), Math.floor(spent / CREDIT_TOKEN_UNIT));
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
    { key: 'credits', label: 'AI credits', value: isPro ? `${f.maxLiveRunsPerMonth}/mo` : `${f.maxSearchesLifetime} lifetime` },
    { key: 'objects', label: 'Objects', value: isPro ? 'Unlimited' : String(f.maxObjects) },
    { key: 'storage', label: 'Storage', value: f.storageLabel },
    { key: 'searches', label: 'AI searches', value: isPro ? `${f.maxLiveRunsPerMonth} live/mo` : `${f.maxSearchesLifetime} lifetime` },
    { key: 'calendar', label: 'Calendar', value: isPro ? 'Advanced' : `${f.calendarUsesAllowed} use` },
    { key: 'weather', label: 'Forecast', value: isPro ? `${f.weatherNodeActionsCap} nodes · ${f.weatherCityChangesCap} cities/day` : `${f.weatherNodeActionsCap} nodes · ${f.weatherCityChangesCap} cities/day` },
    { key: 'campaign', label: 'Campaign study', value: isPro ? `${f.maxLiveRunsPerMonth} live/mo` : `${f.campaignLiveRuns} live (frozen)` },
    { key: 'library', label: 'Library switch', value: '0 credits' },
  ];
}
