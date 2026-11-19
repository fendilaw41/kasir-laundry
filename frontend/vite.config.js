import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appName = env.VITE_APP_NAME || 'Klinvo'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: appName,
          short_name: appName,
          description: `Aplikasi Kasir ${appName} Berbasis PWA`,
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
  }
})
