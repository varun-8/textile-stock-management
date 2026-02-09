import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  // Build to backend public folder so it's served by the server
  build: {
    outDir: '../backend/public/pwa',
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
  base: '/pwa/'
})
