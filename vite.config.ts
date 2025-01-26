import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Expose env variables
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
      'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
      global: 'globalThis'
    },
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
    }
  };
});
