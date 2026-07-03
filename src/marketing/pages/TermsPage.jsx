import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Terms } from '../sections/Terms.jsx';
import { PATHS } from '../lib/paths.js';
import { applyMarketingTheme } from '../lib/theme.js';
import '../styles/marketing.css';
import '../styles/sections.css';

export function TermsPage() {
  useEffect(() => {
    applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
    document.body.classList.add('marketing-body');
    return () => document.body.classList.remove('marketing-body');
  }, []);

  return (
    <div className="auth-split-wrap auth-terms-wrap" data-screen-label="signup-terms">
      <div className="auth-terms-page">
        <Link to={PATHS.signup} className="link-arrow mono-sm auth-terms-page__back">
          <span className="arrow">←</span> Back to sign up
        </Link>
        <Terms compact />
      </div>
    </div>
  );
}
