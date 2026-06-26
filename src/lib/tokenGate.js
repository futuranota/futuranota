import { getPlanLimits, getTokensCap, TOKEN_COSTS } from './planConfig.js';

/**
 * @typedef {Object} TokenProfile
 * @property {'free'|'pro'} plan
 * @property {number} tokensBalance
 * @property {boolean} [campaignLiveUsed]
 */

/**
 * @param {TokenProfile} profile
 * @param {number} amount
 */
export function canSpendTokens(profile, amount) {
  if (!profile || amount <= 0) return true;
  return (profile.tokensBalance ?? 0) >= amount;
}

/**
 * @param {TokenProfile} profile
 * @param {'campaignLive'|'searchOverview'|'cadenceLive'|'aiChat'} action
 */
export function canSpendAction(profile, action) {
  const cost = TOKEN_COSTS[action] ?? 0;
  if (profile?.plan === 'free' && action === 'campaignLive' && profile.campaignLiveUsed) {
    return false;
  }
  return canSpendTokens(profile, cost);
}

/**
 * @param {TokenProfile} profile
 */
export function getRemainingTokens(profile) {
  return profile?.tokensBalance ?? getTokensCap(profile?.plan ?? 'free');
}

/**
 * @param {TokenProfile} profile
 */
export function getUsedTokens(profile) {
  const cap = getTokensCap(profile?.plan ?? 'free');
  return Math.max(0, cap - getRemainingTokens(profile));
}
