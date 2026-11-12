import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Relative base so the same build works at a domain root, a sub-path (GitHub Pages) or from a file server.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: true },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
})
