import { buildCadenceOnlyOverview } from './campaignOverview.js';

export const EMPTY_CAMPAIGN_SIGNAL_FIELDS = {
  brandName: '',
  category: '',
  campaignActive: false,
  launchDate: '',
  announcementDate: '',
  overview: '',
  averageIntervalMonths: '',
  lastLaunchDate: '',
  source: '',
  detectionMode: '',
  confidence: '',
  evidenceUrl: '',
  ticketTier: '',
  cadenceStatus: '',
  cadenceMessage: '',
  monthsRemaining: '',
  estimatedLaunchDate: '',
};

/** Builds editable preview fields from a verified Horizon Scan hit. */
export function campaignSignalFieldsFromDetection(brandName, result) {
  const name = (result.brandName || brandName || '').trim();
  let overview = (result.overview || '').trim();

  if (!overview && result.cadenceMessage) {
    overview = result.cadenceMessage.trim();
  }

  if (!overview && result.detectionMode === 'cadence_only' && result.lastLaunchDate && result.averageIntervalMonths) {
    overview = buildCadenceOnlyOverview({
      brandName: name,
      averageIntervalMonths: Number(result.averageIntervalMonths),
      lastLaunchDate: result.lastLaunchDate,
    });
  }

  return {
    brandName: name,
    category: result.category || '',
    campaignActive: Boolean(result.campaignActive),
    launchDate: result.launchDate || '',
    announcementDate: result.announcementDate || '',
    overview,
    averageIntervalMonths: result.averageIntervalMonths ?? '',
    lastLaunchDate: result.lastLaunchDate || '',
    source: result.source || '',
    detectionMode: result.detectionMode || '',
    confidence: result.confidence ?? '',
    evidenceUrl: result.evidenceUrl || '',
    ticketTier: result.ticketTier || '',
    cadenceStatus: result.cadenceStatus || '',
    cadenceMessage: result.cadenceMessage || '',
    monthsRemaining: result.monthsRemaining ?? '',
    estimatedLaunchDate: result.estimatedLaunchDate || '',
  };
}

/** Builds editable preview fields from an existing saved signal_campaigns row. */
export function campaignSignalFieldsFromRow(signal) {
  return {
    brandName: signal.brand_name,
    category: signal.category || '',
    campaignActive: signal.campaign_active,
    launchDate: signal.launch_date || '',
    announcementDate: signal.announcement_date || '',
    overview: signal.overview || '',
    averageIntervalMonths: signal.average_interval_months ?? '',
    lastLaunchDate: signal.last_launch_date || '',
    source: signal.source || '',
    detectionMode: signal.detection_mode || '',
    confidence: signal.confidence ?? '',
    evidenceUrl: signal.evidence_url || '',
    ticketTier: signal.ticket_tier || '',
  };
}

/** Maps editable fields back to a signal_campaigns row payload. */
export function campaignSignalFieldsToPayload(fields) {
  return {
    brand_name: fields.brandName.trim(),
    category: fields.category.trim() || null,
    campaign_active: fields.campaignActive,
    launch_date: fields.campaignActive && fields.launchDate ? fields.launchDate : null,
    announcement_date: fields.announcementDate || null,
    overview: fields.overview.trim(),
    average_interval_months: fields.averageIntervalMonths === '' ? null : Number(fields.averageIntervalMonths),
    last_launch_date: fields.lastLaunchDate || null,
    source: fields.source || null,
    detection_mode: fields.detectionMode || null,
    confidence: fields.confidence === '' ? null : Number(fields.confidence),
    evidence_url: fields.evidenceUrl || null,
    ticket_tier: fields.ticketTier || null,
  };
}
