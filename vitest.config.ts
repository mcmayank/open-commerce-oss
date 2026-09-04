import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
    },
  },
})
