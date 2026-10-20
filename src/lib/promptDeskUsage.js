import { supabase } from './supabaseClient.js';
import {
  FREE_PROMPT_LIMITS,
  PROMPT_LIMIT_COPY,
  PROMPT_LIMITS_ENFORCED,
  deskPlan,
  isDeskFreePreview,
  localDayKey,
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

/** Count for the local day. A different day reads as 0. Does not spend. */
export function embedCountForDay(row, day) {
  if (!row || !day) return 0;
  const key = String(row.embed_day || '').slice(0, 10);
  if (key !== day) return 0;
  return Math.max(0, Number(row.embed_count) || 0);
}

function previewEmbedKey(email, day) {
  return `fn-desk-embeds:${String(email || '').trim().toLowerCase()}:${day}`;
}

const previewEmbedMemory = new Map();

/** Copy-embed boxes already spent today on this browser. */
export function readPreviewEmbeds(email, day = localDayKey()) {
  const key = previewEmbedKey(email, day);
  try {
    const raw = localStorage.getItem(key);
    const used = Number(raw);
    if (Number.isFinite(used) && used > 0) return used;
  } catch {
    /* Private mode can block storage. Use the in-memory count. */
  }
  return previewEmbedMemory.get(key) || 0;
}

function writePreviewEmbeds(email, day, used) {
  const key = previewEmbedKey(email, day);
  previewEmbedMemory.set(key, used);
  try {
    localStorage.setItem(key, String(used));
  } catch {
    /* Private mode can block storage. The in-memory count still updates the card. */
  }
}

/** Spend one Copy embed on the free preview login. Resets on the next local day. */
export function spendPreviewEmbed(email, day = localDayKey()) {
  const cap = FREE_PROMPT_LIMITS.maxEmbedBoxesPerDay;
  const used = readPreviewEmbeds(email, day);
  if (used >= cap) return { ok: false, reason: 'limit', embedCount: used };
  const embedCount = used + 1;
  writePreviewEmbeds(email, day, embedCount);
  return { ok: true, embedCount };
}

/** Read today's embed boxes. Opening the page does not spend a box. */
export async function readPromptEmbedDay(day) {
  if (!PROMPT_LIMITS_ENFORCED) return { ok: true, unlimited: true, embedCount: 0 };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, reason: 'auth' };
  const { data, error } = await supabase
    .from('prompt_desk_usage')
    .select('embed_day, embed_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, reason: 'error' };
  return { ok: true, embedCount: embedCountForDay(data, day) };
}

/**
 * Desk-facing read. Preview (and RPC failures) use the browser day count
 * so a Pro profile row cannot hide the free 3/day meter.
 */
export async function readDeskEmbedDay(account, day = localDayKey()) {
  const email = account?.email || '';
  const profilePlan = account?.profilePlan;
  if (deskPlan(email, profilePlan) === 'pro') {
    return { ok: true, unlimited: true, embedCount: 0 };
  }
  const local = readPreviewEmbeds(email, day);
  if (isDeskFreePreview(email)) {
    return { ok: true, embedCount: local };
  }
  const remote = await readPromptEmbedDay(day);
  if (!remote.ok || remote.unlimited) {
    return { ok: true, embedCount: local };
  }
  return { ok: true, embedCount: Math.max(Number(remote.embedCount) || 0, local) };
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

/**
 * Spend one Copy embed. Preview stays on the browser day key even if
 * profiles.plan is pro. Other free accounts try the RPC, then the same key.
 */
export async function spendDeskEmbedBox(account, day = localDayKey()) {
  const email = account?.email || '';
  const profilePlan = account?.profilePlan;
  if (deskPlan(email, profilePlan) === 'pro') {
    return { ok: true, unlimited: true, embedCount: 0 };
  }
  if (isDeskFreePreview(email)) {
    return spendPreviewEmbed(email, day);
  }
  const remote = await addPromptEmbedBox(day);
  if (remote.ok && !remote.unlimited) {
    writePreviewEmbeds(email, day, remote.embedCount);
    return remote;
  }
  if (remote.reason === 'limit') return remote;
  return spendPreviewEmbed(email, day);
}
