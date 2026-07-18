import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/score': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/test-papers': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})