import { createSignal, setActiveSignal } from './signals.js';

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
 * @param {{ category?: string, overview?: string }} signal
 */
function buildNodes(signal) {
  const nodes = [];
  if (signal.category) {
    nodes.push({ hash: 'category', text: signal.category });
  }
  if (signal.overview) {
    nodes.push({ hash: 'overview', text: signal.overview.slice(0, 120) });
  }
  return nodes.slice(0, 4);
}

/**
 * Publishes a signal_campaigns row to the landing Hero ("CAMPAIGN DETECTED"
 * card) by creating a hero_signals row and activating it. This is the bridge
 * between the admin-only signal_campaigns table and the public frontend —
 * before this, activating a campaign signal only flipped a flag nobody saw.
 * @param {Object} signal a row from signal_campaigns (snake_case, as read from Supabase)
 */
export async function publishCampaignSignalToHero(signal) {
  const { window_progress, opens_label, closes_label } = deriveWindowFields(signal.launch_date);

  const hero = await createSignal({
    detected_label: 'CAMPAIGN DETECTED',
    campaign_name: signal.category ? `${signal.brand_name} · ${signal.category}` : signal.brand_name,
    window_label: 'SHIP WINDOW',
    window_progress,
    opens_label,
    closes_label,
    nodes: buildNodes(signal),
    active: false,
  });

  await setActiveSignal(hero.id);
  return hero;
}
