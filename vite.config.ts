import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createRegionalDataMiddleware } from './backend/dataProviders/api';
import { createEvidenceMiddleware } from './backend/evidence/api';
export default defineConfig(({ mode }) => {
  // Server-side only. Never use VITE_ prefixes or expose this object via define.
  const env = loadEnv(mode, process.cwd(), '');
  const middleware = createEvidenceMiddleware({ ...env, ...process.env });
  const regionalData = createRegionalDataMiddleware({ ...env, ...process.env });
  const evidenceApi: Plugin = {
    name: 'local-evidence-api',
    configureServer(server) { server.middlewares.use(middleware); server.middlewares.use(regionalData); },
    configurePreviewServer(server) { server.middlewares.use(middleware); server.middlewares.use(regionalData); },
  };
  return {
    plugins: [evidenceApi],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 5173, strictPort: true },
  };
});
