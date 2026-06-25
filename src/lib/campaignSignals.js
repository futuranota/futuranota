import { supabase } from './supabaseClient.js';

export async function fetchAllCampaignSignals() {
  const { data, error } = await supabase
    .from('signal_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCampaignSignal(payload) {
  const { data, error } = await supabase.from('signal_campaigns').insert(payload).select().single();
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

export async function setActiveCampaignSignal(id) {
  const { error } = await supabase.from('signal_campaigns').update({ active: false }).neq('id', id);
  if (error) throw error;
  return updateCampaignSignal(id, { active: true });
}
