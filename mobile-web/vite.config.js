import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'


const isElectron = process.env.ELECTRON_BUILD === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  // Build to backend public folder for web, or local dist for Electron
  build: {
    outDir: isElectron ? 'dist' : '../backend/public/pwa',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'html5-qrcode': ['html5-qrcode'],
          'axios': ['axios']
        }
      }
    }
  },
  base: isElectron ? './' : '/pwa/'
})
