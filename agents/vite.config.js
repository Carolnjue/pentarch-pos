import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Local dev: point POS_CLOUD at a WordPress running the plugin.
const CLOUD = process.env.POS_CLOUD || 'http://127.0.0.1:8080';

export default defineConfig({
  base: '/pos/agents/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['brand/*.svg', 'icons/*.png'],
      manifest: {
        id: '/pos/agents/',
        name: 'Pentarch POS — Agents',
        short_name: 'POS Agents',
        description: 'Leads, demos, trials and commission for Pentarch POS sales agents',
        start_url: '/pos/agents/',
        scope: '/pos/agents/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A1530',
        theme_color: '#0A1530',
        lang: 'en',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/pos/agents/index.html',
        navigateFallbackDenylist: [/^\/wp-json/, /^\/wp-admin/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ],
  build: { target: 'es2019', outDir: 'dist', sourcemap: false },
  server: { port: 5174, proxy: { '/wp-json': { target: CLOUD, changeOrigin: true } } },
  preview: { port: 4174, proxy: { '/wp-json': { target: CLOUD, changeOrigin: true } } }
});
