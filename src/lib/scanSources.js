import { supabase } from './supabaseClient.js';
import seedFile from '../../content/admin/scan-sources.json';

function rowToSource(row) {
  return {
    id: row.id,
    label: row.label,
    domain: row.domain,
    pathPrefix: row.path_prefix || '',
    tier: row.tier || 'primary',
    categories: row.categories || [],
    enabled: row.enabled !== false,
  };
}

function sourceToRow(source) {
  return {
    label: source.label.trim(),
    domain: source.domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    path_prefix: (source.pathPrefix || '').trim(),
    tier: source.tier === 'secondary' ? 'secondary' : 'primary',
    categories: Array.isArray(source.categories) ? source.categories : [],
    enabled: source.enabled !== false,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchAllScanSources() {
  const { data, error } = await supabase
    .from('intel_scan_sources')
    .select('*')
    .order('label', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToSource);
}

export async function createScanSource(source) {
  const { data, error } = await supabase
    .from('intel_scan_sources')
    .insert(sourceToRow(source))
    .select()
    .single();
  if (error) throw error;
  return rowToSource(data);
}

export async function updateScanSource(id, source) {
  const { data, error } = await supabase
    .from('intel_scan_sources')
    .update(sourceToRow(source))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToSource(data);
}

export async function deleteScanSource(id) {
  const { error } = await supabase.from('intel_scan_sources').delete().eq('id', id);
  if (error) throw error;
}

/** Fallback when Supabase table is not migrated yet. */
export async function fetchScanSourcesWithFallback() {
  try {
    const rows = await fetchAllScanSources();
    if (rows.length > 0) return rows;
  } catch {
    // table may not exist
  }

  return (seedFile.sources || []).map((s, i) => ({
    id: s.id || `file-${i}`,
    label: s.label,
    domain: s.domain,
    pathPrefix: s.pathPrefix || '',
    tier: s.tier || 'primary',
    categories: s.categories || [],
    enabled: s.enabled !== false,
  }));
}
