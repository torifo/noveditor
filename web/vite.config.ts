import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// TODO (Wave W3 / Task W3.1): Import and configure vite-plugin-pwa here.
// import { VitePWA } from 'vite-plugin-pwa'
// VitePWA({
//   registerType: 'autoUpdate',
//   manifest: { name: 'noveditor', display: 'standalone', icons: [ ... ] },
//   workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg}'] },
// })

export default defineConfig({
  plugins: [
    svelte(),
    // TODO (Wave W3 / Task W3.1): Add VitePWA({ ... }) here after Task W2.3/W2.4 are done.
  ],
})
