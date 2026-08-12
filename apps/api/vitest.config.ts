import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// The API is NodeNext ESM: it imports its own modules as `./thing.js` even
// though the file on disk is `./thing.ts`. Node resolves that at runtime after
// tsc emits; Vite does not, so map it back here.
const nodeNextExtensions = {
  name: 'nodenext-js-to-ts',
  enforce: 'pre' as const,
  resolveId(source: string, importer: string | undefined) {
    if (!importer || !source.startsWith('.') || !source.endsWith('.js')) return null;
    const candidate = resolve(dirname(importer), source.replace(/\.js$/, '.ts'));
    return existsSync(candidate) ? candidate : null;
  },
};

export default defineConfig({
  plugins: [nodeNextExtensions],
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // `config/env.ts` validates the environment the moment it is imported, so
    // the fixture values have to be in place before any module loads.
    setupFiles: ['./src/test/setup.ts'],
  },
});
