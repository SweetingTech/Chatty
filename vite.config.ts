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
      'process.env.WEAVIATE_HOST': JSON.stringify(env.WEAVIATE_HOST),
      'process.env.WEAVIATE_PORT': JSON.stringify(env.WEAVIATE_PORT),
      'process.env.WEAVIATE_API_KEY': JSON.stringify(env.WEAVIATE_API_KEY),
      'process.env.WEAVIATE_SCHEMA_CLASS': JSON.stringify(env.WEAVIATE_SCHEMA_CLASS),
      'process.env.WEAVIATE_BATCH_SIZE': JSON.stringify(env.WEAVIATE_BATCH_SIZE),
      'process.env.WEAVIATE_VECTORIZER_MODULE': JSON.stringify(env.WEAVIATE_VECTORIZER_MODULE),
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
