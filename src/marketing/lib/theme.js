export const MARKETING_ACCENTS = {
  terracotta: {
    '--accent': 'oklch(0.72 0.135 52)',
    '--accent-strong': 'oklch(0.67 0.140 50)',
    '--accent-soft': 'oklch(0.72 0.135 52 / 0.14)',
    '--accent-line': 'oklch(0.72 0.135 52 / 0.40)',
    '--on-accent': 'oklch(0.18 0.02 50)',
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

const SWATCH = { terracotta: '#cf8157', green: '#3fd39a', violet: '#a78bfa' };

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
