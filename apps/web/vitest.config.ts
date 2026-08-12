import { defineConfig } from 'vitest/config';

// Node environment, deliberately: these are unit tests of the logic behind the
// screens — routing decisions, money, the cart, autosave patches, translation
// coverage — not render tests. Nothing here needs a DOM, and the few modules
// that read `window` are given exactly the bit of it they read.
export default defineConfig({
  test: {
    name: 'web',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
