import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true,
        secure: false
      },
      '/pwa': {
        target: 'https://127.0.0.1:5051',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  base: './', // Important for Electron to load assets from file://
})
