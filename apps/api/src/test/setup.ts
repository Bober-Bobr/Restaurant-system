// Environment fixtures for the test run.
//
// `config/env.ts` calls `envSchema.parse(process.env)` at import time, so every
// test file that touches a service would fail on the first import without
// these. They are fixtures, not secrets: nothing here reaches a real database —
// the Prisma singleton is mocked in the tests that need it.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-to-pass-validation';
process.env.PORT ??= '4000';
