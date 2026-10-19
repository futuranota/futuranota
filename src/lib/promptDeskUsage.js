import { supabase } from './supabaseClient.js';
import {
  FREE_PROMPT_LIMITS,
  PROMPT_LIMIT_COPY,
  PROMPT_LIMITS_ENFORCED,
  deskPlan,
  isDeskFreePreview,
} from './promptPlanLimits.js';

function payloadOf(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return typeof data === 'object' ? data : null;
}

/** @returns {Promise<number|null>} null when the usage row cannot be read */
export async function readPromptToolCalls(userId) {
  if (!userId) return 0;
  const { data, error } = await supabase
    .from('prompt_desk_usage')
    .select('tool_calls')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return Number(data?.tool_calls) || 0;
}

function previewClickKey(email) {
  return `fn-desk-clicks:${String(email || '').trim().toLowerCase()}`;
}

/** Clicks already spent by the free-preview login on this browser. */
export function readPreviewClicks(email) {
  try {
    const raw = localStorage.getItem(previewClickKey(email));
    const used = Number(raw);
    return Number.isFinite(used) && used > 0 ? used : 0;
  } catch {
    return 0;
  }
}

function writePreviewClicks(email, used) {
  try {
    localStorage.setItem(previewClickKey(email), String(used));
  } catch {
    // Private mode can block storage. The in-memory count still disables the buttons.
  }
}

/**
 * @param {{ userId?: string, email?: string, profilePlan?: string }} account
 * @returns {Promise<number|null>}
 */
export async function readDeskToolCalls(account) {
  const email = account?.email || '';
  const profilePlan = account?.profilePlan;
  if (isDeskFreePreview(email)) return readPreviewClicks(email);
  if (deskPlan(email, profilePlan) === 'pro') return 0;
  const remote = await readPromptToolCalls(account?.userId);
  if (remote == null) return readPreviewClicks(email);
  return remote;
}

/**
 * Spend one free click. The preview login is counted in the browser.
 * Other free accounts use the lifetime counter. Pro does not spend.
 * @param {{ userId?: string, email?: string, profilePlan?: string }} account
 */
export async function spendDeskToolCall(account) {
  const email = account?.email || '';
  const profilePlan = account?.profilePlan;
  if (isDeskFreePreview(email)) {
    const cap = FREE_PROMPT_LIMITS.maxToolCalls;
    const used = readPreviewClicks(email);
    if (used >= cap) return { ok: false, reason: 'limit', toolCalls: used };
    const toolCalls = used + 1;
    writePreviewClicks(email, toolCalls);
    return { ok: true, toolCalls };
  }
  if (deskPlan(email, profilePlan) === 'pro') {
    return { ok: true, unlimited: true, toolCalls: 0 };
  }
  const remote = await consumePromptToolCall();
  if (remote.reason === 'error') {
    const cap = FREE_PROMPT_LIMITS.maxToolCalls;
    const used = readPreviewClicks(email);
    if (used >= cap) return { ok: false, reason: 'limit', toolCalls: used };
    const toolCalls = used + 1;
    writePreviewClicks(email, toolCalls);
    return { ok: true, toolCalls };
  }
  return remote;
}

/** Spend one lifetime quick-tool call. Pro stays unlimited. */
export async function consumePromptToolCall() {
  if (!PROMPT_LIMITS_ENFORCED) return { ok: true, unlimited: true, toolCalls: 0 };
  const { data, error } = await supabase.rpc('consume_prompt_tool_call');
  if (error) return { ok: false, reason: 'error', message: PROMPT_LIMIT_COPY.usage };
  const payload = payloadOf(data);
  if (!payload?.ok) {
    return {
      ok: false,
      reason: payload?.reason || 'limit',
      message: payload?.reason === 'auth' ? 'Sign in to use this tool.' : PROMPT_LIMIT_COPY.tools,
    };
  }
  return { ok: true, unlimited: Boolean(payload.unlimited), toolCalls: Number(payload.toolCalls) || 0 };
}

/** The open embed page claims the first box of the local day. */
export async function touchPromptEmbedDay(day) {
  if (!PROMPT_LIMITS_ENFORCED) return { ok: true, unlimited: true, embedCount: 0 };
  const { data, error } = await supabase.rpc('touch_prompt_embed_day', { p_day: day });
  if (error) return { ok: false, reason: 'error' };
  const payload = payloadOf(data);
  if (!payload?.ok) return { ok: false, reason: payload?.reason || 'limit' };
  return {
    ok: true,
    unlimited: Boolean(payload.unlimited),
    embedCount: Number(payload.embedCount) || 0,
  };
}

/** Add one embed box for the local day. */
export async function addPromptEmbedBox(day) {
  if (!PROMPT_LIMITS_ENFORCED) return { ok: true, unlimited: true, embedCount: 0 };
  const { data, error } = await supabase.rpc('add_prompt_embed_box', { p_day: day });
  if (error) return { ok: false, reason: 'error', message: PROMPT_LIMIT_COPY.usage };
  const payload = payloadOf(data);
  if (!payload?.ok) {
    return { ok: false, reason: payload?.reason || 'limit', message: PROMPT_LIMIT_COPY.embed };
  }
  return {
    ok: true,
    unlimited: Boolean(payload.unlimited),
    embedCount: Number(payload.embedCount) || 0,
  };
}
