import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { authPath } from '../lib/paths.js';
import { getHome } from '../lib/content.js';
import { PRICING_PLANS_DEFAULT, PRICING_SECTION_DEFAULT, planBullets } from '../lib/pricingDefaults.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';
import { PricingInterestChart } from './PricingInterestChart.jsx';

const MOTION = { duration: 0.8, ease: [0.16, 1, 0.3, 1] };

function CheckIcon() {
  return (
    <svg className="pricing-check-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10.2 8.8 12.5 13.5 7.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @param {{ plan: Record<string, unknown>, index: number, variant: 'free' | 'pro' }} props
 */
function FeatureList({ plan, index, variant }) {
  const bullets = planBullets(plan);
  const base = `pricing.plans.${index}.bullets`;

  return (
    <ul className={`pricing-feature-list pricing-feature-list--${variant}`}>
      {bullets.map((item, i) => (
        <li key={item} className="pricing-feature-list__item">
          <CheckIcon />
          <span {...pageTinaProps(`${base}.${i}`)}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingPlans() {
  const reduceMotion = useReducedMotion();
  const pageTina = usePageTina();
  const { pricing } = pageTina?.document ?? getHome();
  const rawPlans = pricing?.plans?.length ? pricing.plans : PRICING_PLANS_DEFAULT;

  const { freePlan, proPlan, freeIndex, proIndex } = useMemo(() => {
    const freeIdx = rawPlans.findIndex((p) => p.id === 'free');
    const proIdx = rawPlans.findIndex((p) => p.id === 'pro');
    return {
      freePlan: rawPlans.find((p) => p.id === 'free') ?? PRICING_PLANS_DEFAULT[0],
      proPlan: rawPlans.find((p) => p.id === 'pro') ?? PRICING_PLANS_DEFAULT[1],
      freeIndex: freeIdx >= 0 ? freeIdx : 0,
      proIndex: proIdx >= 0 ? proIdx : 1,
    };
  }, [rawPlans]);

  const section = { ...PRICING_SECTION_DEFAULT, ...pricing };
  const proPriceValue = proPlan.price;
  const proPriceSuffix = proPlan.priceSuffix;
  const proBillingNote = proPlan.billingNote;
  const freeTo = authPath(undefined, { plan: 'free' });
  const proTo = authPath(undefined, { plan: 'pro', billing: 'monthly' });

  const motionProps = (delay) => reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        transition: { ...MOTION, delay },
        viewport: { once: true, amount: 0.15 },
      };

  return (
    <section className="section pricing-section" id="pricing" data-screen-label="pricing">
      <div className="container pricing-section__inner">
        <motion.div className="pricing-section__head pricing-section__head--center" {...motionProps(0.05)}>
          <span className="eyebrow pricing-section__eyebrow" {...pageTinaProps('pricing.eyebrow')}>
            <span className="tick" />{section.eyebrow}
          </span>
          <h2 className="h2 pricing-section__title" {...pageTinaProps('pricing.title')}>{section.title}</h2>
          <p className="lead pricing-section__lead" {...pageTinaProps('pricing.lead')}>{section.lead}</p>
        </motion.div>

        <motion.div className="pricing-chart-grid card" {...motionProps(0.15)}>
          {/* Starter / Free */}
          <div className="pricing-chart-grid__free">
            <div className="pricing-chart-grid__free-inner">
              <div>
                <h3 className="pricing-chart-grid__plan-name" {...pageTinaProps(`pricing.plans.${freeIndex}.shortName`)}>
                  {freePlan.shortName || freePlan.name || 'Free'}
                </h3>
                <div className="pricing-chart-grid__price">
                  <span className="pricing-chart-grid__currency">$</span>
                  <span className="pricing-chart-grid__amount" {...pageTinaProps(`pricing.plans.${freeIndex}.price`)}>
                    {freePlan.price}
                  </span>
                </div>
                <p className="muted pricing-chart-grid__desc" {...pageTinaProps(`pricing.plans.${freeIndex}.desc`)}>
                  {freePlan.desc}
                </p>
              </div>

              <Link
                to={freeTo}
                className="btn btn-ghost pricing-chart-grid__cta"
              >
                <span {...pageTinaProps(`pricing.plans.${freeIndex}.cta`)}>{freePlan.cta || 'Get Started'}</span>
              </Link>

              <hr className="divider pricing-chart-grid__sep" />

              <FeatureList plan={freePlan} index={freeIndex} variant="free" />
            </div>

            {freePlan.billingNote ? (
              <p
                className="faint pricing-chart-grid__billing-note"
                {...pageTinaProps(`pricing.plans.${freeIndex}.billingNote`)}
              >
                {freePlan.billingNote}
              </p>
            ) : null}
          </div>

          {/* Pro */}
          <div className="pricing-chart-grid__pro">
            <div className="pricing-chart-grid__pro-layout">
              <div className="pricing-chart-grid__pro-main">
                <div>
                  <div className="pricing-chart-grid__pro-head">
                    <h3 className="pricing-chart-grid__plan-name" {...pageTinaProps(`pricing.plans.${proIndex}.name`)}>
                      {proPlan.name}
                    </h3>
                    {proPlan.badge ? (
                      <span className="chip chip--accent" {...pageTinaProps(`pricing.plans.${proIndex}.badge`)}>
                        {proPlan.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="pricing-chart-grid__price">
                    <span className="pricing-chart-grid__currency">$</span>
                    <span className="pricing-chart-grid__amount">
                      {proPriceValue}
                    </span>
                    {proPriceSuffix ? (
                      <span className="faint pricing-chart-grid__suffix">
                        {proPriceSuffix}
                      </span>
                    ) : null}
                  </div>
                  <p className="muted pricing-chart-grid__desc" {...pageTinaProps(`pricing.plans.${proIndex}.desc`)}>
                    {proPlan.desc}
                  </p>
                  {proBillingNote ? (
                    <p className="faint pricing-chart-grid__billing-note">{proBillingNote}</p>
                  ) : null}
                </div>
                <div className="pricing-chart-grid__chart-wrap">
                  <PricingInterestChart />
                </div>
              </div>

              <div className="pricing-chart-grid__pro-features">
                <p className="pricing-chart-grid__plus-label">Everything in Starter plus:</p>
                <FeatureList plan={proPlan} index={proIndex} variant="pro" />
                <div className="pricing-chart-grid__cta-row">
                  <Link to={proTo} className="btn btn-primary">
                    <span {...pageTinaProps(`pricing.plans.${proIndex}.cta`)}>{proPlan.cta || 'Get Started'}</span>
                    <span className="arrow">→</span>
                  </Link>
                  <Link to={freeTo} className="btn btn-ghost">
                    <span {...pageTinaProps(`pricing.plans.${proIndex}.secondaryCta`)}>
                      {proPlan.secondaryCta || 'Start free trial'}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
