import { defineConfig } from 'vite';

// Percorsi relativi: il gioco funziona sia in locale sia su GitHub Pages (/stecco-the-stickman/)
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
