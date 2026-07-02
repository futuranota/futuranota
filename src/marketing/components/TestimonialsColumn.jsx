import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { initialsFromName } from '../lib/testimonialsData.js';

/**
 * @param {{
 *   className?: string,
 *   testimonials: import('../lib/testimonialsData.js').Testimonial[],
 *   duration?: number,
 * }} props
 */
export function TestimonialsColumn({ className = '', testimonials, duration = 18 }) {
  const reduceMotion = useReducedMotion();

  if (!testimonials?.length) return null;

  const cards = testimonials.map((item, i) => (
    <article className="testimonials-card" key={`${item.name}-${i}`}>
      <blockquote className="testimonials-card__quote">{item.text}</blockquote>
      <footer className="testimonials-card__author">
        <span className="testimonials-card__avatar" aria-hidden="true">
          {initialsFromName(item.name)}
        </span>
        <div className="testimonials-card__meta">
          <cite className="testimonials-card__name">{item.name}</cite>
          <span className="testimonials-card__role">{item.role}</span>
        </div>
      </footer>
    </article>
  ));

  if (reduceMotion) {
    return (
      <div className={`testimonials-column testimonials-column--static ${className}`.trim()}>
        <div className="testimonials-column__track">{cards}</div>
      </div>
    );
  }

  return (
    <div className={`testimonials-column ${className}`.trim()}>
      <motion.div
        className="testimonials-column__track"
        animate={{ y: '-50%' }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop',
        }}
      >
        {[0, 1].map((pass) => (
          <Fragment key={pass}>{cards}</Fragment>
        ))}
      </motion.div>
    </div>
  );
}
