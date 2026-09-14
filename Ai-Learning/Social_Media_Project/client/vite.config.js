import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  server: {
    port: 5173,
    proxy: {
      // Forwards /api requests directly to the Node.js Express backend
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      },
      // Forwards static upload image requests to the backend uploads folder
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true
      },
      // Forwards WebSocket and polling connections for Socket.IO
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true
      }
    }
  }
});
