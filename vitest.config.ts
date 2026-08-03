import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: { NO_COLOR: '1' },
    coverage: {
      include: ['src/**'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      reporter: ['json-summary', 'text', 'lcov'],
      reportsDirectory: './coverage'
    }
  }
})
