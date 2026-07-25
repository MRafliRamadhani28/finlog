import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Daftar aset hasil build, dibaca public/sw.js saat install untuk precache.
    // Tanpa ini, service worker tidak tahu nama chunk yang dimuat dinamis
    // (goey-toast) — namanya tidak pernah muncul di index.html.
    // Namanya bukan `manifest.json` supaya tidak tertukar dengan manifest PWA.
    manifest: 'asset-manifest.json',
  },
});
