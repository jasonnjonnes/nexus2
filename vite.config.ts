import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
    chunkSizeWarningLimit: 2000,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    __firebase_config: JSON.stringify({
      apiKey: "AIzaSyDfxYAO3u_RBWZ6a4teD1ReSyFpxCGlN6g",
      authDomain: "servicepro-4c705.firebaseapp.com",
      projectId: "servicepro-4c705",
      storageBucket: "servicepro-4c705.firebasestorage.app",
      messagingSenderId: "541335321876",
      appId: "1:541335321876:web:fe01f54d6a4da2031b9601",
      measurementId: "G-TXHB1Y2JWN"
    }),
    __app_id: JSON.stringify("servicepro-4c705"),
    __initial_auth_token: JSON.stringify("")
  }
});