import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Vitest config (separate from vite.config.ts so the PWA wave can own vite.config.ts later).
// jsdom provides a working `localStorage` for the repository round-trip / self-heal tests.
export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
})
