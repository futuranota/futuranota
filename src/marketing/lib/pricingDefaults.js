/** @typedef {{ title: string, detail: string, tagline?: string, locked?: boolean }} PricingFeature */

/** @type {Record<string, unknown>} */
export const PRICING_SECTION_DEFAULT = {
  eyebrow: 'PRICING',
  title: 'Pricing that Scales with You',
  lead: 'Choose the right plan to unlock powerful tools and insights. Transparent pricing built for makers and founders.',
  trust: 'No credit card on Starter · Pro is $5/mo · Cancel anytime',
};

/** @type {Record<string, unknown>[]} */
export const PRICING_PLANS_DEFAULT = [
  {
    id: 'free',
    name: 'Starter',
    shortName: 'Free',
    desc: 'Best for testing your first launch window — while credits last.',
    price: '0',
    priceSuffix: '/mo',
    billingNote: 'No credit card is required',
    cta: 'Get Started',
    bullets: [
      '1 corpus · 5 MB storage',
      '10 AI search credits (one-time)',
      'YouTube note taker while credits last',
      'Calendar & Forecast — one use each',
      'Launch Radar demo · Market Hype locked',
    ],
    featureGroups: [
      {
        title: 'Features & tools',
        features: [
          { title: 'Objects & Storage', detail: '1 corpus / 5 MB' },
          { title: 'AI Search Credits', detail: '10 credits total (one-time)' },
          { title: 'YouTube Note Taker', detail: 'Available while credits remain.' },
          {
            title: 'Calendar',
            detail: 'One-time use (0/1).',
          },
          {
            title: 'Forecast (Weather API)',
            detail: 'One fixed city · one node insert (0/1).',
          },
          { title: 'Launch Radar', detail: 'Demo preview only.', locked: true },
          { title: 'Market Hype & Active Campaigns', detail: 'Pro only.', locked: true },
          { title: 'Search Intent & Keywords', detail: 'Locked.', locked: true },
          { title: 'Technical Export', detail: 'Not available.', locked: true },
        ],
      },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    shortName: 'Pro Monthly',
    desc: 'Perfect for makers & founders shipping on every campaign window.',
    price: '5',
    priceSuffix: '/mo',
    annualPrice: '99.00',
    annualPriceSuffix: '/yr',
    annualBillingNote: 'Billed annually — save 50%',
    billingNote: 'Recommended for rapid traction',
    badge: 'Recommended',
    cta: 'Get Started',
    secondaryCta: 'Start free trial',
    bullets: [
      '2 corpus · 8 guests · 5 GB storage',
      '200 AI search credits + top-up option',
      'Advanced Calendar cross-referencing',
      'Unlimited Forecast with canvas risk alerts',
      'Active Launch Radar & release predictions',
      'Deep Market Hype & campaign ingestion',
      'Google Trends & search spike detection',
      'Technical export and import.',
    ],
    featureGroups: [
      {
        title: 'Features & tools',
        features: [
          { title: 'Objects & Storage', detail: '2 corpus · 8 guests / 5 GB storage' },
          { title: 'AI Search Credits', detail: '200 credits per month + top-up option' },
          {
            title: 'Calendar',
            detail: 'Advanced Calendar cross-referencing.',
          },
          {
            title: 'Forecast (Weather API)',
            detail: 'Unlimited Forecast with canvas risk alerts.',
          },
          {
            title: 'Launch Radar',
            detail: 'Active Launch Radar & release predictions.',
          },
          {
            title: 'Market Hype & Active Campaigns',
            detail: 'Deep Market Hype & campaign ingestion.',
          },
          {
            title: 'Search Intent & Keywords',
            detail: 'Google Trends & search spike detection.',
          },
          {
            title: 'Technical Export & Import',
            detail: 'Technical export and import.',
          },
        ],
      },
    ],
  },
];

/** @param {Record<string, unknown>} plan */
export function planBullets(plan) {
  if (Array.isArray(plan.bullets) && plan.bullets.length) return plan.bullets;
  const features = plan.featureGroups?.[0]?.features ?? [];
  return features
    .filter((f) => !f.locked)
    .map((f) => (f.detail ? `${f.title}: ${f.detail}` : f.title));
}
