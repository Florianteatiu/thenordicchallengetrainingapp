import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Two pages, one app: index.html is the online app, pt/index.html is Nordic PT
// (the in-person app) with its own name and home-screen icon.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', pt: 'pt/index.html' },
    },
  },
})
