import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env': JSON.stringify({
        API_KEY: env.API_KEY || '',
        VITE_CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_d2FudGVkLWRpbmdvLTkxLmNsZXJrLmFjY291bnRzLmRldiQ',
        NODE_ENV: mode
      }),
      'process.platform': JSON.stringify('browser'),
      'process.version': JSON.stringify(''),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'lucide-react', 'recharts'],
            clerk: ['@clerk/clerk-react'],
            genai: ['@google/genai']
          },
        },
      },
    },
  };
});