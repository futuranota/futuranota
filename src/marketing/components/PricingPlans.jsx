import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { authPath } from '../lib/paths.js';
import { getHome } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

const MOTION = { duration: 0.8, ease: [0.16, 1, 0.3, 1] };

/**
 * @param {{ plan: Record<string, unknown>, index: number }} props
 */
function PricingCard({ plan, index }) {
  const base = `pricing.plans.${index}`;
  const featured = Boolean(plan.featured);
  const planId = plan.id === 'pro' ? 'pro' : 'free';
  const to = authPath(undefined, { plan: planId });

  return (
    <div className={`pricing-plan${featured ? ' pricing-plan--featured' : ''}`}>
      {featured ? <div className="pricing-plan__glow" aria-hidden="true" /> : null}
      <div className="pricing-plan__head">
        <div className="pricing-plan__title-row">
          <h3 className="h3 pricing-plan__name" {...pageTinaProps(`${base}.name`)}>{plan.name}</h3>
          {plan.badge ? (
            <span className="chip chip--accent pricing-plan__badge" {...pageTinaProps(`${base}.badge`)}>
              {plan.badge}
            </span>
          ) : null}
        </div>
        <p className="muted pricing-plan__desc" {...pageTinaProps(`${base}.desc`)}>{plan.desc}</p>
      </div>
      <div className="pricing-plan__price-block">
        {plan.price === '0' || plan.priceLabel === 'Free' ? (
          <div className="pricing-plan__price">
            <span className="pricing-plan__amount" {...pageTinaProps(`${base}.priceLabel`)}>Free</span>
          </div>
        ) : (
          <div className="pricing-plan__price">
            <span className="pricing-plan__currency">$</span>
            <span className="pricing-plan__amount" {...pageTinaProps(`${base}.price`)}>{plan.price}</span>
            {plan.priceSuffix ? (
              <span className="pricing-plan__suffix faint" {...pageTinaProps(`${base}.priceSuffix`)}>{plan.priceSuffix}</span>
            ) : null}
          </div>
        )}
        <Link
          to={to}
          className={`btn btn-sm pricing-plan__cta${featured ? ' btn-primary' : ' btn-ghost'}`}
        >
          <span {...pageTinaProps(`${base}.cta`)}>{plan.cta}</span>
          <span className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}

export function PricingPlans() {
  const reduceMotion = useReducedMotion();
  const pageTina = usePageTina();
  const { pricing } = pageTina?.document ?? getHome();
  const plans = pricing?.plans ?? [];

  const motionProps = (delay) => reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        transition: { ...MOTION, delay },
        viewport: { once: true },
      };

  return (
    <section className="section pricing-section" id="pricing" data-screen-label="pricing">
      <div className="container pricing-section__inner">
        <motion.div className="pricing-section__head" {...motionProps(0.1)}>
          <div className="pricing-section__eyebrow-wrap">
            <span className="eyebrow pricing-section__eyebrow" {...pageTinaProps('pricing.eyebrow')}>
              <span className="tick" />{pricing.eyebrow}
            </span>
          </div>
          <h2 className="h2 pricing-section__title" {...pageTinaProps('pricing.title')}>{pricing.title}</h2>
          <p className="lead pricing-section__lead" {...pageTinaProps('pricing.lead')}>{pricing.lead}</p>
        </motion.div>

        <div className="pricing-section__grid-wrap">
          <div className="pricing-section__grid-bg" aria-hidden="true" />
          <motion.div className="pricing-grid" {...motionProps(0.2)}>
            <span className="pricing-grid__corner pricing-grid__corner--tl" aria-hidden="true">+</span>
            <span className="pricing-grid__corner pricing-grid__corner--tr" aria-hidden="true">+</span>
            <span className="pricing-grid__corner pricing-grid__corner--bl" aria-hidden="true">+</span>
            <span className="pricing-grid__corner pricing-grid__corner--br" aria-hidden="true">+</span>
            {plans.map((plan, index) => (
              <PricingCard key={plan.id || index} plan={plan} index={index} />
            ))}
          </motion.div>
        </div>

        <motion.p className="pricing-section__trust mono-sm faint" {...motionProps(0.3)}>
          <span className="pricing-section__trust-icon" aria-hidden="true">✓</span>
          <span {...pageTinaProps('pricing.trust')}>{pricing.trust}</span>
        </motion.p>
      </div>
    </section>
  );
}
