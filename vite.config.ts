import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tauri expects a fixed dev port when using `tauri dev`.
const host = process.env.TAURI_DEV_HOST
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5183 } : undefined,
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM ? 'chrome105' : 'es2022',
  },
})
