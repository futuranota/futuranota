import { buildCampaignOverview } from './campaignOverview.js';

export const EMPTY_CAMPAIGN_SIGNAL_FIELDS = {
  brandName: '',
  category: '',
  campaignActive: false,
  launchDate: '',
  overview: '',
  averageIntervalMonths: '',
  lastLaunchDate: '',
  source: '',
};

/** Builds editable preview fields from a Groq detection/scan result. */
export function campaignSignalFieldsFromDetection(brandName, result) {
  const overview = buildCampaignOverview({
    brandName,
    campaignActive: Boolean(result.campaignActive),
    averageIntervalMonths: result.averageIntervalMonths,
    lastLaunchDate: result.lastLaunchDate,
  });
  return {
    brandName,
    category: result.category || '',
    campaignActive: Boolean(result.campaignActive),
    launchDate: result.launchDate || '',
    overview,
    averageIntervalMonths: result.averageIntervalMonths ?? '',
    lastLaunchDate: result.lastLaunchDate || '',
    source: result.source || '',
  };
}

/** Builds editable preview fields from an existing saved signal_campaigns row. */
export function campaignSignalFieldsFromRow(signal) {
  return {
    brandName: signal.brand_name,
    category: signal.category || '',
    campaignActive: signal.campaign_active,
    launchDate: signal.launch_date || '',
    overview: signal.overview || '',
    averageIntervalMonths: signal.average_interval_months ?? '',
    lastLaunchDate: signal.last_launch_date || '',
    source: signal.source || '',
  };
}

/** Maps editable fields back to a signal_campaigns row payload. */
export function campaignSignalFieldsToPayload(fields) {
  return {
    brand_name: fields.brandName.trim(),
    category: fields.category.trim() || null,
    campaign_active: fields.campaignActive,
    launch_date: fields.campaignActive && fields.launchDate ? fields.launchDate : null,
    overview: fields.overview.trim(),
    average_interval_months: fields.averageIntervalMonths === '' ? null : Number(fields.averageIntervalMonths),
    last_launch_date: fields.lastLaunchDate || null,
    source: fields.source || null,
  };
}
