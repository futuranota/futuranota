/** @typedef {{ title: string, detail: string, tagline?: string, locked?: boolean }} PricingFeature */

/** @type {Record<string, unknown>} */
export const PRICING_SECTION_DEFAULT = {
  eyebrow: 'PRICING',
  title: 'Pricing that Scales with You',
  lead: 'Choose the right plan to unlock powerful tools and insights. Transparent pricing built for makers and founders.',
  trust: 'No credit card on Starter · Pro is $20/mo · Cancel anytime',
};

/** @type {Record<string, unknown>[]} */
export const PRICING_PLANS_DEFAULT = [
  {
    id: 'free',
    name: 'Starter',
    shortName: 'Free',
    desc: 'Best for testing & understanding your first launch window.',
    price: '0',
    priceSuffix: '/mo',
    billingNote: 'No credit card is required',
    cta: 'Get Started',
    bullets: [
      '1 Main Object · 54 MB storage',
      '10 AI search credits (one time usage)',
      'Basic Calendar & Forecast (one time usage)',
    ],
    featureGroups: [
      {
        title: 'Features & tools',
        features: [
          { title: 'Objects & Storage', detail: '1 Main Object Max / 54 MB' },
          { title: 'AI Search Credits', detail: '10 credits total (one time usage)' },
          {
            title: 'Calendar',
            tagline: 'Anticipate Every Opportunity: The Ultimate Calendar for Brands That Make a Difference',
            detail: 'One time usage.',
          },
          {
            title: 'Forecast (Weather API)',
            tagline: 'Anticipate Every Opportunity: The Ultimate weather API that gets you ahead of any event.',
            detail: 'One time usage — current day weather data.',
          },
          { title: 'Launch Radar', detail: 'Locked (Demo preview only).', locked: true },
          { title: 'Market Hype & Active Campaigns', detail: 'Shows general Hype Score only.' },
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
    price: '20.00',
    priceSuffix: '/mo',
    annualPrice: '99.00',
    annualPriceSuffix: '/yr',
    annualBillingNote: 'Billed annually — save 50%',
    billingNote: 'Recommended for rapid traction',
    badge: 'Recommended',
    cta: 'Get Started',
    secondaryCta: 'Start free trial',
    bullets: [
      'Unlimited Objects · 10 GB storage',
      '500 AI search credits + top-up option',
      'Advanced Calendar cross-referencing',
      '10-Day Forecast with canvas risk alerts',
      'Active Launch Radar & release predictions',
      'Deep Market Hype & campaign ingestion',
      'Google Trends & search spike detection',
      'Technical export to JSON/CSV for CAD',
    ],
    featureGroups: [
      {
        title: 'Features & tools',
        features: [
          { title: 'Objects & Storage', detail: 'Unlimited Objects / 10 GB Storage (For assets & renders)' },
          { title: 'AI Search Credits', detail: '500 credits per month + top-up option' },
          {
            title: 'Calendar',
            detail: 'Advanced Cross-Referencing: Automatically cross-references events with competitor roadmaps.',
          },
          {
            title: 'Forecast (Weather API)',
            detail: '10-Day Deep Forecast: Triggers automated environment and material risk alerts directly on the canvas.',
          },
          {
            title: 'Launch Radar',
            detail: 'Active Predictive Radar: Tracks release frequencies (e.g., "This company typically launches every 17 months. Next launch likely within 14 months").',
          },
          {
            title: 'Market Hype & Active Campaigns',
            detail: 'Deep Ingestion: Visualizes where the latest campaign is investing its money and on which social networks to track where customers spend their time.',
          },
          {
            title: 'Search Intent & Keywords',
            detail: 'Google Trends Integration: Visualizes the most used words when a user searches for that product, highlighting search spikes (+450% Breakout).',
          },
          {
            title: 'Technical Export',
            detail: 'Clean export of engineering specifications to JSON/CSV for CAD mapping.',
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
