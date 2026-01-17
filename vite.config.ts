import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_d2FudGVkLWRpbmdvLTkxLmNsZXJrLmFjY291bnRzLmRldiQ'),
      'process.platform': JSON.stringify('browser'),
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