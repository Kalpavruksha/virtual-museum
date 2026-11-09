import { defineConfig } from 'vite';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      test: /\.(jpe?g|png|gif|tiff|webp|svg|avif)$/i,
      includePublic: true,
      logStats: true,
      jpeg: {
        quality: 82,
      },
      jpg: {
        quality: 82,
      },
      png: {
        quality: 80,
      },
      webp: {
        lossless: false,
        quality: 80,
      },
    }),
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
  },
});

