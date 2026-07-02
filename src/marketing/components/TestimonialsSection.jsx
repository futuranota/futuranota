import { useMemo } from 'react';
import { getHome } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';
import { splitTestimonials, TESTIMONIALS_DEFAULT } from '../lib/testimonialsData.js';
import { TestimonialsColumn } from './TestimonialsColumn.jsx';

const COLUMN_DURATIONS = [20, 24, 28];

export function TestimonialsSection() {
  const pageTina = usePageTina();
  const { testimonials: block } = pageTina?.document ?? getHome();
  const items = block?.items?.length ? block.items : TESTIMONIALS_DEFAULT;

  const columns = useMemo(() => splitTestimonials(3, items), [items]);

  return (
    <section className="section testimonials-section" id="reviews" data-screen-label="testimonials">
      <div className="container">
        <div className="testimonials-section__head section-head">
          <span className="eyebrow" {...pageTinaProps('testimonials.eyebrow')}>
            <span className="tick" />
            {block?.eyebrow ?? 'SOCIAL PROOF'}
          </span>
          <h2 className="h2" {...pageTinaProps('testimonials.title')}>
            {block?.title ?? 'What our users say'}
          </h2>
          {block?.lead ? (
            <p className="lead" {...pageTinaProps('testimonials.lead')}>{block.lead}</p>
          ) : null}
        </div>

        <div className="testimonials-section__grid" aria-label="User testimonials">
          {columns.map((col, i) => (
            <TestimonialsColumn
              key={i}
              className={i === 1 ? 'testimonials-column--offset' : ''}
              testimonials={col}
              duration={COLUMN_DURATIONS[i] ?? 22}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
