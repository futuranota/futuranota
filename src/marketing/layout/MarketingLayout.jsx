import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Nav } from '../components/Nav.jsx';
import { Footer } from '../components/Footer.jsx';
import { applyMarketingTheme } from '../lib/theme.js';
import '../styles/marketing.css';
import '../styles/sections.css';

const DEFAULT_THEME = { accent: 'terracotta', texture: 'on' };

export function MarketingLayout() {
  useEffect(() => {
    applyMarketingTheme(DEFAULT_THEME);
    document.body.classList.add('marketing-body');
    return () => {
      document.body.classList.remove('marketing-body');
    };
  }, []);

  return (
    <>
      <div className="canvas-bg" />
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
