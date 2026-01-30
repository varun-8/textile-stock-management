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
    emptyOutDir: true
  },
  base: '/pwa/'
})
