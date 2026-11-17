import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import os from 'os'

export default defineConfig({
  cacheDir: path.join(os.homedir(), 'AppData', 'Local', 'MediSync', 'vite-client-cache'),
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
