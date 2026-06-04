export const MARKETING_ACCENTS = {
  terracotta: {
    '--accent': 'oklch(0.82 0.11 350)',
    '--accent-strong': 'oklch(0.76 0.12 350)',
    '--accent-bright': 'oklch(0.90 0.12 350)',
    '--accent-soft': 'oklch(0.82 0.11 350 / 0.14)',
    '--accent-line': 'oklch(0.75 0.10 350 / 0.42)',
    '--on-accent': 'oklch(0.14 0.03 350)',
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

const SWATCH = { terracotta: '#e8a4c8', green: '#3fd39a', violet: '#a78bfa' };

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
