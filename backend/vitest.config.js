import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // These are integration tests that share ONE live Postgres database
    // (DATABASE_URL_TEST) rather than an isolated in-memory fixture per
    // file. Vitest's default file parallelism runs test files concurrently
    // in separate workers, which lets files race on shared rows (e.g. the
    // single seeded admin user) -- observed directly as an intermittent
    // failure of the "last active admin" protection test depending on
    // which other file's seeding/assertions happened to interleave with
    // it. Running files sequentially trades some wall-clock time for a
    // deterministic, non-flaky suite, which is the right tradeoff for a
    // shared-database integration suite like this one.
    fileParallelism: false,
  },
});
