import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createBrandCadenceMiddleware } from './server/brandCadenceHandler.js';
import { createTranslateMiddleware } from './server/translateHandler.js';
import { createCampaignDetectorMiddleware } from './server/campaignDetectorHandler.js';
import { createHorizonScanMiddleware } from './server/horizonScanHandler.js';
import { createCampaignStudyMiddleware } from './server/campaignStudyHandler.js';
import { createIntelOverviewMiddleware } from './server/intelOverviewHandler.js';
import { createWeatherForecastMiddleware } from './server/weatherHandler.js';
import { createIntegrationsHealthMiddleware } from './server/integrationsHealthHandler.js';

function brandCadenceApiPlugin(env) {
  return {
    name: 'brand-cadence-api',
    configureServer(server) {
      // These handlers read process.env directly (Vercel Functions convention);
      // mirror loadEnv() output onto process.env so the dev server sees the same keys.
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      server.middlewares.use(createBrandCadenceMiddleware());
      server.middlewares.use(createTranslateMiddleware());
      server.middlewares.use(createCampaignDetectorMiddleware());
      server.middlewares.use(createHorizonScanMiddleware());
      server.middlewares.use(createCampaignStudyMiddleware());
      server.middlewares.use(createIntelOverviewMiddleware());
      server.middlewares.use(createWeatherForecastMiddleware());
      server.middlewares.use(createIntegrationsHealthMiddleware());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  envPrefix: ['VITE_', 'TINA_', 'SUPABASE_'],
plugins: [react(), tailwindcss(), brandCadenceApiPlugin(env)],
  server: {
    port: 5173,
    // Keep port fixed so /admin URLs match; kill other Vite processes if this fails.
    strictPort: true,
    proxy: {
      '/jina': {
        target: 'https://r.jina.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jina/, ''),
      },
    },
  },
  };
});
