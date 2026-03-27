import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    target: 'esnext'
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      include: ['src/**'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['json-summary', 'text', 'lcov'],
      reportsDirectory: './coverage'
    }
  }
})
