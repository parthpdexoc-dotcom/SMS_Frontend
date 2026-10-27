import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base to /cts/ to serve the app from the /cts subdirectory
  base: '/sms/',
  server: {
    port: 5173,
    strictPort: false,
    // Vite automatically handles SPA routing in dev mode
    // All routes will fallback to index.html
    proxy: {
      '/api': {
        target: 'https://localhost:7144',
        changeOrigin: true,
        secure: false, // Set to false if using self-signed certificates
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    // Ensure proper routing in production builds
    // The server needs to be configured to serve index.html for all routes
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  resolve: {
    alias: [
      {
        find: '@/organisms',
        replacement: path.resolve(__dirname, './src/components/organisms'),
      },
      {
        find: '@/molecules',
        replacement: path.resolve(__dirname, './src/components/smsmolecules'),
      },
      {
        find: '@/atoms',
        replacement: path.resolve(__dirname, './src/components/atoms'),
      },
      {
        find: '@/components',
        replacement: path.resolve(__dirname, './src/components'),
      },
      {
        find: '@/styles',
        replacement: path.resolve(__dirname, './src/styles'),
      },
      {
        find: '@/utils',
        replacement: path.resolve(__dirname, './src/utils'),
      },
      {
        find: '@/types',
        replacement: path.resolve(__dirname, './src/types'),
      },
      {
        find: '@/constants',
        replacement: path.resolve(__dirname, './src/constants'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
})

