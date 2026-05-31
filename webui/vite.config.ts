import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5001,
    proxy: {
      '/api': 'http://taskservice:5000'   // для разработки, в продакшене nginx проксирует
    }
  }
})