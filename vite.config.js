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
        name: 'Kasir Laundry',
        short_name: 'Kasir Laundry',
        description: 'Aplikasi Kasir Laundry Berbasis PWA',
        theme_color: '#0134d4',
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
})
