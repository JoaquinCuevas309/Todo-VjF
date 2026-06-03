import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      // Precachea el shell de la app para funcionar offline
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],

      manifest: {
        name: 'Casino Institucional',
        short_name: 'Casino CI',
        description: 'Sistema de gestión de casino de alimentación institucional',
        theme_color: '#060A12',
        background_color: '#060A12',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        // Cachea assets estáticos (JS, CSS, fuentes)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Estrategia network-first para llamadas a la API (nunca cachear respuestas JWT)
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/.*/,
            handler: 'NetworkOnly',
            options: { cacheName: 'api-nocache' },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },

      // Inyecta el registro del SW automáticamente
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  resolve: {
    alias: { '@': '/src' },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
