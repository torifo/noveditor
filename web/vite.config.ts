import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // 'autoUpdate': new versions install in the background and take effect on the
      // next load without a user prompt — appropriate for a single-user local editor.
      registerType: 'autoUpdate',
      // We register the SW manually from src/main.ts via `virtual:pwa-register`.
      injectRegister: null,
      manifest: {
        name: 'ノヴェディタ',
        short_name: 'ノヴェディタ',
        description: '小説・ライトノベルを書くためのエディタ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#7f52ff',
        background_color: '#7f52ff',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the full built app shell so the app starts offline.
        // The Kotlin core is bundled by Vite into dist as hashed .js/.mjs chunks,
        // so precaching js/css/html plus icons/fonts covers it (verified via the
        // generated precache manifest referencing the app bundle + icons).
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff,woff2}'],
      },
      // Serve a real manifest + service worker during `pnpm dev` so the PWA
      // (and the install prompt) is testable in development, not only in builds.
      devOptions: {
        enabled: true,
        type: 'module',
        suppressWarnings: true,
      },
    }),
  ],
})
