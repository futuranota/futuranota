import { useEffect } from 'react';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor,
} from '../../tweaks-panel.jsx';
import { PageTinaProvider } from '../context/TinaVisualEditing.jsx';
import { Hero } from '../components/Hero.jsx';
import { SectionDirectory } from '../components/SectionDirectory.jsx';
import { FinalCTA } from '../components/FinalCTA.jsx';
import { applyMarketingTheme, accentSwatch, swatchToName } from '../lib/theme.js';

const TWEAK_DEFAULTS = {
  accent: 'terracotta',
  heroMode: 'maker',
  texture: 'on',
};

function HomePageContent() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    applyMarketingTheme(t);
  }, [t.accent, t.texture]);

  return (
    <>
      <Hero heroMode={t.heroMode} />
      <SectionDirectory />
      <FinalCTA />

      <TweaksPanel title="Futura Nota · Landing">
        <TweakSection label="Theme" />
        <TweakColor
          label="Accent"
          value={accentSwatch(t.accent)}
          options={['#cf8157', '#3fd39a', '#a78bfa']}
          onChange={(v) => setTweak('accent', swatchToName(v))}
        />
        <TweakToggle
          label="Dot-grid texture"
          value={t.texture === 'on'}
          onChange={(v) => setTweak('texture', v ? 'on' : 'off')}
        />
        <TweakSection label="Hero" />
        <TweakRadio
          label="Framing"
          value={t.heroMode}
          options={['maker', 'founder']}
          onChange={(v) => setTweak('heroMode', v)}
        />
      </TweaksPanel>
    </>
  );
}

export function HomePage() {
  return (
    <PageTinaProvider docKey="home">
      <HomePageContent />
    </PageTinaProvider>
  );
}
