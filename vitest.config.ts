import { defineConfig } from 'vitest/config';

// One command for the whole monorepo: `npm test` at the root runs the API and
// web suites as separate projects, because they need different resolution (the
// API is NodeNext ESM and imports its own files with a `.js` extension).
export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web'],
  },
});
