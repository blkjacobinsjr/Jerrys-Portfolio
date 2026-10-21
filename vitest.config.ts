import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/mascot.ts', 'src/lib/swing.ts', 'src/data/site.ts', 'src/data/recommendations.ts', 'src/lib/interaction.ts', 'src/lib/overlay.ts'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'reports/coverage',
      thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 },
    },
  },
});
