import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Honor the port the harness assigns via PORT (falls back to 5173 locally).
    port: Number(process.env.PORT) || 5173,
    proxy: {
      // Local backend can't reach Azure SQL (firewall), so proxy /api to the live
      // Azure backend for working data in local dev. Override with VITE_API_TARGET.
      '/api': {
        target: process.env.VITE_API_TARGET || 'https://dev-bzg9gyceeua8d5e9.canadacentral-01.azurewebsites.net',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
