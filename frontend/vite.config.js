import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TokoPlus',
        short_name: 'TokoPlus',
        description: 'Aplikasi Kasir TokoPlus Berbasis PWA',
        theme_color: '#0134d4',
        start_url: '/login',
        scope: '/',
        display: 'standalone',
        icons: [
          {
            src: 'img/core-img/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  }
})
