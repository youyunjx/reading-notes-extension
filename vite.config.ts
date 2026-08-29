import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // The composer runs inside a page's content-script context; keep sourcemaps
    // for easier debugging while developing.
    sourcemap: true,
    // Disable Vite's module-preload polyfill. It uses fetch() to warm local
    // chunks; we don't need it for these small bundles, and removing it keeps
    // the shipped code free of any fetch() call — reinforcing the fully-offline
    // guarantee (nothing in the extension ever reaches the network).
    modulePreload: false,
    rollupOptions: {
      input: {
        // Standalone extension page (not referenced as a manifest entry point,
        // so it needs to be an explicit build input).
        pdfviewer: 'src/pdfviewer/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
