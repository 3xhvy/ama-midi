import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        bypass(req) {
          // Frontend route — API redirects here after Google OAuth with ?token=
          if (req.url?.startsWith('/auth/callback')) return req.url
        },
      },
      '/users':    { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/dashboard': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/patterns': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/charts':   { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/health':   { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/projects': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return req.url
        },
      },
      '/songs': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // Browser page navigation (Accept: text/html) must NOT be proxied —
        // Vite serves index.html so React Router handles the route.
        // XHR/fetch API calls (Accept: */*, application/json) DO get proxied.
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return req.url
        },
      },
    },
  },
  resolve: {
    alias: {
      '@ama-midi/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
