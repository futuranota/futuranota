import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Nav } from '../components/Nav.jsx';
import { Footer } from '../components/Footer.jsx';
import { SiteTinaProvider } from '../context/TinaVisualEditing.jsx';
import { applyMarketingTheme } from '../lib/theme.js';
import { PATHS } from '../lib/paths.js';
import '../styles/marketing.css';
import '../styles/sections.css';
import '../styles/landing-tweaks.css';
import '../styles/plain-landing.css';

const DEFAULT_THEME = { accent: 'terracotta', texture: 'on' };

export function MarketingLayout() {
  const { hash, pathname } = useLocation();
  const home = pathname === PATHS.home;
  const privacy = pathname === PATHS.privacy;

  useEffect(() => {
    applyMarketingTheme(DEFAULT_THEME);
    document.body.classList.add('marketing-body');
    return () => {
      document.body.classList.remove('marketing-body');
    };
  }, []);

  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <SiteTinaProvider>
      <div className={
        privacy
          ? 'marketing-shell marketing-shell--privacy'
          : home
            ? 'marketing-shell marketing-shell--home'
            : 'marketing-shell'
      }>
        <div className="canvas-bg" />
        <Nav />
        <main>
          <Outlet />
        </main>
        {home || privacy ? null : <Footer />}
      </div>
    </SiteTinaProvider>
  );
}
