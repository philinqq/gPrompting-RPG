import { defineConfig } from 'vite';
import { apiMiddleware } from './server/api.js';

export default defineConfig({
  plugins: [{ name: 'local-json-storage', configureServer(server) { server.middlewares.use(apiMiddleware); } }],
  server: { host: '127.0.0.1' },
});
