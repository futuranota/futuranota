import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createBrandCadenceMiddleware } from './server/brandCadenceHandler.js';
import { createTranslateMiddleware } from './server/translateHandler.js';

function applyServerEnv(env) {
  for (const key of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_TRANSLATE_API_KEY']) {
    if (env[key]) process.env[key] = env[key];
  }
}

function brandCadenceApiPlugin(env) {
  return {
    name: 'brand-cadence-api',
    configureServer(server) {
      applyServerEnv(env);
      server.middlewares.use(createBrandCadenceMiddleware());
      server.middlewares.use(createTranslateMiddleware());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  envPrefix: ['VITE_', 'TINA_'],
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
