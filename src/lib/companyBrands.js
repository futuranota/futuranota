import { supabase } from './supabaseClient.js';

/**
 * Distinct brand/company names across all users' corpus objects, for bulk
 * admin scans. Relies on the current permissive RLS on `companies`
 * ("Permitir todo a todos") — admin-only usage.
 * @returns {Promise<string[]>}
 */
export async function fetchCompanyBrandCandidates() {
  const { data, error } = await supabase
    .from('companies')
    .select('name, brand');
  if (error) throw error;

  const seen = new Set();
  const brands = [];
  for (const row of data ?? []) {
    const candidate = (row.brand || row.name || '').trim();
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    brands.push(candidate);
  }
  return brands.sort((a, b) => a.localeCompare(b));
}
