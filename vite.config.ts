import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },

    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(
        env.VITE_CLERK_PUBLISHABLE_KEY || ''
      ),
      'process.platform': JSON.stringify('browser'),
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: [
              'react',
              'react-dom',
              'lucide-react',
              'recharts'
            ],
            clerk: ['@clerk/clerk-react'],
            genai: ['@google/genai'],
          },
        },
      },
    },
  };
});
