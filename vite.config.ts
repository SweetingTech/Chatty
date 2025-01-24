import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'chromadb-default-embed': '/src/lib/chromadb-default-embed.js'
    }
  },
  optimizeDeps: {
    include: [
      'lucide-react',
      'isomorphic-fetch'
    ],
    exclude: ['chromadb'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['chromadb-default-embed']
    }
  },
  define: {
    global: 'globalThis'
  }
});
