export const MARKETING_ACCENTS = {
  terracotta: {
    '--accent': 'oklch(0.22 0.01 60)',
    '--accent-strong': 'oklch(0.16 0.01 60)',
    '--accent-bright': 'oklch(0.32 0.01 60)',
    '--accent-soft': 'oklch(0 0 0 / 0.06)',
    '--accent-line': 'oklch(0 0 0 / 0.14)',
    '--on-accent': '#FFFFFF',
  },
  green: {
    '--accent': 'oklch(0.80 0.150 159)',
    '--accent-strong': 'oklch(0.75 0.150 159)',
    '--accent-soft': 'oklch(0.80 0.150 159 / 0.14)',
    '--accent-line': 'oklch(0.80 0.150 159 / 0.42)',
    '--on-accent': 'oklch(0.18 0.03 159)',
  },
  violet: {
    '--accent': 'oklch(0.70 0.150 295)',
    '--accent-strong': 'oklch(0.65 0.155 295)',
    '--accent-soft': 'oklch(0.70 0.150 295 / 0.16)',
    '--accent-line': 'oklch(0.70 0.150 295 / 0.42)',
    '--on-accent': 'oklch(0.97 0.01 295)',
  },
};

const SWATCH = { terracotta: '#1a1a1a', green: '#3fd39a', violet: '#a78bfa' };

export function accentSwatch(name) {
  return SWATCH[name] || SWATCH.terracotta;
}

export function swatchToName(hex) {
  return Object.keys(SWATCH).find((k) => SWATCH[k] === hex) || 'terracotta';
}

export function applyMarketingTheme(t) {
  const root = document.documentElement;
  const accent = MARKETING_ACCENTS[t.accent] || MARKETING_ACCENTS.terracotta;
  for (const [key, value] of Object.entries(accent)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-texture', t.texture);
  root.setAttribute('data-site', 'marketing');
}

export function clearMarketingTheme() {
  document.documentElement.removeAttribute('data-site');
  document.documentElement.removeAttribute('data-texture');
}

/** Beige auth canvas (login / signup / password) — matches prompt desk, avoids dark flash. */
export const AUTH_CANVAS_BG = '#f4f1eb';

/**
 * Light marketing canvas for standalone auth pages (outside MarketingLayout home).
 * @returns {() => void} cleanup
 */
export function applyAuthLightCanvas() {
  applyMarketingTheme({ accent: 'terracotta', texture: 'on' });
  const root = document.documentElement;
  root.setAttribute('data-theme', 'light');
  document.body.classList.add('marketing-body', 'marketing-body--auth');
  document.body.style.background = AUTH_CANVAS_BG;
  document.body.style.backgroundImage = 'none';
  document.body.style.color = '#3D3B3B';
  return () => {
    document.body.classList.remove('marketing-body', 'marketing-body--auth');
    document.body.style.background = '';
    document.body.style.backgroundImage = '';
    document.body.style.color = '';
    // Restore app theme preference (do not leave auth "light" sticky).
    let preferred = 'dark';
    try {
      const stored = localStorage.getItem('futuranota-theme');
      if (stored === 'light' || stored === 'dark') preferred = stored;
    } catch {
      /* ignore */
    }
    if (preferred === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  };
}
