import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth/google': 'http://127.0.0.1:3001',
      '/auth/me': 'http://127.0.0.1:3001',
      '/songs': 'http://127.0.0.1:3001',
    },
  },
  resolve: {
    alias: {
      '@ama-midi/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
