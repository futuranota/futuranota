import { supabase } from './supabaseClient.js';

function splitCampaignName(campaignName) {
  const [name, sector] = (campaignName || '').split('·').map((part) => part.trim());
  return { name: name || campaignName || 'Untitled', sector: sector || '' };
}

/**
 * Companies/campaigns available to track in the in-app selector ("Which
 * company are you tracking?"). Backed entirely by hero_signals — anything
 * activated from Horizon Scan / Campaign Detector / the Signals tab shows up
 * here, replacing the old static demo list.
 */
export async function fetchSignalCompanies() {
  const { data, error } = await supabase
    .from('hero_signals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((s) => {
    const { name, sector } = splitCampaignName(s.campaign_name);
    return {
      id: s.id,
      name,
      sector,
      status: s.active ? 'ACTIVE' : 'STANDBY',
      campaigns: 1,
      signal: s.window_progress ?? 0,
    };
  });
}
