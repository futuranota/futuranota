import { supabase } from './supabaseClient.js';

function splitCampaignName(campaignName) {
  const [name, sector] = (campaignName || '').split('·').map((part) => part.trim());
  return { name: name || campaignName || 'Untitled', sector: sector || '' };
}

function extractNodeText(nodes, hash) {
  const row = (nodes || []).find((n) => n.hash === hash);
  return typeof row?.text === 'string' ? row.text.trim() : '';
}

/**
 * Companies/campaigns available to track in the in-app selector ("Which
 * company are you tracking?"). Backed by hero_signals — published campaigns
 * inject cadence, overview, and dates into Launch Radar.
 */
export async function fetchSignalCompanies() {
  const { data, error } = await supabase
    .from('hero_signals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((s) => {
    const parsed = splitCampaignName(s.campaign_name);
    const name = (s.brand_name || parsed.name || '').trim() || 'Untitled';
    const category = (extractNodeText(s.nodes, 'category') || parsed.sector || '').trim();
    const overview = (extractNodeText(s.nodes, 'overview') || (typeof s.overview === 'string' ? s.overview.trim() : ''));

    return {
      id: s.id,
      name,
      sector: category,
      status: s.active ? 'ACTIVE' : 'STANDBY',
      campaigns: 1,
      signal: s.window_progress ?? 0,
      launchDate: s.launch_date || null,
      announcementDate: s.announcement_date || null,
      lastLaunchDate: s.last_launch_date || null,
      averageIntervalMonths: s.average_interval_months ?? null,
      overview,
    };
  });
}
