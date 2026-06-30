import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const selectedApiDirectory = env.VITE_USE_MOCK_API === 'true'
    ? 'src/api/mock'
    : 'src/api/real'

  return {
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '#api-mode': path.resolve(process.cwd(), selectedApiDirectory),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    maxWorkers: 1,
    setupFiles: './src/setupTests.js',
    include: [
      'src/**/*.test.{js,jsx}',
      'tests/components/**/*.test.{js,jsx}',
    ],
    exclude: [
      'backend/**',
      'tests/e2e/**',
      'node_modules/**',
    ],
  }
  }
})
