import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createBrandCadenceMiddleware } from './server/brandCadenceHandler.js';

function applyServerEnv(env) {
  for (const key of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) {
    if (env[key]) process.env[key] = env[key];
  }
}

function brandCadenceApiPlugin(env) {
  return {
    name: 'brand-cadence-api',
    configureServer(server) {
      applyServerEnv(env);
      server.middlewares.use(createBrandCadenceMiddleware());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [react(), tailwindcss(), brandCadenceApiPlugin(env)],
  server: {
    port: 5173,
    strictPort: false,
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
