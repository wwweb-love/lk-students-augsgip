import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // слушать все интерфейсы — сайт доступен в локальной сети
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        xfwd: true, // передаём X-Forwarded-For — бэкенд видит реальный IP клиента (для rate-limit)
      },
    },
  },
})
