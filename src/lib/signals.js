import { supabase } from './supabaseClient.js';

export async function fetchActiveSignal() {
  const { data, error } = await supabase
    .from('hero_signals')
    .select('*')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllSignals() {
  const { data, error } = await supabase
    .from('hero_signals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSignal(payload) {
  const { data, error } = await supabase.from('hero_signals').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateSignal(id, payload) {
  const { data, error } = await supabase
    .from('hero_signals')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSignal(id) {
  const { error } = await supabase.from('hero_signals').delete().eq('id', id);
  if (error) throw error;
}

export async function markSignalActive(id) {
  return updateSignal(id, { active: true });
}

export async function setActiveSignal(id) {
  const { error } = await supabase.from('hero_signals').update({ active: false }).neq('id', id);
  if (error) throw error;
  return updateSignal(id, { active: true });
}

export function timeAgoLabel(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
