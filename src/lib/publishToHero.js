import { createSignal, updateSignal, markSignalActive } from './signals.js';
import { supabase } from './supabaseClient.js';

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Derives the Hero card's window fields (progress %, opens/closes labels)
 * from a launch_date, assuming a generic 30-day ship window ending at
 * launch. Admin can fine-tune these afterward in the "Signals" tab —
 * this just gets a reasonable default onto the live card immediately.
 * @param {string|null} launchDateIso
 */
function deriveWindowFields(launchDateIso) {
  if (!launchDateIso) {
    return { window_progress: 50, opens_label: 'opens now', closes_label: 'TBD' };
  }

  const launch = new Date(`${launchDateIso}T12:00:00`);
  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilLaunch = Math.round((launch.getTime() - today.getTime()) / msPerDay);
  const daysIntoWindow = DEFAULT_WINDOW_DAYS - daysUntilLaunch;

  const window_progress = Math.max(0, Math.min(100, Math.round((daysIntoWindow / DEFAULT_WINDOW_DAYS) * 100)));
  const opens_label = daysUntilLaunch <= DEFAULT_WINDOW_DAYS ? 'opens now' : `opens in ${daysUntilLaunch - DEFAULT_WINDOW_DAYS}d`;
  const closes_label = daysUntilLaunch >= 0 ? `closes in ${daysUntilLaunch}d` : 'closed';

  return { window_progress, opens_label, closes_label };
}

/**
 * Turns a signal_campaigns row into hero_signals nodes (hash + text pairs)
 * shown on the landing Hero card.
 * @param {{ category?: string, overview?: string, launch_date?: string|null }} signal
 */
function buildNodes(signal) {
  const nodes = [];
  if (signal.category) {
    nodes.push({ hash: 'category', text: signal.category });
  }
  if (signal.announcement_date) {
    nodes.push({ hash: 'announce', text: `Announce ${signal.announcement_date}` });
  }
  if (signal.launch_date) {
    nodes.push({ hash: 'launch', text: `Launch ${signal.launch_date}` });
  }
  if (signal.overview) {
    nodes.push({ hash: 'overview', text: signal.overview.slice(0, 120) });
  }
  return nodes.slice(0, 4);
}

function heroPayloadFromCampaignSignal(signal) {
  const { window_progress, opens_label, closes_label } = deriveWindowFields(signal.launch_date);
  const brandName = (signal.brand_name || '').trim();
  const campaignName = signal.category ? `${brandName} · ${signal.category}` : brandName;

  return {
    detected_label: 'CAMPAIGN DETECTED',
    campaign_name: campaignName,
    window_label: 'SHIP WINDOW',
    window_progress,
    opens_label,
    closes_label,
    nodes: buildNodes(signal),
    brand_name: brandName || null,
    launch_date: signal.launch_date || null,
    announcement_date: signal.announcement_date || null,
    last_launch_date: signal.last_launch_date || null,
    average_interval_months: signal.average_interval_months ?? null,
  };
}

function isMissingColumnError(error) {
  const msg = error?.message || '';
  return msg.includes('schema cache') || msg.includes('column') || msg.includes('does not exist');
}

/** @param {Record<string, unknown>} payload */
function coreHeroPayload(payload) {
  return {
    detected_label: payload.detected_label,
    campaign_name: payload.campaign_name,
    window_label: payload.window_label,
    window_progress: payload.window_progress,
    opens_label: payload.opens_label,
    closes_label: payload.closes_label,
    nodes: payload.nodes,
    active: payload.active,
  };
}

async function findExistingHeroRow(brandName, campaignName) {
  if (brandName) {
    const byBrand = await supabase
      .from('hero_signals')
      .select('id')
      .eq('brand_name', brandName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byBrand.error && byBrand.data?.id) return byBrand.data;
    if (byBrand.error && !isMissingColumnError(byBrand.error)) throw byBrand.error;
  }

  const byCampaign = await supabase
    .from('hero_signals')
    .select('id')
    .eq('campaign_name', campaignName)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byCampaign.error) throw byCampaign.error;
  return byCampaign.data;
}

async function writeHeroRow(id, payload, isUpdate) {
  const full = { ...payload, active: true };
  const attempt = isUpdate
    ? updateSignal(id, full)
    : createSignal(full);

  try {
    return await attempt;
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const minimal = coreHeroPayload(full);
    return isUpdate ? updateSignal(id, minimal) : createSignal(minimal);
  }
}

/**
 * Publishes a signal_campaigns row to hero_signals (Librería + Launch Radar).
 * Multiple campaigns may stay active at once — does not deactivate others.
 * Upserts by brand_name (or campaign_name fallback).
 * @param {Object} signal a row from signal_campaigns (snake_case, as read from Supabase)
 */
export async function publishCampaignSignalToHero(signal) {
  const payload = heroPayloadFromCampaignSignal(signal);
  const brandName = payload.brand_name;
  const campaignName = payload.campaign_name;

  const existing = await findExistingHeroRow(brandName, campaignName);

  if (existing?.id) {
    const updated = await writeHeroRow(existing.id, payload, true);
    await markSignalActive(updated.id);
    return updated;
  }

  const hero = await writeHeroRow(null, payload, false);
  await markSignalActive(hero.id);
  return hero;
}
