import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: './frontend',  // Make sure Vite uses the correct root directory
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist', // Specify the output directory for production build
    emptyOutDir: true,
  },
})
