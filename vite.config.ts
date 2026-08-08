import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Celimood',
        short_name: 'Celimood',
        description: 'Trackeá tu humor del día y tu ciclo, de forma simple.',
        theme_color: '#2a78d6',
        background_color: '#fcfcfb',
        display: 'standalone',
        start_url: '/',
        // 'any' e 'maskable' por separado (SPEC.md §7): un ícono "any" con
        // esquinas redondeadas propias más un ícono "maskable" de sangrado
        // completo para que el OS aplique su propia máscara sin recortar mal.
        icons: [
          { src: 'icon-any-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-any-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El shell de la app se cachea; los datos del usuario viven en IndexedDB
        // y nunca en el Cache API (CONVENTIONS.md §10).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
