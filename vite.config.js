import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createBrandCadenceMiddleware } from './server/brandCadenceHandler.js';
import { createTranslateMiddleware } from './server/translateHandler.js';
import { createCampaignDetectorMiddleware } from './server/campaignDetectorHandler.js';
import { createHorizonScanMiddleware } from './server/horizonScanHandler.js';
import { createCampaignStudyMiddleware } from './server/campaignStudyHandler.js';
import { createIntelOverviewMiddleware } from './server/intelOverviewHandler.js';
import { createIntelModelsMiddleware } from './server/intelModelsHandler.js';
import { createWeatherForecastMiddleware } from './server/weatherHandler.js';
import { createIntegrationsHealthMiddleware } from './server/integrationsHealthHandler.js';
import { createEventsMiddleware } from './server/eventsHandler.js';
import { createWebProxyMiddleware } from './server/webProxyHandler.js';
import { createManagementMiddleware } from './server/managementHandler.js';
import { createOrchestratorMiddleware } from './server/orchestratorHandler.js';
import { createCampaignAnalystMiddleware } from './server/campaignAnalystHandler.js';
import { createMarketingGuideMiddleware } from './server/marketingGuideHandler.js';
import { createUsageLogMiddleware } from './server/usageLogHandler.js';

function brandCadenceApiPlugin(env) {
  return {
    name: 'brand-cadence-api',
    configureServer(server) {
      // Prefer .env.local values so Tina/Vite child processes always see API keys.
      for (const [key, value] of Object.entries(env)) {
        if (value != null && String(value).length > 0) {
          process.env[key] = String(value);
        }
      }
      server.middlewares.use(createBrandCadenceMiddleware());
      server.middlewares.use(createTranslateMiddleware());
      server.middlewares.use(createCampaignDetectorMiddleware());
      server.middlewares.use(createHorizonScanMiddleware());
      server.middlewares.use(createCampaignStudyMiddleware());
      server.middlewares.use(createIntelOverviewMiddleware());
      server.middlewares.use(createIntelModelsMiddleware());
      server.middlewares.use(createWeatherForecastMiddleware());
      server.middlewares.use(createIntegrationsHealthMiddleware());
      server.middlewares.use(createManagementMiddleware());
      server.middlewares.use(createOrchestratorMiddleware());
      server.middlewares.use(createCampaignAnalystMiddleware());
      server.middlewares.use(createMarketingGuideMiddleware());
      server.middlewares.use(createUsageLogMiddleware());
      server.middlewares.use(createEventsMiddleware());
      server.middlewares.use(createWebProxyMiddleware());
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
