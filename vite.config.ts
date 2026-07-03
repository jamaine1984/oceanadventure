import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@dimforge')) return 'rapier';
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
