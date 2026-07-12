import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base path: '/budget-perso/' when deploying to GitHub Pages (project page),
// '/' for local use (the .bat launcher serves from the root).
const base = process.env.GITHUB_PAGES ? '/budget-perso/' : '/'

// 100% local app — no backend. Data lives in the browser (IndexedDB).
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Budget Perso',
        short_name: 'Budget',
        description: 'Suivi de budget 100% local',
        theme_color: '#10b981',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Don't precache the personal Excel (it isn't deployed anyway).
        globIgnores: ['**/historique.xlsx'],
      },
    }),
  ],
  server: { port: 5180, open: true },
  preview: { port: 5180 },
})
