import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api requests to the Express backend during local dev, so the
// client can just call fetch("/api/...") without hardcoding a port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
