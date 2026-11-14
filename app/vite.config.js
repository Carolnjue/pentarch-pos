import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const CLOUD = process.env.POS_CLOUD || 'http://127.0.0.1:8787';
const proxy = { '/wp-json': { target: CLOUD, changeOrigin: true } };

export default defineConfig({
  base: '/pos/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['brand/*.svg', 'icons/*.png'],
      manifest: {
        id: '/pos/',
        name: 'Pentarch POS',
        short_name: 'Pentarch POS',
        description: 'Offline-first point of sale for Kenyan businesses',
        start_url: '/pos/',
        scope: '/pos/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0A1530',
        theme_color: '#0A1530',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/pos/index.html',
        navigateFallbackDenylist: [/^\/wp-json/, /^\/pos\/agents/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true
      }
    })
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rolldownOptions: undefined
  },
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy }
});
