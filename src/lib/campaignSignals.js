import { supabase, getSupabaseConfigError, formatSupabaseError } from './supabaseClient.js';
import { publishCampaignSignalToHero } from './publishToHero.js';
import { campaignSignalFieldsToPayload } from './campaignSignalFields.js';

/** @typedef {'pending' | 'published'} CampaignSignalStatus */

export async function fetchPendingCampaignSignals() {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'Load signal_campaigns');
  return data ?? [];
}

/** @deprecated Use fetchPendingCampaignSignals for admin queue views */
export async function fetchAllCampaignSignals() {
  return fetchPendingCampaignSignals();
}

export async function createCampaignSignal(payload) {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .insert({ ...payload, status: 'pending' })
    .select()
    .single();
  throwIfSupabaseError(error, 'Create signal_campaigns');
  return data;
}

export async function updateCampaignSignal(id, payload) {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  throwIfSupabaseError(error, 'Update signal_campaigns');
  return data;
}

export async function deleteCampaignSignal(id) {
  const { error } = await supabase.from('signal_campaigns').delete().eq('id', id);
  if (error) throw error;
}

async function requireAuthSession() {
  const configError = getSupabaseConfigError();
  if (configError) throw new Error(configError);

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(formatSupabaseError(error, 'Auth session'));
  if (!session) {
    throw new Error('Sesión expirada — volvé a iniciar sesión en /panel para guardar.');
  }
  return session;
}

function throwIfSupabaseError(error, action) {
  if (error) throw new Error(formatSupabaseError(error, action));
}

/** @param {string} id */
async function markCampaignSignalPublished(id) {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .update({
      status: 'published',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error, 'Mark signal_campaigns published'));
  return data;
}

/**
 * Saves review form fields, publishes to hero_signals, marks queue row published.
 * @param {Record<string, unknown>} fields editable campaign signal fields
 * @param {string|null} [editId]
 */
export async function saveAndPublishCampaignFields(fields, editId = null) {
  await requireAuthSession();
  const payload = campaignSignalFieldsToPayload(fields);
  if (!payload.brand_name) {
    throw new Error('Company name is required');
  }

  const signal = editId
    ? await updateCampaignSignal(editId, payload)
    : await createCampaignSignal(payload);
  await promoteCampaignSignal(signal);
  return signal;
}

/**
 * Publishes a queue row to hero_signals and marks it published so it leaves
 * the Horizon Scan / Campaign Detector queue.
 * @param {Object} signal row from signal_campaigns
 */
export async function promoteCampaignSignal(signal) {
  await requireAuthSession();
  await publishCampaignSignalToHero(signal);
  return markCampaignSignalPublished(signal.id);
}

/** @deprecated Use promoteCampaignSignal — radio toggle is not the queue workflow */
export async function setActiveCampaignSignal(id) {
  const { error } = await supabase.from('signal_campaigns').update({ active: false }).neq('id', id);
  if (error) throw error;
  return updateCampaignSignal(id, { active: true });
}
