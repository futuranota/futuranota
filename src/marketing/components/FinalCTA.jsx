import { Link } from 'react-router-dom';
import { authPath } from '../lib/paths.js';
import { getHome } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

export function FinalCTA() {
  const pageTina = usePageTina();
  const { finalCta } = pageTina?.document ?? getHome();

  return (
    <section className="section cta-section" id="signup" data-screen-label="cta">
      <div className="container">
        <div className="cta card">
          <div className="cta__glow" aria-hidden="true" />
          <span className="eyebrow eyebrow--signal" style={{ justifyContent: 'center' }} {...pageTinaProps('finalCta.eyebrow')}><span className="tick" />{finalCta.eyebrow}</span>
          <h2 className="display cta__title" {...pageTinaProps('finalCta.title')}>{finalCta.title}</h2>
          <p className="lead cta__lead" {...pageTinaProps('finalCta.lead')}>{finalCta.lead}</p>
          <div className="cta__buttons">
            <Link to={authPath(undefined, { plan: 'free' })} className="btn btn-primary">{finalCta.primaryCta} <span className="arrow">→</span></Link>
            <Link to={authPath('signin')} className="btn btn-ghost">{finalCta.secondaryCta}</Link>
          </div>
          <div className="cta__trust">
            {finalCta.trust.map((t) => (
              <span className="cta__trust-item mono-sm" key={t}>
                <span className="tick" style={{ width: 5, height: 5, borderRadius: 2, background: 'var(--signal)' }} />{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
