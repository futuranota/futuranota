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
import { createHorizonKitsMiddleware } from './server/horizonKitsHandler.js';
import { createOrchestratorMiddleware } from './server/orchestratorHandler.js';
import { createCampaignAnalystMiddleware } from './server/campaignAnalystHandler.js';
import { createMarketingGuideMiddleware } from './server/marketingGuideHandler.js';
import { createContentCreatorMiddleware } from './server/contentCreatorHandler.js';
import { createPlanAgentMiddleware } from './server/planAgentHandler.js';
import { createSocialHypeAnalystMiddleware, createSocialHypeAnalyticsMiddleware } from './server/socialHypeAnalystHandler.js';
import { createUsageLogMiddleware } from './server/usageLogHandler.js';
import { createBillingMiddleware } from './server/billingHandler.js';
import { createDebugAgentLogMiddleware } from './server/debugAgentLogHandler.js';
import { createGinaChatMiddleware } from './server/gina/ginaChatHandler.js';
import { createPromptPdfMiddleware } from './server/promptPdfVision.js';
import { createUsersMeMiddleware } from './server/usersMeHandler.js';
import { createKofiWebhookMiddleware } from './server/kofiWebhookHandler.js';

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
      // Debug agent logs first so the path is always available during sessions.
      server.middlewares.use(createDebugAgentLogMiddleware());
      server.middlewares.use(createKofiWebhookMiddleware());
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
      server.middlewares.use(createHorizonKitsMiddleware());
      server.middlewares.use(createUsersMeMiddleware());
      server.middlewares.use(createOrchestratorMiddleware());
      server.middlewares.use(createCampaignAnalystMiddleware());
      server.middlewares.use(createMarketingGuideMiddleware());
      server.middlewares.use(createContentCreatorMiddleware());
      server.middlewares.use(createPlanAgentMiddleware());
      server.middlewares.use(createSocialHypeAnalystMiddleware());
      server.middlewares.use(createSocialHypeAnalyticsMiddleware());
      server.middlewares.use(createUsageLogMiddleware());
      server.middlewares.use(createBillingMiddleware());
      server.middlewares.use(createEventsMiddleware());
      server.middlewares.use(createWebProxyMiddleware());
      server.middlewares.use(createGinaChatMiddleware());
      server.middlewares.use(createPromptPdfMiddleware());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  envPrefix: ['VITE_', 'TINA_', 'SUPABASE_', 'APP_'],
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
