import { Link } from 'react-router-dom';
import { authPath } from '../lib/paths.js';

export function FinalCTA() {
  return (
    <section className="section cta-section" id="signup" data-screen-label="cta">
      <div className="container">
        <div className="cta card">
          <div className="cta__glow" aria-hidden="true" />
          <span className="eyebrow eyebrow--signal" style={{ justifyContent: 'center' }}><span className="tick" />THE WINDOW IS OPEN</span>
          <h2 className="display cta__title">Ready to move on your opportunities?</h2>
          <p className="lead cta__lead">Join the makers and founders using Futura Nota to organize their ideas and move faster than the competition. Start free — no card, full features.</p>
          <div className="cta__buttons">
            <Link to={authPath()} className="btn btn-primary">Start free — 10 searches <span className="arrow">→</span></Link>
            <Link to={authPath('signin')} className="btn btn-ghost">Sign in</Link>
          </div>
          <div className="cta__trust">
            {['No credit card', 'Full features free', '500+ entrepreneurs', 'Operational since 2026'].map((t) => (
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
