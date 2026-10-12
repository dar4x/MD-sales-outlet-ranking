import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

function validateUrl(environment: Record<string, string>, name: string): void {
  const value = environment[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not include credentials, a query, or a fragment`);
  }
  if (name === 'VITE_SOCKET_URL' && url.pathname !== '/') {
    throw new Error('VITE_SOCKET_URL must be the server origin without a path');
  }
}

function getServerAddress(environment: Record<string, string>) {
  const host = environment.FRONTEND_HOST;
  const port = Number(environment.FRONTEND_PORT);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set FRONTEND_HOST and a valid FRONTEND_PORT in the root .env');
  }

  return { host, port, strictPort: true };
}

export default defineConfig(({ mode }) => {
  const envDir = resolve(import.meta.dirname, '..');
  const environment = loadEnv(mode, envDir, ['FRONTEND_', 'VITE_']);
  validateUrl(environment, 'VITE_API_URL');
  validateUrl(environment, 'VITE_SOCKET_URL');
  const address = getServerAddress(environment);

  return {
    plugins: [react()],
    envDir,
    server: address,
    preview: address,
  };
});
