import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


const isElectron = process.env.ELECTRON_BUILD === 'true';
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  // Build to backend public folder for web, or local dist for Electron
  build: {
    outDir: (isElectron || isCapacitorBuild) ? 'dist' : '../backend/public/pwa',
    // Preserve published APK files that live beside the PWA assets in backend/public/pwa.
    emptyOutDir: isElectron || isCapacitorBuild,
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
  base: (isElectron || isCapacitorBuild) ? './' : '/pwa/'
})
