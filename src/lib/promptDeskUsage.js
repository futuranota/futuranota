import { supabase } from './supabaseClient.js';
import { PROMPT_LIMIT_COPY, PROMPT_LIMITS_ENFORCED } from './promptPlanLimits.js';

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
