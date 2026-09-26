import { defineConfig } from 'vite';

// Percorsi relativi: il gioco funziona sia in locale sia su GitHub Pages (/stilizzato/)
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
