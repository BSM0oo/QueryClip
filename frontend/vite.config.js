import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Try to read the backend .env file to get SERVER_PORT
function getServerPort() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const portMatch = envContent.match(/SERVER_PORT=(\d+)/);
      if (portMatch && portMatch[1]) {
        return parseInt(portMatch[1], 10);
      }
    }
  } catch (error) {
    console.warn('Could not read SERVER_PORT from .env file:', error);
  }
  return 8991; // Fallback port
}

// Get the server port for the proxy configuration
const serverPort = getServerPort();
console.log(`Configuring Vite to proxy API requests to port ${serverPort}`);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow connections from other devices on the network
    proxy: {
      '/api': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
        secure: false
      }
    },
    cors: true // Enable CORS for the dev server
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Add base URL configuration
    base: '/',
    // Ensure assets are handled correctly
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})