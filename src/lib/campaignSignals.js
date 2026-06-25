import { supabase } from './supabaseClient.js';
import { publishCampaignSignalToHero } from './publishToHero.js';

/** @typedef {'pending' | 'published'} CampaignSignalStatus */

export async function fetchPendingCampaignSignals() {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
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
  if (error) throw error;
  return data;
}

export async function updateCampaignSignal(id, payload) {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCampaignSignal(id) {
  const { error } = await supabase.from('signal_campaigns').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Publishes a queue row to hero_signals and marks it published so it leaves
 * the Horizon Scan / Campaign Detector queue.
 * @param {Object} signal row from signal_campaigns
 */
export async function promoteCampaignSignal(signal) {
  await publishCampaignSignalToHero(signal);
  return updateCampaignSignal(signal.id, { status: 'published', active: false });
}

/** @deprecated Use promoteCampaignSignal — radio toggle is not the queue workflow */
export async function setActiveCampaignSignal(id) {
  const { error } = await supabase.from('signal_campaigns').update({ active: false }).neq('id', id);
  if (error) throw error;
  return updateCampaignSignal(id, { active: true });
}
