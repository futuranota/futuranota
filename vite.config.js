import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';


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
  envPrefix: ['VITE_', 'TINA_', 'SUPABASE_'],
plugins: [react(), tailwindcss()],
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
